import { z } from "zod";
import { invariant } from "@/domain/platform";
import type { Database } from "./database";
import { digest, newId, type Secrets } from "./crypto";

export const COMMERCIAL_PLAN = Object.freeze({
  id: "local-lab",
  version: 1,
  currency: "USD",
  priceMicroUsd: null,
  commercialPriceApproved: false,
  livePayments: false,
  maxTenantJobs: 3,
  maxVoiceSessions: 3,
  maxVoiceMinutes: 5,
  externalSpendLimitMicroUsd: 0,
});
/** In-process signed callback simulator only. No payment SDK/account/HTTP endpoint or real funds. */
export class SandboxPayments {
  constructor(
    readonly db: Database,
    readonly secrets: Secrets,
  ) {}
  async callback(body: string, signature: string) {
    const value = z
      .object({
        organizationId: z.string().regex(/^[A-Za-z0-9_-]+$/),
        eventId: z.string().regex(/^[A-Za-z0-9_-]+$/),
        amountMicroUsd: z.number().int().min(0).max(1000000),
        mode: z.literal("synthetic-sandbox"),
        actualFunds: z.literal(false),
      })
      .strict()
      .parse(JSON.parse(body));
    this.secrets.tenant(value.organizationId).verifyWebhook(body, signature);
    const hash = digest(body);
    return this.db.pg.transaction(async (tx) => {
      await tx.query(
        "select organization_id from credit_accounts where organization_id=$1 for update",
        [value.organizationId],
      );
      const previous = (
        await tx.query<{ body_hash: string }>(
          "select body_hash from sandbox_payment_events where organization_id=$1 and id=$2",
          [value.organizationId, value.eventId],
        )
      ).rows[0];
      if (previous) {
        invariant(previous.body_hash === hash, "PAYMENT_REPLAY_CONFLICT", 409);
        return { deduplicated: true, realFundsMoved: false };
      }
      const updated = await tx.query(
        "update credit_accounts set available=available+$2 where organization_id=$1 returning organization_id",
        [value.organizationId, value.amountMicroUsd],
      );
      invariant(updated.rows.length === 1, "UNKNOWN_SANDBOX_ACCOUNT", 404);
      await tx.query(
        "insert into sandbox_payment_events values($1,$2,$3,$4,now())",
        [value.organizationId, value.eventId, hash, value.amountMicroUsd],
      );
      await tx.query(
        "insert into cost_ledger values($1,$2,$3,'sandbox-credit',$4,$5,now())",
        [
          value.organizationId,
          newId(),
          "sandbox:" + value.eventId,
          value.amountMicroUsd,
          JSON.stringify({ actualFunds: false, mode: "synthetic-sandbox" }),
        ],
      );
      return {
        creditedSimulatedMicroUsd: value.amountMicroUsd,
        realFundsMoved: false,
      };
    });
  }
}
