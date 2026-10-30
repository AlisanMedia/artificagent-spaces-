import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { invariant } from "@/domain/platform";
import type { Actor, Database } from "../database";
import type { PropertyService } from "../properties";
import { authorize, audit } from "../properties";
import type { LocalPrivateStorage } from "../storage";
import type { ProductionServiceEngine } from "../production/engine";
import { compileServiceProfile } from "../production/prompts";
import { digest, newId } from "../crypto";
import { validateV01Video } from "../video-quality";
import { type V01Authority, type V01Permit } from "./authorization";
import {
  parseReceipt,
  ProviderId,
  parseStatus,
  parseResult,
  type V01Gateway,
} from "./gateway";
import { v01ResultUrl } from "./fal-http";

export interface V01Run {
  organization_id: string;
  request_id: string;
  property_id: string;
  revision: number;
  job_id: string;
  created_by: string;
  permit_id: string;
  permit_sha256: string;
  mode: V01Permit["mode"];
  phase:
    | "READY"
    | "SUBMITTING"
    | "QUEUED"
    | "RESULT"
    | "INGRESS"
    | "REVIEW"
    | "HOLD_UNKNOWN"
    | "REJECTED"
    | "CANCELLED";
  provider_request_id: string | null;
  status_url: string | null;
  result_url: string | null;
  candidate_url: string | null;
  source_sha256: string;
  prompt_sha256: string;
  deadline_ms: number;
  submit_deadline_ms: number;
  next_poll_ms: number;
  lease_until_ms: number;
  polls: number;
  fence: number;
  reserved_micro_usd: number;
  actual_micro_usd: number | null;
}
type Factory = (
  permit: V01Permit,
  hash: string,
  providerId: string | null,
  routes?: { status: string; result: string },
) => V01Gateway;
/** Existing production request + existing jobs/review/storage, with durable one-submit semantics. No webhook prerequisite. */
export class V01Service {
  constructor(
    readonly db: Database,
    readonly properties: PropertyService,
    readonly production: ProductionServiceEngine,
    readonly storage: LocalPrivateStorage,
    readonly authority: V01Authority,
    readonly gateway: Factory,
    readonly clock = Date.now,
  ) {}

