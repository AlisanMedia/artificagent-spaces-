import { invariant } from "@/domain/platform";
export interface ProviderAttemptBinding {
  readonly organizationId: string;
  readonly propertyId: string;
  readonly revision: number;
  readonly sourceFingerprint: string;
  readonly fence: string;
}
/** Offline contract reducer, not a live worker. Existing durable jobs/outbox/ledger stay authoritative. */
export class OfflineProviderAttempt {
  state:
    | "PREPARED"
    | "PROCESSING"
    | "HOLD_UNKNOWN"
    | "QA_HOLD"
    | "FAILED"
    | "CANCELLED" = "PREPARED";
  attempts = 0;
  providerRequestId: string | null = null;
  private readonly events = new Set<string>();
  constructor(
    readonly binding: ProviderAttemptBinding,
    readonly idempotencyKey: string,
    readonly fingerprint: string,
  ) {}
  recordSubmission(
    key: string,
    fingerprint: string,
    result:
      | { kind: "ACCEPTED_MOCK"; requestId: string }
      | { kind: "KNOWN_NOT_ACCEPTED" }
      | { kind: "UNKNOWN_ACCEPTANCE" },
  ) {
    invariant(
      key === this.idempotencyKey && fingerprint === this.fingerprint,
      "IDEMPOTENCY_CONFLICT",
      409,
    );
    invariant(
      this.state === "PREPARED" && this.attempts < 2,
      "AUTOMATIC_RESUBMIT_DENIED",
      409,
    );
    this.attempts++;
    if (result.kind === "UNKNOWN_ACCEPTANCE") this.state = "HOLD_UNKNOWN";
    else if (result.kind === "KNOWN_NOT_ACCEPTED")
      this.state = this.attempts < 2 ? "PREPARED" : "FAILED";
    else {
      this.providerRequestId = result.requestId;
      this.state = "PROCESSING";
    }
    return this.state;
  }
  cancel() {
    this.state = "CANCELLED";
  }
  receive(
    event: {
      requestId: string;
      bodySha256: string;
      authenticated: boolean;
      status: "OK" | "ERROR";
    },
    current: ProviderAttemptBinding,
  ) {
    invariant(
      event.authenticated &&
        Object.keys(this.binding).every(
          (key) =>
            this.binding[key as keyof ProviderAttemptBinding] ===
            current[key as keyof ProviderAttemptBinding],
        ) &&
        event.requestId === this.providerRequestId,
      "PROVIDER_CALLBACK_SCOPE_DENIED",
      403,
    );
    if (this.events.has(event.bodySha256))
      return { duplicate: true, state: this.state };
    invariant(this.events.size < 8, "PROVIDER_CALLBACK_LIMIT", 429);
    invariant(this.state === "PROCESSING", "LATE_PROVIDER_RESULT_FENCED", 409);
    this.events.add(event.bodySha256);
    this.state = event.status === "OK" ? "QA_HOLD" : "FAILED";
    return { duplicate: false, state: this.state };
  }
}
