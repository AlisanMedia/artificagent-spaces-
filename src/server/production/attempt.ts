import { invariant } from "@/domain/platform";
export type AttemptState =
  | "READY"
  | "SUBMITTING"
  | "QUEUED"
  | "PROCESSING"
  | "RECEIVED"
  | "HOLD_UNKNOWN"
  | "CANCELLED"
  | "FAILED";
/** Protocol reducer exercised offline. A durable worker/queue scheduler is still a hosted release gate. */
export class ProductionAttempt {
  state: AttemptState = "READY";
  attempts = 0;
  polls = 0;
  fence = 0;
  reservedMicroUsd = 0;
  actualMicroUsd: number | null = null;
  begin(
    knownPriceMicroUsd: number | null,
    ownerCapMicroUsd: number,
    expectedFence: number,
  ) {
    invariant(
      expectedFence === this.fence && this.state === "READY",
      "ATTEMPT_FENCED",
      409,
    );
    invariant(
      knownPriceMicroUsd !== null &&
        Number.isSafeInteger(knownPriceMicroUsd) &&
        knownPriceMicroUsd >= 0 &&
        knownPriceMicroUsd <= ownerCapMicroUsd,
      "PRICE_OR_SPEND_CAP_REQUIRED",
      402,
    );
    invariant(
      knownPriceMicroUsd === 0 && ownerCapMicroUsd === 0,
      "BLOCKED_EXTERNAL_APPROVAL",
      403,
    );
    invariant(this.attempts < 2, "ATTEMPT_LIMIT", 429);
    this.attempts++;
    this.actualMicroUsd = null;
    this.state = "SUBMITTING";
    this.reservedMicroUsd = knownPriceMicroUsd;
  }
  submitted(acceptance: "accepted" | "known-not-accepted" | "unknown") {
    invariant(this.state === "SUBMITTING", "ATTEMPT_STATE", 409);
    this.state =
      acceptance === "accepted"
        ? "QUEUED"
        : acceptance === "unknown"
          ? "HOLD_UNKNOWN"
          : this.attempts < 2
            ? "READY"
            : "FAILED";
    if (acceptance === "known-not-accepted") {
      this.actualMicroUsd = 0;
      this.reservedMicroUsd = 0;
    }
  }
  poll(
    result: "queued" | "processing" | "received" | "timeout",
    expectedFence: number,
    sourceGrantExpiresAt: number,
    now: number,
  ) {
    invariant(
      expectedFence === this.fence &&
        ["QUEUED", "PROCESSING"].includes(this.state),
      "ATTEMPT_FENCED",
      409,
    );
    if (
      sourceGrantExpiresAt <= now ||
      ++this.polls > 12 ||
      result === "timeout"
    ) {
      this.state = "HOLD_UNKNOWN";
      return;
    }
    this.state =
      result === "received"
        ? "RECEIVED"
        : result === "processing"
          ? "PROCESSING"
          : "QUEUED";
  }
  cancel() {
    this.fence++;
    this.state = ["READY", "FAILED"].includes(this.state)
      ? "CANCELLED"
      : "HOLD_UNKNOWN";
    // Unknown accepted work cannot release its reserve or invent a refund/cost.
  }
}
