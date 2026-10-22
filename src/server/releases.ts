import { z } from "zod";
import { invariant, validateScene, type Scene } from "@/domain/platform";
import type { OutputEvidence } from "@/contracts/platform-ports";
import type { Actor, Database } from "./database";
import type { Secrets } from "./crypto";
import { newId, type Grant } from "./crypto";
import { authorize, audit, type PropertyService } from "./properties";
import type { JobService } from "./jobs";

export interface Publication {
  id: string;
  organization_id: string;
  property_id: string;
  revision: number;
  job_id: string;
  nonce: string;
  expires_at: Date;
  revoked: boolean;
}
export interface PublishedScope {
  publication: Publication;
  scene: Scene;
  title: string;
  output: OutputEvidence;
  visitorSessionId: string;
}
export class ReleaseService {
  constructor(
    readonly db: Database,
    readonly properties: PropertyService,
    readonly jobs: JobService,
    readonly secrets: Secrets,
  ) {}
  async review(actor: Actor, jobId: string, input: unknown) {
    await authorize(this.db, actor, "review");
    const request = z
      .object({
        decision: z.enum(["approved", "rejected", "retake"]),
        rights: z.boolean(),
        evidence: z.boolean(),
        continuity: z.boolean(),
        disclosure: z.boolean(),
      })
      .strict()
      .parse(input);
    invariant(
      request.decision !== "approved" ||
        (request.rights &&
          request.evidence &&
          request.continuity &&
          request.disclosure),
      "APPROVAL_CHECKS_REQUIRED",
      409,
    );
    const job = await this.jobs.get(actor, jobId),
      property = await this.properties.get(actor, job.property_id);
    invariant(
      job.created_by !== actor.userId,
      "INDEPENDENT_REVIEW_REQUIRED",
      403,
    );
    invariant(
      job.state === "awaiting-review" &&
        job.output?.qa.integrity &&
        job.revision === property.revision,
      "STALE_OR_INVALID_REVIEW",
      409,
    );
    return this.db.pg.transaction(async (tx) => {
      const id = newId();
      const result = await tx.query(
        "update jobs set state=$3,updated_at=now() where organization_id=$1 and id=$2 and state='awaiting-review' returning id",
        [
          actor.organizationId,
          jobId,
          request.decision === "approved" ? "approved" : "rejected",
        ],
      );
      invariant(result.rows.length === 1, "REVIEW_ALREADY_RECORDED", 409);
      await tx.query(
        "insert into reviews(organization_id,id,job_id,property_id,revision,decision,reviewer_id,checks) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          actor.organizationId,
          id,
          jobId,
          job.property_id,
          job.revision,
          request.decision,
          actor.userId,
          JSON.stringify(request),
        ],
      );
      await audit(tx, actor, "review." + request.decision, jobId);
      return { id, decision: request.decision };
    });
  }
  async publish(actor: Actor, jobId: string) {
    await authorize(this.db, actor, "edit");
    const job = await this.jobs.get(actor, jobId),
      property = await this.properties.get(actor, job.property_id);
    invariant(
      job.state === "approved" &&
        job.output &&
        job.revision === property.revision,
      "APPROVED_CURRENT_OUTPUT_REQUIRED",
      409,
    );
    const review = (
      await this.db.pg.query<{ id: string }>(
        "select id from reviews where organization_id=$1 and job_id=$2 and decision='approved' order by created_at desc limit 1",
        [actor.organizationId, jobId],
      )
    ).rows[0];
    invariant(review, "REVIEW_REQUIRED", 409);
    const id = newId(),
      nonce = newId(),
      expiresAt = Date.now() + 3_600_000;
    await this.db.pg.transaction(async (tx) => {
      await tx.query(
        "insert into publications(organization_id,id,property_id,revision,job_id,review_id,nonce,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          actor.organizationId,
          id,
          property.id,
          property.revision,
          job.id,
          review.id,
          nonce,
          new Date(expiresAt).toISOString(),
        ],
      );
      await audit(tx, actor, "publication.local_created", id);
    });
    const grant: Grant = {
      purpose: "publication",
      organizationId: actor.organizationId,
      propertyId: property.id,
      revision: property.revision,
      resourceId: id,
      nonce,
      sessionId: "public-tour",
      expiresAt,
    };
    return {
      id,
      token: this.secrets.sign(grant),
      expiresAt,
      localOnly: true,
      disclosure:
        "Yalnız yerel loopback turu; internet deployment/paylaşımı yapılmadı.",
    };
  }
  async resolve(
    token: string,
    visitorSessionId = "uninitialized",
  ): Promise<PublishedScope> {
    const grant = this.secrets.verify(token, "publication");
    const result = await this.db.pg.query<
      Publication & {
        manifest: unknown;
        title: string;
        output: OutputEvidence;
        current_revision: number;
        archived: boolean;
        job_state: string;
      }
    >(
      "select pub.*,r.manifest,p.title,p.revision as current_revision,p.archived,j.output,j.state as job_state from publications pub join property_revisions r on r.organization_id=pub.organization_id and r.property_id=pub.property_id and r.revision=pub.revision join properties p on p.organization_id=pub.organization_id and p.id=pub.property_id join jobs j on j.organization_id=pub.organization_id and j.id=pub.job_id where pub.organization_id=$1 and pub.id=$2",
      [grant.organizationId, grant.resourceId],
    );
    const row = result.rows[0];
    invariant(
      row &&
        !row.revoked &&
        row.nonce === grant.nonce &&
        new Date(row.expires_at).getTime() > Date.now() &&
        row.property_id === grant.propertyId &&
        row.revision === grant.revision &&
        row.current_revision === grant.revision &&
        !row.archived &&
        row.job_state === "approved",
      "PUBLICATION_REVOKED_OR_STALE",
      403,
    );
    return {
      publication: row,
      scene: validateScene(row.manifest),
      title: row.title,
      output: row.output,
      visitorSessionId,
    };
  }
  async revoke(actor: Actor, id: string) {
    await authorize(this.db, actor, "edit");
    const result = await this.db.pg.query(
      "update publications set revoked=true where organization_id=$1 and id=$2 returning id",
      [actor.organizationId, id],
    );
    invariant(result.rows.length === 1, "PUBLICATION_NOT_FOUND", 404);
  }
  async outputGrant(actor: Actor, jobId: string) {
    const job = await this.jobs.get(actor, jobId);
    const property = await this.properties.get(actor, job.property_id);
    invariant(
      job.state === "approved" &&
        job.output &&
        property.revision === job.revision,
      "APPROVED_CURRENT_OUTPUT_REQUIRED",
      403,
    );
    return this.secrets.sign({
      purpose: "output",
      organizationId: actor.organizationId,
      propertyId: job.property_id,
      revision: job.revision,
      resourceId: jobId,
      sessionId: actor.sessionId,
      nonce: newId(),
      expiresAt: Date.now() + 60_000,
    });
  }
}
