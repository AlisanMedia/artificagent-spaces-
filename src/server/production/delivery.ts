import { z } from "zod";
import { rm } from "node:fs/promises";
import { invariant } from "@/domain/platform";
import type { ProductionServiceId } from "@/domain/production-services";
import type { Actor, Database } from "../database";
import { authorize, audit, type PropertyService } from "../properties";
import { newId, digest, type Secrets } from "../crypto";
import type { LocalPrivateStorage } from "../storage";
import type { ProductionServiceEngine } from "./engine";
import { inspectProductionImage } from "./quality";

const Review = z
  .object({
    outputSha256: z.string().regex(/^[a-f0-9]{64}$/),
    checks: z
      .object({
        rights: z.literal(true),
        sourceFidelity: z.literal(true),
        disclosure: z.literal(true),
        privacy: z.literal(true),
      })
      .strict(),
  })
  .strict();
interface Artifact {
  artifact_id: string;
  sha256: string;
  bytes: number;
  qa: { state: string; reasons: string[]; critical: string[] };
  revoked: boolean;
  origin: "OFFLINE_CONTRACT_FIXTURE";
}
export class ProductionArtifactDelivery {
  constructor(
    readonly db: Database,
    readonly properties: PropertyService,
    readonly engine: ProductionServiceEngine,
    readonly storage: LocalPrivateStorage,
    readonly secrets: Secrets,
  ) {}
  /** Explicit offline integration test path; never exposed via HTTP and never represented as a provider result. */
  async ingestOfflineFixture(
    actor: Actor,
    requestId: string,
    candidate: Uint8Array,
    options: {
      expectedFence: number;
      mask?: Uint8Array;
      criticalFindings?: readonly string[];
    },
  ) {
    await authorize(this.db, actor, "edit");
    const request = await this.engine.get(actor, requestId);
    const row = (
      await this.db.as(actor, (tx) =>
        tx.query<{
          created_by: string;
          service_id: ProductionServiceId;
          fence: number;
          state: string;
        }>(
          "select created_by,service_id,fence,state from production_requests where organization_id=$1 and id=$2",
          [actor.organizationId, requestId],
        ),
      )
    ).rows[0]!;
    invariant(
      row.created_by === actor.userId &&
        row.fence === options.expectedFence &&
        row.state === "processing",
      "WORKER_FENCE_DENIED",
      409,
    );
    invariant(row.service_id.startsWith("P"), "IMAGE_PIPELINE_ONLY", 422);
    const sources = (
      await this.db.as(actor, (tx) =>
        tx.query<{ asset_id: string; source_sha256: string }>(
          "select asset_id,source_sha256 from production_sources where organization_id=$1 and request_id=$2",
          [actor.organizationId, requestId],
        ),
      )
    ).rows;
    invariant(sources.length === 1, "SERVICE_SOURCE_COUNT", 422);
    const source = sources[0]!,
      sourceBytes = await this.storage.readVerified(
        actor.organizationId,
        source.asset_id,
        source.source_sha256,
        "source",
      );
    const binding = {
      organizationId: actor.organizationId,
      propertyId: request.propertyId,
      revision: request.revision,
      sourceSha256: source.source_sha256,
    };
    const { clean, ...qa } = await inspectProductionImage({
      serviceId: row.service_id,
      source: sourceBytes,
      candidate,
      binding,
      expected: binding,
      ...(options.mask ? { mask: options.mask } : {}),
      ...(options.criticalFindings
        ? { criticalFindings: options.criticalFindings }
        : {}),
    });
    const artifactId = newId(),
      path = this.storage.path(
        actor.organizationId,
        artifactId,
        "output",
        "png",
      );
    await this.storage.put(path, clean);
    try {
      await this.db.pg.transaction(async (tx) => {
        const current = (
          await tx.query<{ revision: number; archived: boolean }>(
            "select revision,archived from properties where organization_id=$1 and id=$2 for update",
            [actor.organizationId, request.propertyId],
          )
        ).rows[0]!;
        const state = (
          await tx.query<{ state: string; fence: number }>(
            "select state,fence from production_requests where organization_id=$1 and id=$2 for update",
            [actor.organizationId, requestId],
          )
        ).rows[0]!;
        invariant(
          !current.archived &&
            current.revision === request.revision &&
            state.fence === options.expectedFence &&
            state.state === "processing",
          "WORKER_FENCE_DENIED",
          409,
        );
        await tx.query(
          "insert into production_artifacts(organization_id,request_id,artifact_id,sha256,bytes,qa,origin) values($1,$2,$3,$4,$5,$6,'OFFLINE_CONTRACT_FIXTURE')",
          [
            actor.organizationId,
            requestId,
            artifactId,
            digest(clean),
            clean.length,
            JSON.stringify(qa),
          ],
        );
        await tx.query(
          "update production_requests set state=$3,actual_micro_usd=0 where organization_id=$1 and id=$2",
          [
            actor.organizationId,
            requestId,
            qa.state === "AWAITING_INDEPENDENT_REVIEW"
              ? "awaiting-review"
              : qa.state === "REJECTED"
                ? "rejected"
                : "qa-held",
          ],
        );
        await audit(
          tx,
          actor,
          "production.offline_fixture_ingested_not_vendor_output",
          requestId,
        );
      });
    } catch (e) {
      await rm(path, { force: true });
      throw e;
    }
    return {
      sha256: digest(clean),
      bytes: clean.length,
      qa,
      origin: "OFFLINE_CONTRACT_FIXTURE" as const,
      delivered: false,
    };
  }
  private async artifact(actor: Actor, requestId: string) {
    await this.engine.get(actor, requestId);
    const artifact = (
      await this.db.as(actor, (tx) =>
        tx.query<Artifact>(
          "select * from production_artifacts where organization_id=$1 and request_id=$2",
          [actor.organizationId, requestId],
        ),
      )
    ).rows[0];
    invariant(artifact && !artifact.revoked, "OUTPUT_NOT_AVAILABLE", 403);
    return artifact;
  }
  async review(actor: Actor, requestId: string, input: unknown) {
    await authorize(this.db, actor, "review");
    const v = Review.parse(input),
      a = await this.artifact(actor, requestId);
    const requestScope = await this.engine.get(actor, requestId);
    invariant(
      a.sha256 === v.outputSha256 &&
        a.qa.state === "AWAITING_INDEPENDENT_REVIEW" &&
        a.qa.critical.length === 0 &&
        a.qa.reasons.length === 0,
      "QA_HOLD_CANNOT_RELEASE",
      403,
    );
    await this.db.pg.transaction(async (tx) => {
      const p = (
        await tx.query<{ revision: number; archived: boolean }>(
          "select revision,archived from properties where organization_id=$1 and id=$2 for update",
          [actor.organizationId, requestScope.propertyId],
        )
      ).rows[0]!;
      const r = (
        await tx.query<{
          created_by: string;
          state: string;
          revision: number;
          property_id: string;
        }>(
          "select created_by,state,revision,property_id from production_requests where organization_id=$1 and id=$2 for update",
          [actor.organizationId, requestId],
        )
      ).rows[0]!;
      const artifact = (
        await tx.query<Artifact>(
          "select * from production_artifacts where organization_id=$1 and request_id=$2 for update",
          [actor.organizationId, requestId],
        )
      ).rows[0]!;
      invariant(
        r.created_by !== actor.userId,
        "INDEPENDENT_REVIEW_REQUIRED",
        403,
      );
      invariant(
        r.state === "awaiting-review" &&
          !p.archived &&
          p.revision === r.revision &&
          !artifact.revoked &&
          artifact.sha256 === v.outputSha256,
        "SOURCE_OR_OUTPUT_CHANGED",
        409,
      );
      await tx.query(
        "insert into production_reviews(organization_id,request_id,id,reviewer_id,output_sha256,checks) values($1,$2,$3,$4,$5,$6)",
        [
          actor.organizationId,
          requestId,
          newId(),
          actor.userId,
          a.sha256,
          JSON.stringify(v.checks),
        ],
      );
      await tx.query(
        "update production_requests set state='approved' where organization_id=$1 and id=$2",
        [actor.organizationId, requestId],
      );
      await audit(
        tx,
        actor,
        "production.independent_offline_fixture_review",
        requestId,
      );
    });
    return {
      approved: true,
      realIndependentHumanAcceptance: false,
      origin: a.origin,
    };
  }
  async grant(actor: Actor, requestId: string) {
    const r = await this.engine.get(actor, requestId),
      a = await this.artifact(actor, requestId);
    invariant(r.state === "approved", "APPROVED_OUTPUT_REQUIRED", 403);
    const evidence = (
      await this.db.as(actor, (tx) =>
        tx.query(
          "select id from production_reviews where organization_id=$1 and request_id=$2 and output_sha256=$3",
          [actor.organizationId, requestId, a.sha256],
        ),
      )
    ).rows;
    invariant(evidence.length > 0, "INDEPENDENT_REVIEW_REQUIRED", 403);
    return this.secrets.sign({
      purpose: "output",
      organizationId: actor.organizationId,
      propertyId: r.propertyId,
      revision: r.revision,
      resourceId: requestId,
      sessionId: actor.sessionId,
      nonce: "production-v57:" + a.sha256,
      expiresAt: Date.now() + 60_000,
    });
  }
  async download(actor: Actor, requestId: string, token: string) {
    const r = await this.engine.get(actor, requestId),
      a = await this.artifact(actor, requestId),
      grant = this.secrets.verify(token, "output");
    invariant(
      r.state === "approved" &&
        grant.organizationId === actor.organizationId &&
        grant.sessionId === actor.sessionId &&
        grant.resourceId === requestId &&
        grant.propertyId === r.propertyId &&
        grant.revision === r.revision &&
        grant.nonce === "production-v57:" + a.sha256,
      "OUTPUT_GRANT_SCOPE_DENIED",
      403,
    );
    return {
      bytes: await this.storage.readVerified(
        actor.organizationId,
        a.artifact_id,
        a.sha256,
        "output",
        "png",
      ),
      sha256: a.sha256,
      origin: a.origin,
    };
  }
  async revoke(actor: Actor, requestId: string) {
    await authorize(this.db, actor, "edit");
    await this.engine.get(actor, requestId);
    await this.db.pg.query(
      "update production_artifacts set revoked=true where organization_id=$1 and request_id=$2",
      [actor.organizationId, requestId],
    );
    return { revoked: true };
  }
}
