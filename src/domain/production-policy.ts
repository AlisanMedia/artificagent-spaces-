import { invariant, microUsd } from "./platform";

export type AttemptDisposition = "retry-local" | "hold-unknown" | "stop";
export function attemptDisposition(input: {
  providerAccepted: boolean | null;
  attempt: number;
  local: boolean;
  cancelled: boolean;
  maxAttempts: number;
}): AttemptDisposition {
  invariant(
    Number.isInteger(input.attempt) &&
      input.attempt >= 1 &&
      Number.isInteger(input.maxAttempts) &&
      input.maxAttempts >= 1 &&
      input.maxAttempts <= 3,
    "INVALID_ATTEMPT_POLICY",
  );
  if (input.cancelled || input.attempt >= input.maxAttempts) return "stop";
  if (!input.local && input.providerAccepted === null) return "hold-unknown";
  return input.local && input.providerAccepted === false
    ? "retry-local"
    : "stop";
}
export class CircuitBreaker {
  private failures = 0;
  private openedUntil = 0;
  constructor(
    readonly threshold = 3,
    readonly cooldownMs = 30000,
  ) {
    invariant(threshold > 0 && cooldownMs > 0, "INVALID_CIRCUIT_POLICY");
  }
  allows(now: number) {
    return now >= this.openedUntil;
  }
  success() {
    this.failures = 0;
    this.openedUntil = 0;
  }
  failure(now: number) {
    if (++this.failures >= this.threshold)
      this.openedUntil = now + this.cooldownMs;
  }
}
export function acceptedOutputEconomics(input: {
  attempted: number;
  accepted: number;
  inferenceMicroUsd: number;
  retryMicroUsd: number;
  workerMicroUsd: number;
  storageMicroUsd: number;
  voiceMicroUsd: number;
}) {
  invariant(
    Number.isInteger(input.attempted) &&
      Number.isInteger(input.accepted) &&
      input.accepted >= 0 &&
      input.attempted >= input.accepted,
    "INVALID_ACCEPTANCE_COUNTS",
  );
  const totalMicroUsd =
    microUsd(input.inferenceMicroUsd) +
    microUsd(input.retryMicroUsd) +
    microUsd(input.workerMicroUsd) +
    microUsd(input.storageMicroUsd) +
    microUsd(input.voiceMicroUsd);
  microUsd(totalMicroUsd);
  return {
    totalMicroUsd,
    perAcceptedMicroUsd: input.accepted
      ? Math.ceil(totalMicroUsd / input.accepted)
      : null,
    acceptanceRate: input.attempted ? input.accepted / input.attempted : null,
    margin: "UNKNOWN_UNTIL_APPROVED_PRICING_AND_MEASURED_COSTS" as const,
  };
}
