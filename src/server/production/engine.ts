import {
  ProductionRequest,
  type ProductionRequestView,
} from "@/domain/production-services";
import { Id, invariant } from "@/domain/platform";
import { verifyFalWebhook } from "@/adapters/providers/fal-webhook";
import type { Actor, Database } from "../database";
import { authorize, audit, type PropertyService } from "../properties";
import { newId, digest } from "../crypto";
import { compileServiceProfile } from "./prompts";
import { productionService } from "./registry";

interface RequestRow {
  id: string;
  organization_id: string;
  property_id: string;
  revision: number;
  service_id: ProductionRequest["serviceId"];
  created_by: string;
  fingerprint: string;
  state: ProductionRequestView["state"];
  fence: number;
  provider_request_id: string | null;
  options: ProductionRequest["options"];
}
/** Durable blocked requests are real saved source snapshots, NOT provider jobs and never debit the ledger. */
export class ProductionServiceEngine {
  constructor(
    readonly db: Database,
    readonly properties: PropertyService,
  ) {}
  async list(
    actor: Actor,
    propertyId: string,
    revision: number,
    serviceId: ProductionRequest["serviceId"],
  ) {
    await authorize(this.db, actor, "read");
    const p = await this.properties.get(actor, Id.parse(propertyId));
    invariant(p.revision === revision, "STALE_REVISION", 409);
    const rows = (
      await this.db.as(actor, (tx) =>
        tx.query<{ id: string }>(
          "select id from production_requests where organization_id=$1 and property_id=$2 and revision=$3 and service_id=$4 and created_by=$5 order by created_at desc,id desc limit 20",
          [actor.organizationId, p.id, revision, serviceId, actor.userId],
        ),
      )
    ).rows;
    const results = [];
    for (const row of rows) results.push(await this.get(actor, row.id));
    return results;
  }
  async plan(actor: Actor, input: unknown): Promise<ProductionRequestView> {
    await authorize(this.db, actor, "edit");
    const v = ProductionRequest.parse(input),
      d = productionService(v.serviceId);
    const property = await this.properties.get(actor, v.propertyId);
    invariant(property.revision === v.revision, "STALE_REVISION", 409);
    invariant(
      Object.keys(v.options).every((k) =>
        d.optionKeys.includes(k as keyof typeof v.options),
      ),
      "SERVICE_OPTIONS_NOT_ALLOWED",
      422,
    );
    if (v.serviceId === "P07" || v.serviceId === "P07b")
      invariant(v.rights.conceptAccepted, "CONCEPT_PERMISSION_REQUIRED", 403);
    invariant(v.serviceId !== "B01", "ACCEPTED_BUNDLE_REQUIRED", 422);
    const records = await this.properties.assets(actor, property.id);
    const sources = v.sourceAssetIds.map((id) => {
      const a = records.find((r) => r.id === id && r.status === "clean");
      invariant(
        a && a.kind === (v.serviceId === "T01" ? "panorama" : "photo"),
        "SERVICE_SOURCE_DENIED",
        403,
      );
      return a;
    });
    invariant(
      new Set(sources.map((a) => a.clean_hash)).size === sources.length,
      "DISTINCT_PHOTOS_REQUIRED",
      409,
    );
    invariant(
      sources.length <=
        (v.serviceId === "T01" ? 12 : v.serviceId === "T02" ? 4 : 1),
      "SERVICE_SOURCE_COUNT",
      422,
    );
    if (v.serviceId === "T01")
      invariant(
        sources.every((a) => a.width === a.height * 2),
        "PANORAMA_2_TO_1_REQUIRED",
        422,
      );
    if (v.serviceId === "P03")
      invariant(
        v.options.roomType && v.options.style,
        "ROOM_AND_STYLE_REQUIRED",
        422,
      );
    const profile = compileServiceProfile(v.serviceId, v.options);
    const fingerprint = digest(
      JSON.stringify({
        ...v,
        sources: sources.map((s) => ({ id: s.id, hash: s.clean_hash })),
        profileHash: profile.profileSha256,
      }),
    );
    const id = await this.db.as(actor, async (tx) => {
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1,571))", [
        "production-admission:" + actor.organizationId,
      ]);
      const lock = await tx.query<{ revision: number }>(
        "select revision from properties where organization_id=$1 and id=$2 and not archived for update",
        [actor.organizationId, property.id],
      );
      invariant(lock.rows[0]?.revision === v.revision, "STALE_REVISION", 409);
      const previous = (
        await tx.query<RequestRow>(
          "select * from production_requests where organization_id=$1 and idempotency_key=$2",
          [actor.organizationId, v.idempotencyKey],
        )
      ).rows[0];
      if (previous) {
        invariant(
          previous.fingerprint === fingerprint &&
            previous.created_by === actor.userId,
          "IDEMPOTENCY_CONFLICT",
          409,
        );
        return previous.id;
      }
      const count = (
        await tx.query<{ n: number }>(
          "select count(*)::int as n from production_requests where organization_id=$1 and state='awaiting-provider-approval'",
          [actor.organizationId],
        )
      ).rows[0]!.n;
      invariant(count < 64, "PRODUCTION_REQUEST_LIMIT", 429);
      const result = newId();
      await tx.query(
        "insert into production_requests(organization_id,id,property_id,revision,service_id,created_by,idempotency_key,fingerprint,profile,options,rights,state) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'awaiting-provider-approval')",
        [
          actor.organizationId,
          result,
          property.id,
          v.revision,
          v.serviceId,
          actor.userId,
          v.idempotencyKey,
          fingerprint,
          JSON.stringify(profile),
          JSON.stringify(v.options),
          JSON.stringify({
            ...v.rights,
            consentVersion: "production-rights-v1",
          }),
        ],
      );
      for (const [position, a] of sources.entries())
        await tx.query(
          "insert into production_sources values($1,$2,$3,$4,$5,$6,$7)",
          [
            actor.organizationId,
            result,
            property.id,
            v.revision,
            a.id,
            a.clean_hash,
            position,
          ],
        );
      await audit(
        tx,
        actor,
        "production.request_saved_provider_disabled",
        result,
      );
      return result;
    });
    return this.get(actor, id);
  }
  async get(actor: Actor, id: string): Promise<ProductionRequestView> {
    await authorize(this.db, actor, "read");
    Id.parse(id);
    const row = (
      await this.db.as(actor, (tx) =>
        tx.query<RequestRow>(
          "select * from production_requests where organization_id=$1 and id=$2",
          [actor.organizationId, id],
        ),
      )
    ).rows[0];
    invariant(row, "REQUEST_NOT_FOUND", 404);
    const property = await this.properties.get(actor, row.property_id);
    invariant(property.revision === row.revision, "STALE_REVISION", 409);
    const sources = (
      await this.db.as(actor, (tx) =>
        tx.query<{ asset_id: string; source_sha256: string }>(
          "select asset_id,source_sha256 from production_sources where organization_id=$1 and request_id=$2 order by position",
          [actor.organizationId, id],
        ),
      )
    ).rows;
    const current = await this.properties.assets(actor, property.id);
    invariant(
      sources.length > 0 &&
        sources.every((s) =>
          current.some(
            (a) =>
              a.id === s.asset_id &&
              a.clean_hash === s.source_sha256 &&
              a.status === "clean",
          ),
        ),
      "REQUEST_SOURCE_DRIFT",
      409,
    );
    const linked =
      row.service_id === "V01"
        ? (
            await this.db.as(actor, (tx) =>
              tx.query<{
                job_id: string;
                mode: string;
                phase: string;
                actual_micro_usd: number | null;
                job_state: string;
              }>(
                "select r.job_id,r.mode,r.phase,r.actual_micro_usd,j.state as job_state from v01_runs r join jobs j on j.organization_id=r.organization_id and j.id=r.job_id where r.organization_id=$1 and r.request_id=$2",
                [actor.organizationId, id],
              ),
            )
          ).rows[0]
        : undefined;
    return {
      id,
      serviceLabel: productionService(row.service_id).labelTR,
      propertyId: property.id,
      revision: row.revision,
      sourceCount: sources.length,
      options: row.options,
      state: row.state,
      ...(linked ? { jobId: linked.job_id } : {}),
      message: linked
        ? linked.mode === "offline-fixture"
          ? "Sentetik offline V01 akışı kayıtlı; gerçek fal üretimi değildir. Sonuç ve inceleme proje ekranındadır."
          : "İzinli V01 sağlayıcı testi kayıtlı; sonuç ve inceleme proje ekranındadır."
        : row.state === "cancelled"
          ? "İstek iptal edildi. Kaynak fotoğrafın saklandı."
          : "Kaynakların ve tercihin kaydedildi. Canlı üretim açılmadığı için işlem başlamadı; ücret alınmadı.",
      futurePriceMicroUsd: null,
      actualExternalCostMicroUsd: linked
        ? linked.mode === "offline-fixture"
          ? 0
          : linked.actual_micro_usd
        : 0,
      downloadAllowed: linked?.job_state === "approved",
      liveEnabled: linked?.mode === "fal-live-test",
    };
  }
  async cancel(actor: Actor, id: string) {
    const currentActor = await authorize(this.db, actor, "edit");
    const current = await this.get(actor, id);
    invariant(!current.jobId, "V01_CANCEL_PATH_REQUIRED", 409);
    await this.db.pg.transaction(async (tx) => {
      const row = (
        await tx.query<RequestRow>(
          "select * from production_requests where organization_id=$1 and id=$2 for update",
          [actor.organizationId, id],
        )
      ).rows[0]!;
      invariant(
        row.created_by === actor.userId || currentActor.role === "admin",
        "REQUEST_OWNER_REQUIRED",
        403,
      );
      // Cancellation cannot establish provider refund/no-charge after acceptance.
      await tx.query(
        "update production_requests set state=$3,fence=fence+1 where organization_id=$1 and id=$2",
        [
          actor.organizationId,
          id,
          row.provider_request_id ? "qa-held" : "cancelled",
        ],
      );
      await audit(tx, actor, "production.cancel_requested", id);
    });
    return this.get(actor, id);
  }
  /** No HTTP webhook is exposed. Future server worker supplies trusted keyset/account identity. Only hashes/status survive. */
  async recordFalCallback(
    body: Uint8Array,
    headers: Headers,
    trusted: {
      fetchedAtMs: number;
      keys: readonly unknown[];
      providerUserId: string;
    },
    nowMs: number,
  ) {
    const requestId = headers.get("x-fal-webhook-request-id");
    invariant(
      requestId && /^[A-Za-z0-9_-]{1,120}$/.test(requestId),
      "UNKNOWN_PROVIDER_REQUEST",
      403,
    );
    const initial = (
      await this.db.pg.query<RequestRow>(
        "select * from production_requests where provider_request_id=$1",
        [requestId],
      )
    ).rows[0];
    invariant(
      initial && productionService(initial.service_id).provider === "fal",
      "UNKNOWN_PROVIDER_REQUEST",
      403,
    );
    const event = verifyFalWebhook(
      body,
      headers,
      { requestId, providerUserId: trusted.providerUserId },
      trusted,
      nowMs,
    );
    return this.db.pg.transaction(async (tx) => {
      const r = (
        await tx.query<RequestRow>(
          "select * from production_requests where organization_id=$1 and id=$2 for update",
          [initial.organization_id, initial.id],
        )
      ).rows[0]!;
      const duplicate =
        (
          await tx.query(
            "select body_sha256 from provider_callback_inbox where organization_id=$1 and request_id=$2 and body_sha256=$3",
            [r.organization_id, r.id, event.bodySha256],
          )
        ).rows.length > 0;
      if (duplicate)
        return { duplicate: true, state: r.state, delivered: false };
      await tx.query(
        "insert into provider_callback_inbox(organization_id,request_id,provider_request_id,body_sha256,event_status) values($1,$2,$3,$4,$5)",
        [r.organization_id, r.id, requestId, event.bodySha256, event.status],
      );
      // Output bytes/provenance/privacy and current source must be verified separately. Callback never approves or grants download.
      if (r.state !== "cancelled" && r.state !== "rejected")
        await tx.query(
          "update production_requests set state='qa-held' where organization_id=$1 and id=$2",
          [r.organization_id, r.id],
        );
      return {
        duplicate: false,
        state:
          r.state === "cancelled" || r.state === "rejected"
            ? r.state
            : "qa-held",
        delivered: false,
      };
    });
  }
}
