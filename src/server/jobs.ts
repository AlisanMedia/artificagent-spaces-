import { z } from "zod";
import {
  GenerationInput,
  Id,
  invariant,
  validateScene,
} from "@/domain/platform";
import type { OutputEvidence } from "@/contracts/platform-ports";
import { digest, newId } from "./crypto";
import type { Actor, Database } from "./database";
import { authorize, audit, type PropertyService } from "./properties";
import type { LocalPrivateStorage } from "./storage";
import { BrandService } from "./brands";
import { Ledger } from "./ledger";
import { buildOutput, type MediaSource } from "./media";
import {
  buildPhotoComposition,
  discardFencedComposition,
} from "./video-composition";

export interface V01JobCommand {
  propertyId: string;
  revision: number;
  mode: "pov";
  durationSeconds: 4 | 8;
  aspectRatio: "16:9" | "9:16";
  idempotencyKey: string;
  captions: false;
  localSource: "provider-image-to-video";
  sourceAssetIds: string[];
  template: "modern";
  branding: false;
  photoComposition?: undefined;
}
export interface JobRecord {
  execution_kind?: "local" | "fal-v01";
  id: string;
  organization_id: string;
  property_id: string;
  revision: number;
  command: z.infer<typeof GenerationInput> | V01JobCommand;
  command_hash: string;
  state:
    | "queued"
    | "processing"
    | "awaiting-review"
    | "approved"
    | "rejected"
    | "failed"
    | "cancelled"
    | "unknown-submission";
  attempt: number;
  epoch: number;
  fence: string | null;
  lease_until: Date | null;
  output: OutputEvidence | null;
  error_code: string | null;
  created_by: string;
  source_snapshot: unknown;
}
type LocalJobRecord = Omit<JobRecord, "command"> & {
  command: z.infer<typeof GenerationInput>;
};
export class JobService {
  private readonly ledger = new Ledger();
  private running = false;
  constructor(
    readonly db: Database,
    readonly properties: PropertyService,
    readonly storage: LocalPrivateStorage,
  ) {}
  async list(actor: Actor) {
    await authorize(this.db, actor, "read");
    return (
      await this.db.as(actor, (tx) =>
        tx.query<JobRecord>(
          "select * from jobs where organization_id=$1 order by created_at desc",
          [actor.organizationId],
        ),
      )
    ).rows;
  }
  async get(actor: Actor, id: string) {
    const rows = await this.db.as(actor, (tx) =>
      tx.query<JobRecord>(
        "select * from jobs where organization_id=$1 and id=$2",
        [actor.organizationId, id],
      ),
    );
    invariant(rows.rows[0], "JOB_NOT_FOUND", 404);
    return rows.rows[0];
  }
  quote(input: unknown) {
    const command = GenerationInput.parse(input);
    return {
      command,
      simulatedCreditMicroUsd: 1000,
      actualExternalCostMicroUsd: 0 as const,
      provider: "local-ffmpeg-blender",
      estimatedWallTimeSeconds: null,
      estimateStatus: "UNKNOWN_UNTIL_MEASURED",
      disclosure:
        "Sanal kredi; ticari fiyat veya ücretli servis çağrısı değildir.",
    };
  }
  async submit(actor: Actor, input: unknown) {
    await authorize(this.db, actor, "edit");
    const command = GenerationInput.parse(input);
    const property = await this.properties.get(actor, command.propertyId);
    invariant(property.revision === command.revision, "STALE_REVISION", 409);
    let sources = (await this.properties.assets(actor, property.id)).filter(
      (a) => a.status === "clean",
    );
    if (command.sourceAssetIds) {
      invariant(
        new Set(command.sourceAssetIds).size === command.sourceAssetIds.length,
        "DUPLICATE_MEDIA",
      );
      const selected = command.sourceAssetIds.map((id) =>
        sources.find((a) => a.id === id),
      );
      invariant(selected.every(Boolean), "MEDIA_SCOPE_DENIED", 403);
      sources = selected as typeof sources;
    }
    invariant(
      command.mode === "interactive-3d"
        ? property.manifest.rooms.length > 0 &&
            property.manifest.measuredBy &&
            property.manifest.rooms.every((r) => r.truth === "E2")
        : sources.some(
            (s) =>
              s.kind === "photo" ||
              s.kind === "panorama" ||
              s.kind === "walkthrough",
          ),
      "INSUFFICIENT_EVIDENCE",
    );
    if (command.photoComposition)
      invariant(
        sources.length === command.sourceAssetIds?.length &&
          sources.every((s) => s.kind === "photo") &&
          new Set(sources.map((s) => s.clean_hash)).size === sources.length,
        "DISTINCT_PHOTOS_REQUIRED",
        422,
      );
    const hash = digest(JSON.stringify(command));
    return this.db.pg.transaction(async (tx) => {
      const current = await tx.query<{ revision: number }>(
        "select revision from properties where organization_id=$1 and id=$2 and not archived for update",
        [actor.organizationId, property.id],
      );
      invariant(
        current.rows[0]?.revision === command.revision,
        "STALE_REVISION",
        409,
      );
      await tx.query(
        "select organization_id from credit_accounts where organization_id=$1 for update",
        [actor.organizationId],
      );
      const old = await tx.query<JobRecord>(
        "select * from jobs where organization_id=$1 and idempotency_key=$2",
        [actor.organizationId, command.idempotencyKey],
      );
      if (old.rows[0]) {
        invariant(
          old.rows[0].command_hash === hash,
          "IDEMPOTENCY_CONFLICT",
          409,
        );
        return old.rows[0];
      }
      const active = await tx.query<{ count: number }>(
        "select count(*)::int as count from jobs where organization_id=$1 and state in ('queued','processing')",
        [actor.organizationId],
      );
      invariant(active.rows[0]!.count < 3, "TENANT_JOB_LIMIT", 429);
      const capacity = (
        await tx.query<{ bytes: string }>(
          "select coalesce(sum((output->>'bytes')::bigint + coalesce((output->>'auxiliaryBytes')::bigint,0)),0)::text as bytes from jobs where organization_id=$1",
          [actor.organizationId],
        )
      ).rows[0]!;
      invariant(
        Number(capacity.bytes) + (active.rows[0]!.count + 1) * 52428800 <=
          524288000,
        "TENANT_OUTPUT_QUOTA",
        429,
      );
      const id = newId();
      await tx.query(
        "insert into jobs(organization_id,id,property_id,revision,command,command_hash,idempotency_key,state,created_by,source_snapshot) values($1,$2,$3,$4,$5,$6,$7,'queued',$8,$9)",
        [
          actor.organizationId,
          id,
          property.id,
          property.revision,
          JSON.stringify(command),
          hash,
          command.idempotencyKey,
          actor.userId,
          JSON.stringify(
            sources.map((source) => ({
              id: source.id,
              clean_hash: source.clean_hash,
              kind: source.kind,
              mime: source.mime,
            })),
          ),
        ],
      );
      await this.ledger.reserve(tx, actor.organizationId, id, 1000);
      await tx.query(
        "insert into outbox(organization_id,id,job_id) values($1,$2,$3)",
        [actor.organizationId, newId(), id],
      );
      await audit(tx, actor, "job.submitted", id);
      return (
        await tx.query<JobRecord>(
          "select * from jobs where organization_id=$1 and id=$2",
          [actor.organizationId, id],
        )
      ).rows[0]!;
    });
  }
  async cancel(actor: Actor, id: string) {
    await authorize(this.db, actor, "edit");
    const checked = await this.get(actor, id);
    invariant(
      checked.execution_kind !== "fal-v01",
      "V01_CANCEL_PATH_REQUIRED",
      409,
    );
    await this.db.pg.transaction(async (tx) => {
      const row = (
        await tx.query<JobRecord>(
          "select * from jobs where organization_id=$1 and id=$2 for update",
          [actor.organizationId, id],
        )
      ).rows[0]!;
      invariant(
        ["queued", "processing", "failed", "unknown-submission"].includes(
          row.state,
        ),
        "JOB_NOT_CANCELLABLE",
        409,
      );
      await tx.query(
        "update jobs set state='cancelled',epoch=epoch+1,fence=null,updated_at=now() where organization_id=$1 and id=$2",
        [actor.organizationId, id],
      );
      await this.ledger.settle(tx, actor.organizationId, id, null);
      await tx.query(
        "update job_attempts set state='fenced',finished_at=now() where organization_id=$1 and job_id=$2 and state='processing'",
        [actor.organizationId, id],
      );
      await audit(tx, actor, "job.cancelled", id);
    });
  }
  async recoverLeases() {
    await this.db.pg.transaction(async (tx) => {
      const expired = await tx.query<JobRecord>(
        "update jobs set state=case when attempt<2 then 'queued' else 'failed' end,fence=null,epoch=epoch+1,error_code='LEASE_EXPIRED' where state='processing' and execution_kind='local' and lease_until<now() returning *",
      );
      for (const job of expired.rows) {
        await tx.query(
          "update job_attempts set state='fenced',error_code='LEASE_EXPIRED',finished_at=now() where organization_id=$1 and job_id=$2 and state='processing'",
          [job.organization_id, job.id],
        );
        if (job.state === "failed")
          await this.ledger.settle(tx, job.organization_id, job.id, null);
      }
    });
  }
  async processNext() {
    if (this.running) return null;
    this.running = true;
    try {
      await this.recoverLeases();
      const job = await this.db.pg.transaction(async (tx) => {
        const row = (
          await tx.query<LocalJobRecord>(
            "select * from jobs where state='queued' and execution_kind='local' and attempt<2 order by created_at for update skip locked limit 1",
          )
        ).rows[0];
        if (!row) return null;
        const fence = newId();
        await tx.query(
          "update jobs set state='processing',attempt=attempt+1,fence=$3,lease_until=now()+interval '150 seconds',updated_at=now() where organization_id=$1 and id=$2",
          [row.organization_id, row.id, fence],
        );
        await tx.query(
          "update outbox set delivered=true where organization_id=$1 and job_id=$2",
          [row.organization_id, row.id],
        );
        await tx.query(
          "insert into job_attempts(organization_id,job_id,attempt,fence,epoch,provider,state) values($1,$2,$3,$4,$5,'local-ffmpeg-blender','processing')",
          [row.organization_id, row.id, row.attempt + 1, fence, row.epoch],
        );
        return { ...row, fence, attempt: row.attempt + 1 };
      });
      if (!job) return null;
      try {
        const revision = (
          await this.db.pg.query<{
            manifest: unknown;
            current_revision: number;
            archived: boolean;
          }>(
            "select r.manifest,p.revision as current_revision,p.archived from property_revisions r join properties p on p.organization_id=r.organization_id and p.id=r.property_id where r.organization_id=$1 and r.property_id=$2 and r.revision=$3",
            [job.organization_id, job.property_id, job.revision],
          )
        ).rows[0];
        invariant(
          revision &&
            revision.current_revision === job.revision &&
            !revision.archived,
          "STALE_JOB_REVISION",
        );
        const scene = validateScene(revision.manifest);
        const sources: MediaSource[] = z
          .array(
            z
              .object({
                id: Id,
                clean_hash: z.string().regex(/^[a-f0-9]{64}$/),
                kind: z.enum([
                  "photo",
                  "panorama",
                  "floor-plan",
                  "walkthrough",
                ]),
                mime: z.enum(["image/jpeg", "video/mp4"]).optional(),
              })
              .strict(),
          )
          .min(1)
          .max(20)
          .parse(job.source_snapshot);
        const records = (
          await this.db.pg.query<{
            id: string;
            clean_hash: string;
            status: string;
          }>(
            "select id,clean_hash,status from assets where organization_id=$1 and property_id=$2 and id=any($3::text[])",
            [job.organization_id, job.property_id, sources.map((s) => s.id)],
          )
        ).rows;
        invariant(
          records.length === sources.length &&
            sources.every((s) =>
              records.some(
                (r) =>
                  r.id === s.id &&
                  r.clean_hash === s.clean_hash &&
                  r.status === "clean",
              ),
            ),
          "SOURCE_EVIDENCE_CHANGED",
        );
        const brand = job.command.branding
          ? await new BrandService(this.db).publicBrand(job.organization_id)
          : undefined;
        let logoHash: string | undefined;
        if (brand?.logoAssetId) {
          const logo = (
            await this.db.pg.query<{ clean_hash: string }>(
              "select clean_hash from assets where organization_id=$1 and id=$2 and mime='image/jpeg' and status='clean'",
              [job.organization_id, brand.logoAssetId],
            )
          ).rows[0];
          invariant(logo, "BRAND_ASSET_SCOPE_DENIED", 403);
          await this.storage.readVerified(
            job.organization_id,
            brand.logoAssetId,
            logo.clean_hash,
            "source",
          );
          logoHash = logo.clean_hash;
        }
        const output = await (
          job.command.photoComposition ? buildPhotoComposition : buildOutput
        )(
          this.storage,
          job.id + "--" + job.fence,
          GenerationInput.parse(job.command),
          scene,
          sources,
          brand ? { ...brand, logoHash } : undefined,
        );
        await this.db.pg.transaction(async (tx) => {
          const updated = await tx.query(
            "update jobs set state='awaiting-review',output=$5,updated_at=now() where organization_id=$1 and id=$2 and fence=$3 and epoch=$4 and state='processing' returning id",
            [
              job.organization_id,
              job.id,
              job.fence,
              job.epoch,
              JSON.stringify(output),
            ],
          );
          if (updated.rows.length)
            await this.ledger.settle(tx, job.organization_id, job.id, 1000);
          else
            await discardFencedComposition(
              this.storage,
              job.organization_id,
              output,
            );
          await tx.query(
            "update job_attempts set state=$4,output_hash=$5,finished_at=now() where organization_id=$1 and job_id=$2 and fence=$3 and state='processing'",
            [
              job.organization_id,
              job.id,
              job.fence,
              updated.rows.length ? "succeeded" : "fenced",
              output.sha256,
            ],
          );
        });
      } catch (error) {
        const code =
          typeof error === "object" &&
          error &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code
            : "LOCAL_WORKER_FAILED";
        await this.db.pg.transaction(async (tx) => {
          const updated = await tx.query(
            "update jobs set state='failed',error_code=$5,updated_at=now() where organization_id=$1 and id=$2 and fence=$3 and epoch=$4 and state='processing' returning id",
            [job.organization_id, job.id, job.fence, job.epoch, code],
          );
          if (updated.rows.length)
            await this.ledger.settle(tx, job.organization_id, job.id, null);
          await tx.query(
            "update job_attempts set state=$4,error_code=$5,finished_at=now() where organization_id=$1 and job_id=$2 and fence=$3 and state='processing'",
            [
              job.organization_id,
              job.id,
              job.fence,
              updated.rows.length ? "failed" : "fenced",
              code,
            ],
          );
        });
      }
      return job.id;
    } finally {
      this.running = false;
    }
  }
}
