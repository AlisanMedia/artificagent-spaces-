import { z } from "zod";
import { invariant, Id } from "@/domain/platform";
import type { Database } from "./database";
import { digest, type Secrets } from "./crypto";

/** Offline-tested optional ingestion. No externally reachable webhook is registered or enabled.
 * organizationId comes from trusted server endpoint configuration, never the provider payload.
 * Only structured duration/status is retained; transcript/audio/subjective sales labels are discarded.
 */
export class VoiceInsightWebhook {
  constructor(
    readonly db: Database,
    readonly webhookSecrets: Secrets,
  ) {}
  async ingest(organizationId: string, rawBody: string, signature: string) {
    Id.parse(organizationId);
    invariant(Buffer.byteLength(rawBody) <= 65536, "WEBHOOK_BODY_LIMIT", 413);
    this.webhookSecrets
      .tenant(organizationId)
      .verifyWebhook(rawBody, signature);
    const value = z
      .object({
        type: z.enum(["post_call_transcription", "call_initiation_failure"]),
        event_timestamp: z.number().int().positive(),
        data: z.object({
          conversation_id: z.string().min(1).max(200),
          status: z.enum(["done", "failed"]).optional(),
          metadata: z
            .object({ call_duration_secs: z.number().int().min(0).max(300) })
            .optional(),
        }),
      })
      .parse(JSON.parse(rawBody));
    invariant(
      Math.abs(Date.now() / 1000 - value.event_timestamp) <= 300,
      "STALE_PROVIDER_EVENT",
      403,
    );
    return this.db.pg.transaction(async (tx) => {
      const row = (
        await tx.query<{
          id: string;
          property_id: string;
          revision: number;
          session_id: string;
        }>(
          "select v.id,v.property_id,v.revision,v.session_id from voice_sessions v join anonymous_sessions a on a.organization_id=v.organization_id and a.id=v.session_id join publications pub on pub.organization_id=v.organization_id and pub.id=v.body->>'publicationId' join properties p on p.organization_id=v.organization_id and p.id=v.property_id where v.organization_id=$1 and v.body->>'providerConversationId'=$2 and (a.body->'consent'->>'analytics')::boolean and not pub.revoked and pub.expires_at>now() and a.expires_at>now() and p.revision=v.revision and not p.archived",
          [organizationId, value.data.conversation_id],
        )
      ).rows[0];
      invariant(row, "UNISSUED_OR_UNCONSENTED_CONVERSATION", 403);
      const id = digest(value.type + ":" + value.data.conversation_id);
      const inserted = await tx.query(
        "insert into voice_quality_reviews(organization_id,id,property_id,revision,session_id,body,expires_at) values($1,$2,$3,$4,$5,$6,now()+interval '1 day') on conflict do nothing returning id",
        [
          organizationId,
          id,
          row.property_id,
          row.revision,
          row.id,
          JSON.stringify({
            type: value.type,
            status: value.data.status ?? "UNKNOWN",
            reportedDurationSeconds:
              value.data.metadata?.call_duration_secs ?? null,
            rawTranscriptStored: false,
            commercialTruth: false,
            providerClaimsUntrusted: true,
          }),
        ],
      );
      return {
        processed: inserted.rows.length === 1,
        deduplicated: inserted.rows.length === 0,
        realBookingConfirmed: false,
        rawTranscriptStored: false,
      };
    });
  }
}