  private async source(actor: Actor, requestId: string) {
    const request = await this.production.get(actor, requestId);
    const row = (
      await this.db.as(actor, (tx) =>
        tx.query<{
          service_id: string;
          created_by: string;
          rights: { syntheticOnly: boolean; ownedOrLicensed: boolean };
          profile: { promptSha256: string };
        }>(
          "select service_id,created_by,rights,profile from production_requests where organization_id=$1 and id=$2",
          [actor.organizationId, requestId],
        ),
      )
    ).rows[0]!;
    invariant(
      row.service_id === "V01" &&
        row.rights.syntheticOnly &&
        row.rights.ownedOrLicensed,
      "V01_ONLY_SYNTHETIC_RIGHTS_REQUIRED",
      403,
    );
    const assets = (
      await this.db.as(actor, (tx) =>
        tx.query<{ asset_id: string; source_sha256: string }>(
          "select asset_id,source_sha256 from production_sources where organization_id=$1 and request_id=$2",
          [actor.organizationId, requestId],
        ),
      )
    ).rows;
    invariant(assets.length === 1, "V01_ONE_SOURCE_REQUIRED", 422);
    return { request, row, source: assets[0]! };
  }
  private matches(
    p: V01Permit,
    actor: Actor,
    propertyId: string,
    revision: number,
    hash: string,
    seconds: number,
    aspect: string,
  ) {
    invariant(
      p.organizationId === actor.organizationId &&
        p.propertyId === propertyId &&
        p.revision === revision &&
        p.sourceSha256 === hash &&
        p.durationSeconds === seconds &&
        p.aspectRatio === aspect,
      "V01_PERMIT_SCOPE_DENIED",
      403,
    );
  }
  async readiness(
    actor: Actor,
    propertyId: string,
    revision: number,
    assetId: string,
  ) {
    const property = await this.properties.get(actor, propertyId);
    invariant(property.revision === revision, "STALE_REVISION", 409);
    const a = (await this.properties.assets(actor, propertyId)).find(
      (x) => x.id === assetId && x.kind === "photo" && x.status === "clean",
    );
    invariant(a, "V01_SOURCE_DENIED", 403);
    const existing = (
      await this.db.as(actor, (tx) =>
        tx.query<{ job_id: string }>(
          "select job_id from v01_runs where organization_id=$1 and property_id=$2 and revision=$3 and source_sha256=$4 and created_by=$5 order by job_id limit 1",
          [
            actor.organizationId,
            propertyId,
            revision,
            a.clean_hash,
            actor.userId,
          ],
        ),
      )
    ).rows[0];
    try {
      await authorize(this.db, actor, "edit");
      const { permit } = await this.authority.load(this.clock());
      this.matches(
        permit,
        actor,
        propertyId,
        revision,
        a.clean_hash,
        permit.durationSeconds,
        permit.aspectRatio,
      );
      return {
        available: !existing,
        resumeJobId: existing?.job_id ?? null,
        mode: permit.mode,
        durationSeconds: permit.durationSeconds,
        aspectRatio: permit.aspectRatio,
        message:
          permit.mode === "offline-fixture"
            ? "İmzalı sentetik offline test izni var. Gerçek AI üretimi yapılmaz."
            : "Bu kaynak için sınırlandırılmış gerçek sağlayıcı test izni var.",
      };
    } catch {
      return {
        available: false,
        resumeJobId: existing?.job_id ?? null,
        mode: null,
        durationSeconds: 4,
        aspectRatio: "16:9",
        message:
          "Bu kaynak için imzalı test izni henüz yok. Anahtar veya ayar tek başına üretimi açmaz.",
      };
    }
  }
  async start(actor: Actor, requestId: string) {
    await authorize(this.db, actor, "edit");
    const s = await this.source(actor, requestId);
    invariant(
      s.row.created_by === actor.userId,
      "V01_REQUEST_OWNER_OR_STATE_DENIED",
      403,
    );
    const previous = await this.find(actor, requestId, false);
    if (previous) return this.view(previous);
    invariant(
      s.request.state === "awaiting-provider-approval",
      "V01_REQUEST_STATE_DENIED",
      409,
    );
    const { permit: p, payloadSha256 } = await this.authority.load(
      this.clock(),
    );
    this.matches(
      p,
      actor,
      s.request.propertyId,
      s.request.revision,
      s.source.source_sha256,
      s.request.options.durationSeconds ?? 4,
      s.request.options.aspectRatio ?? "16:9",
    );
    const source = (
      await this.properties.assets(actor, s.request.propertyId)
    ).find((a) => a.id === s.source.asset_id)!;
    invariant(
      source.bytes <= p.maxSourceBytes &&
        Math.abs(
          source.width / source.height -
            (p.aspectRatio === "16:9" ? 16 / 9 : 9 / 16),
        ) < 0.02,
      "V01_SOURCE_ASPECT_OR_BYTES_DENIED",
      422,
    );
    await this.gateway(p, payloadSha256, null).preflight();
    const now = this.clock(),
      jobId = newId();
    const result = await this.db.pg.transaction(async (tx) => {
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1,581))", [
        actor.organizationId,
      ]);
      const property = (
        await tx.query<{ revision: number; archived: boolean }>(
          "select revision,archived from properties where organization_id=$1 and id=$2 for update",
          [actor.organizationId, p.propertyId],
        )
      ).rows[0];
      invariant(
        property && !property.archived && property.revision === p.revision,
        "STALE_REVISION",
        409,
      );
      const old = (
        await tx.query<V01Run>(
          "select * from v01_runs where organization_id=$1 and request_id=$2",
          [actor.organizationId, requestId],
        )
      ).rows[0];
      if (old) return old;
      await tx.query(
        "insert into v01_permit_usage values($1,$2,$3,0,0) on conflict do nothing",
        [actor.organizationId, p.id, payloadSha256],
      );
      const usage = (
        await tx.query<{
          payload_sha256: string;
          used_requests: number;
          reserved_micro_usd: number;
        }>(
          "select * from v01_permit_usage where organization_id=$1 and permit_id=$2 for update",
          [actor.organizationId, p.id],
        )
      ).rows[0]!;
      invariant(
        usage.payload_sha256 === payloadSha256 &&
          usage.used_requests < p.maxRequests &&
          Number(usage.reserved_micro_usd) + p.perRequestCapMicroUsd <=
            p.totalCapMicroUsd,
        "V01_REQUEST_OR_BUDGET_CAP",
        402,
      );
      const command = {
        propertyId: p.propertyId,
        revision: p.revision,
        mode: "pov",
        aspectRatio: p.aspectRatio,
        durationSeconds: p.durationSeconds,
        localSource: "provider-image-to-video",
        captions: false,
        branding: false,
        template: "modern",
        idempotencyKey: "v01:" + requestId,
        sourceAssetIds: [s.source.asset_id],
      };
      await tx.query(
        "insert into jobs(organization_id,id,property_id,revision,command,command_hash,idempotency_key,state,created_by,source_snapshot,execution_kind) values($1,$2,$3,$4,$5,$6,$7,'queued',$8,$9,'fal-v01')",
        [
          actor.organizationId,
          jobId,
          p.propertyId,
          p.revision,
          JSON.stringify(command),
          digest(JSON.stringify(command)),
          command.idempotencyKey,
          actor.userId,
          JSON.stringify([
            {
              id: s.source.asset_id,
              clean_hash: s.source.source_sha256,
              kind: "photo",
              mime: "image/jpeg",
            },
          ]),
        ],
      );
      await tx.query(
        "insert into v01_runs(organization_id,request_id,property_id,revision,job_id,created_by,permit_id,permit_sha256,mode,phase,source_sha256,prompt_sha256,deadline_ms,submit_deadline_ms,next_poll_ms,reserved_micro_usd) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'READY',$10,$11,$12,$13,$14,$15)",
        [
          actor.organizationId,
          requestId,
          p.propertyId,
          p.revision,
          jobId,
          actor.userId,
          p.id,
          payloadSha256,
          p.mode,
          s.source.source_sha256,
          s.row.profile.promptSha256,
          now + p.maxJobWallMs,
          Math.min(p.expiresAtMs, now + p.submitWithinMs),
          now,
          p.perRequestCapMicroUsd,
        ],
      );
      await tx.query(
        "update v01_permit_usage set used_requests=used_requests+1,reserved_micro_usd=reserved_micro_usd+$3 where organization_id=$1 and permit_id=$2",
        [actor.organizationId, p.id, p.perRequestCapMicroUsd],
      );
      await tx.query(
        "insert into v01_cost_events(organization_id,request_id,id,kind,amount_micro_usd) values($1,$2,$3,'reserve',$4)",
        [actor.organizationId, requestId, newId(), p.perRequestCapMicroUsd],
      );
      await audit(tx, actor, "v01.test_job_created", jobId);
      return (
        await tx.query<V01Run>(
          "select * from v01_runs where organization_id=$1 and request_id=$2",
          [actor.organizationId, requestId],
        )
      ).rows[0]!;
    });
    return this.view(result);
  }
  private async find(actor: Actor, requestId: string, required = true) {
    const r = (
      await this.db.as(actor, (tx) =>
        tx.query<V01Run>(
          "select * from v01_runs where organization_id=$1 and request_id=$2",
          [actor.organizationId, requestId],
        ),
      )
    ).rows[0];
    invariant(!required || r, "V01_RUN_NOT_FOUND", 404);
    return r;
  }
  async get(actor: Actor, jobId: string) {
    await authorize(this.db, actor, "read");
    const row = (
      await this.db.as(actor, (tx) =>
        tx.query<V01Run>(
          "select * from v01_runs where organization_id=$1 and job_id=$2",
          [actor.organizationId, jobId],
        ),
      )
    ).rows[0];
    invariant(row, "V01_RUN_NOT_FOUND", 404);
    await this.source(actor, row.request_id);
    return row;
  }
  view(r: V01Run) {
    return {
      jobId: r.job_id,
      productionRequestId: r.request_id,
      mode: r.mode,
      phase: r.phase,
      polls: r.polls,
      reservedMicroUsd: Number(r.reserved_micro_usd),
      actualMicroUsd:
        r.actual_micro_usd === null ? null : Number(r.actual_micro_usd),
      canAdvance: [
        "READY",
        "QUEUED",
        "RESULT",
        "INGRESS",
        "SUBMITTING",
      ].includes(r.phase),
    };
  }
  async advance(actor: Actor, jobId: string) {
    await authorize(this.db, actor, "edit");
    const initial = await this.get(actor, jobId);
    invariant(
      initial.created_by === actor.userId || actor.role === "admin",
      "V01_JOB_OWNER_REQUIRED",
      403,
    );
    if (
      !["READY", "SUBMITTING", "QUEUED", "RESULT", "INGRESS"].includes(
        initial.phase,
      )
    )
      return this.view(initial);
    const { permit: p, payloadSha256 } = await this.authority.load(
      this.clock(),
    );
    invariant(
      payloadSha256 === initial.permit_sha256 &&
        p.id === initial.permit_id &&
        p.mode === initial.mode,
      "V01_PERMIT_CHANGED",
      403,
    );
    const s = await this.source(actor, initial.request_id);
    this.matches(
      p,
      actor,
      initial.property_id,
      initial.revision,
      initial.source_sha256,
      s.request.options.durationSeconds ?? 4,
      s.request.options.aspectRatio ?? "16:9",
    );
    const now = this.clock();
    const claimed = await this.db.pg.transaction(async (tx) => {
      const r = (
        await tx.query<V01Run>(
          "select * from v01_runs where organization_id=$1 and job_id=$2 for update",
          [actor.organizationId, jobId],
        )
      ).rows[0]!;
      if (
        !this.view(r).canAdvance ||
        Number(r.lease_until_ms) > now ||
        Number(r.next_poll_ms) > now
      )
        return null;
      if (
        r.phase === "SUBMITTING" ||
        now >= Number(r.deadline_ms) ||
        r.polls >= p.maxPolls ||
        (r.phase === "READY" && now >= Number(r.submit_deadline_ms))
      ) {
        await tx.query(
          "update v01_runs set phase='HOLD_UNKNOWN',error_code='V01_RECONCILIATION_REQUIRED' where organization_id=$1 and job_id=$2",
          [actor.organizationId, jobId],
        );
        await tx.query(
          "update jobs set state='unknown-submission',error_code='V01_RECONCILIATION_REQUIRED' where organization_id=$1 and id=$2 and state in ('queued','processing')",
          [actor.organizationId, jobId],
        );
        return null;
      }
      return (
        await tx.query<V01Run>(
          "update v01_runs set lease_until_ms=$3,polls=polls+1,fence=fence+1 where organization_id=$1 and job_id=$2 returning *",
          [actor.organizationId, jobId, now + 120_000],
        )
      ).rows[0]!;
    });
    if (!claimed) return this.view(await this.get(actor, jobId));
    const gateway = this.gateway(
      p,
      payloadSha256,
      claimed.provider_request_id,
      claimed.status_url && claimed.result_url
        ? { status: claimed.status_url, result: claimed.result_url }
        : undefined,
    );
    invariant(gateway.mode === claimed.mode, "V01_TRANSPORT_MODE_DENIED", 403);
    let submitting = false,
      validating = false;
    try {
      if (claimed.phase === "READY") {
        const bytes = await this.storage.readVerified(
          actor.organizationId,
          s.source.asset_id,
          claimed.source_sha256,
          "source",
        );
        invariant(
          bytes.length <= p.maxSourceBytes,
          "V01_SOURCE_BYTE_LIMIT",
          413,
        );
        const profile = compileServiceProfile("V01", {
          durationSeconds: p.durationSeconds,
          aspectRatio: p.aspectRatio,
        });
        invariant(
          profile.promptSha256 === claimed.prompt_sha256,
          "V01_PROMPT_DRIFT",
          409,
        );
        await this.db.pg.transaction(async (tx) => {
          const r = (
            await tx.query<V01Run>(
              "select * from v01_runs where organization_id=$1 and job_id=$2 for update",
              [actor.organizationId, jobId],
            )
          ).rows[0]!;
          invariant(
            r.phase === "READY" &&
              r.fence === claimed.fence &&
              this.clock() < Number(r.submit_deadline_ms),
            "V01_WORKER_FENCED",
            409,
          );
          await tx.query(
            "update v01_runs set phase='SUBMITTING',submitted_at_ms=$3 where organization_id=$1 and job_id=$2",
            [actor.organizationId, jobId, this.clock()],
          );
          await tx.query(
            "update jobs set state='processing',attempt=1 where organization_id=$1 and id=$2",
            [actor.organizationId, jobId],
          );
          await tx.query(
            "update production_requests set state='processing' where organization_id=$1 and id=$2",
            [actor.organizationId, claimed.request_id],
          );
        });
        submitting = true;
        const rawReceipt = await gateway.submit(
          {
            start_image_url:
              "data:image/jpeg;base64," + bytes.toString("base64"),
            prompt: profile.text!,
            duration: p.durationSeconds,
            resolution: "1080p",
          },
          claimed.request_id,
        );
        const receiptId = ProviderId.parse(
          (rawReceipt as { request_id?: unknown }).request_id,
        );
        await this.db.pg.transaction(async (tx) => {
          await tx.query(
            "update v01_runs set provider_request_id=$3 where organization_id=$1 and job_id=$2",
            [actor.organizationId, jobId, receiptId],
          );
          await tx.query(
            "update production_requests set provider_request_id=$3 where organization_id=$1 and id=$2",
            [actor.organizationId, claimed.request_id, receiptId],
          );
        });
        const receipt = parseReceipt(rawReceipt);
        // Persist acceptance even if cancellation raced the response. Never lose a paid ID and resubmit.
        await this.db.pg.transaction(async (tx) => {
          await tx.query(
            "update v01_runs set provider_request_id=$3,phase=case when fence=$4 and phase='SUBMITTING' then 'QUEUED' else phase end,lease_until_ms=0,next_poll_ms=$5,status_url=$6,result_url=$7 where organization_id=$1 and job_id=$2",
            [
              actor.organizationId,
              jobId,
              receipt.request_id,
              claimed.fence,
              this.clock() + p.pollIntervalMs,
              receipt.routes.status,
              receipt.routes.result,
            ],
          );
          await tx.query(
            "update production_requests set provider_request_id=$3 where organization_id=$1 and id=$2",
            [actor.organizationId, claimed.request_id, receipt.request_id],
          );
        });
      } else if (claimed.phase === "QUEUED") {
        const status = parseStatus(
          await gateway.status(claimed.provider_request_id!),
          claimed.provider_request_id!,
        );
        await this.progress(
          claimed,
          status === "COMPLETED" ? "RESULT" : "QUEUED",
          p.pollIntervalMs,
        );
      } else if (claimed.phase === "RESULT") {
        const url = parseResult(
          await gateway.result(claimed.provider_request_id!),
        );
        v01ResultUrl(url);
        await this.db.pg.query(
          "update v01_runs set candidate_url=$3 where organization_id=$1 and job_id=$2 and fence=$4 and phase='RESULT'",
          [actor.organizationId, jobId, url, claimed.fence],
        );
        await this.progress(claimed, "INGRESS", 0);
      } else if (claimed.phase === "INGRESS") {
        const bytes = await gateway.download(
          claimed.candidate_url!,
          p.maxOutputBytes,
        );
        invariant(
          bytes.length <= p.maxOutputBytes,
          "V01_OUTPUT_BYTE_LIMIT",
          413,
        );
        validating = true;
        const dir = await mkdtemp(join(this.storage.root, "v01-quarantine-")),
          raw = join(dir, "candidate.mp4"),
          clean = join(dir, "clean.mp4"),
          artifactId = newId();
        const output = this.storage.path(
          actor.organizationId,
          artifactId,
          "output",
          "mp4",
        );
        let stored = false;
        try {
          await this.storage.put(raw, bytes);
          const property = await this.properties.get(
            actor,
            claimed.property_id,
          );
          const result = await validateV01Video(raw, clean, {
            durationSeconds: p.durationSeconds,
            aspectRatio: p.aspectRatio,
            maxBytes: p.maxOutputBytes,
            sourceId: s.source.asset_id,
            sourceSha256: claimed.source_sha256,
            revision: claimed.revision,
            manifestSha256: digest(JSON.stringify(property.manifest)),
            requestId: claimed.request_id,
            mode: claimed.mode,
          });
          await this.storage.put(output, await readFile(clean));
          stored = true;
          await this.db.pg.transaction(async (tx) => {
            const propertyNow = (
              await tx.query<{ revision: number; archived: boolean }>(
                "select revision,archived from properties where organization_id=$1 and id=$2 for update",
                [actor.organizationId, claimed.property_id],
              )
            ).rows[0]!;
            const r = (
              await tx.query<V01Run>(
                "select * from v01_runs where organization_id=$1 and job_id=$2 for update",
                [actor.organizationId, jobId],
              )
            ).rows[0]!;
            invariant(
              !propertyNow.archived &&
                propertyNow.revision === claimed.revision &&
                r.phase === "INGRESS" &&
                r.fence === claimed.fence,
              "V01_WORKER_FENCED",
              409,
            );
            await tx.query(
              "update jobs set state='awaiting-review',output=$3,error_code=null where organization_id=$1 and id=$2 and execution_kind='fal-v01'",
              [
                actor.organizationId,
                jobId,
                JSON.stringify({ ...result.evidence, artifactId }),
              ],
            );
            await tx.query(
              "update production_requests set state='awaiting-review' where organization_id=$1 and id=$2",
              [actor.organizationId, claimed.request_id],
            );
            await tx.query(
              "update v01_runs set phase='REVIEW',raw_sha256=$3,actual_micro_usd=$4,lease_until_ms=0 where organization_id=$1 and job_id=$2",
              [
                actor.organizationId,
                jobId,
                result.rawSha256,
                claimed.mode === "offline-fixture" ? 0 : null,
              ],
            );
            await tx.query(
              "insert into v01_cost_events(organization_id,request_id,id,kind,amount_micro_usd) values($1,$2,$3,$4,$5)",
              [
                actor.organizationId,
                claimed.request_id,
                newId(),
                claimed.mode === "offline-fixture"
                  ? "known-zero-offline"
                  : "hold-unknown",
                claimed.mode === "offline-fixture" ? 0 : null,
              ],
            );
            await audit(
              tx,
              actor,
              "v01.private_candidate_awaiting_independent_review",
              jobId,
            );
          });
        } catch (error) {
          if (stored) await rm(output, { force: true });
          throw error;
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }
    } catch {
      await this.db.pg.transaction(async (tx) => {
        const phase = submitting
          ? "HOLD_UNKNOWN"
          : validating
            ? "REJECTED"
            : claimed.phase;
        await tx.query(
          "update v01_runs set phase=$3,lease_until_ms=0,next_poll_ms=$4,error_code=$5 where organization_id=$1 and job_id=$2 and fence=$6 and phase not in ('CANCELLED','REVIEW')",
          [
            actor.organizationId,
            jobId,
            phase,
            this.clock() + p.pollIntervalMs,
            submitting
              ? "V01_ACCEPTANCE_UNKNOWN"
              : "V01_RESULT_RETRY_OR_QA_REQUIRED",
            claimed.fence,
          ],
        );
        if (submitting || phase === "REJECTED")
          await tx.query(
            "update jobs set state=$3,error_code=$4 where organization_id=$1 and id=$2 and state in ('queued','processing')",
            [
              actor.organizationId,
              jobId,
              submitting ? "unknown-submission" : "failed",
              submitting ? "V01_ACCEPTANCE_UNKNOWN" : "V01_VIDEO_QA_HOLD",
            ],
          );
      });
    }
    return this.view(await this.get(actor, jobId));
  }
  private async progress(r: V01Run, phase: V01Run["phase"], delay: number) {
    await this.db.pg.query(
      "update v01_runs set phase=$3,lease_until_ms=0,next_poll_ms=$4 where organization_id=$1 and job_id=$2 and phase=$5 and fence=$6",
      [
        r.organization_id,
        r.job_id,
        phase,
        this.clock() + delay,
        r.phase,
        r.fence,
      ],
    );
  }
  async cancel(actor: Actor, jobId: string) {
    await authorize(this.db, actor, "edit");
    const r = await this.get(actor, jobId);
    invariant(
      r.created_by === actor.userId || actor.role === "admin",
      "V01_JOB_OWNER_REQUIRED",
      403,
    );
    await this.db.pg.transaction(async (tx) => {
      await tx.query(
        "update v01_runs set phase='CANCELLED',fence=fence+1,lease_until_ms=0 where organization_id=$1 and job_id=$2",
        [actor.organizationId, jobId],
      );
      await tx.query(
        "update jobs set state='cancelled',epoch=epoch+1,output=null where organization_id=$1 and id=$2",
        [actor.organizationId, jobId],
      );
      await tx.query(
        "update production_requests set state='cancelled',fence=fence+1 where organization_id=$1 and id=$2",
        [actor.organizationId, r.request_id],
      );
      await tx.query(
        "insert into v01_cost_events(organization_id,request_id,id,kind,amount_micro_usd) values($1,$2,$3,'hold-unknown',null)",
        [actor.organizationId, r.request_id, newId()],
      );
      await audit(tx, actor, "v01.cancel_fenced_no_assumed_refund", jobId);
    });
    return this.view(await this.get(actor, jobId));
  }
  async reconcile(actor: Actor, jobId: string, providerId: string) {
    await authorize(this.db, actor, "admin");
    const r = await this.get(actor, jobId);
    invariant(
      r.phase === "HOLD_UNKNOWN" &&
        (!r.provider_request_id || r.provider_request_id === providerId),
      "V01_RECONCILIATION_STATE_DENIED",
      409,
    );
    const { permit, payloadSha256 } = await this.authority.load(this.clock());
    invariant(payloadSha256 === r.permit_sha256, "V01_PERMIT_CHANGED", 403);
    invariant(
      this.authority.verifyReconciliation,
      "V01_RECONCILIATION_PROOF_REQUIRED",
      403,
    );
    await this.authority.verifyReconciliation(
      {
        jobId,
        requestId: r.request_id,
        organizationId: actor.organizationId,
        sourceSha256: r.source_sha256,
        providerId,
      },
      this.clock(),
    );
    // Read-only authenticated status proof; no second submit. Account billing still UNKNOWN until separately evidenced.
    parseStatus(
      await this.gateway(permit, payloadSha256, providerId).status(providerId),
      providerId,
    );
    await this.db.pg.transaction(async (tx) => {
      await tx.query(
        "update v01_runs set provider_request_id=$3,phase='QUEUED',lease_until_ms=0,next_poll_ms=$4 where organization_id=$1 and job_id=$2 and phase='HOLD_UNKNOWN' and (provider_request_id is null or provider_request_id=$3)",
        [actor.organizationId, jobId, providerId, this.clock()],
      );
      await tx.query(
        "update production_requests set provider_request_id=$3 where organization_id=$1 and id=$2",
        [actor.organizationId, r.request_id, providerId],
      );
      await tx.query(
        "update jobs set state='processing' where organization_id=$1 and id=$2 and state='unknown-submission'",
        [actor.organizationId, jobId],
      );
      await audit(
        tx,
        actor,
        "v01.authenticated_status_reconciliation_no_resubmit",
        jobId,
      );
    });
    return this.view(await this.get(actor, jobId));
  }
}
