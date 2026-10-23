import { invariant } from "@/domain/platform";
import {
  validateShotScope,
  shotCostBound,
  validateGeneratedShot,
  type ApprovedShotScope,
  type GeneratedShotArtifact,
} from "@/domain/video-generation";
import {
  SyntheticProviderFailure,
  type ReferenceVideoProvider,
} from "@/contracts/video-generation";
export interface ReadinessRun {
  state:
    | "PROCESSING"
    | "COMPLETED_SYNTHETIC"
    | "FAILED"
    | "CANCELLED"
    | "HOLD_UNKNOWN";
  reservedMicroUsd: number;
  chargedMicroUsd: number;
  releasedMicroUsd: number;
  attempts: { attempt: number; outcome: string; costMicroUsd: number }[];
  artifact: GeneratedShotArtifact | null;
}
/** Contract harness only: real durable jobs remain the authoritative workflow. No vendor transport or credential path. */
export class ProviderReadinessHarness {
  private calls = new Map<
    string,
    { fingerprint: string; result: Promise<ReadinessRun> }
  >();
  private controls = new Map<string, AbortController>();
  constructor(
    readonly provider: ReferenceVideoProvider,
    readonly scope: ApprovedShotScope,
    readonly budgetMicroUsd = 0,
    readonly maxAttempts = 2,
    readonly timeoutMs = 1000,
  ) {
    invariant(
      Number.isSafeInteger(budgetMicroUsd) &&
        budgetMicroUsd >= 0 &&
        maxAttempts >= 1 &&
        maxAttempts <= 2 &&
        Number.isInteger(maxAttempts) &&
        timeoutMs >= 1 &&
        timeoutMs <= 90000,
      "INVALID_PROVIDER_POLICY",
    );
  }
  cancel(idempotencyKey: string) {
    this.controls.get(idempotencyKey)?.abort();
  }
  submit(input: unknown): Promise<ReadinessRun> {
    const shot = validateShotScope(
        input,
        this.scope,
        this.provider.capabilities,
      ),
      cap = this.provider.capabilities,
      cost = shotCostBound(shot, cap);
    invariant(cost <= this.budgetMicroUsd, "PROVIDER_SPEND_CAP_EXCEEDED", 402);
    invariant(cap.local && cap.enabled, "BLOCKED_EXTERNAL_APPROVAL", 403);
    invariant(cost === 0, "SYNTHETIC_SPEND_MUST_BE_ZERO", 402);
    const fingerprint = JSON.stringify(shot),
      old = this.calls.get(shot.idempotencyKey);
    if (old) {
      invariant(old.fingerprint === fingerprint, "IDEMPOTENCY_CONFLICT", 409);
      return old.result;
    }
    invariant(this.calls.size < 32, "PROVIDER_LOCAL_HARNESS_LIMIT", 429);
    const control = new AbortController();
    this.controls.set(shot.idempotencyKey, control);
    const result = (async () => {
      const state: ReadinessRun = {
        state: "PROCESSING",
        reservedMicroUsd: cost,
        chargedMicroUsd: 0,
        releasedMicroUsd: 0,
        attempts: [],
        artifact: null,
      };
      for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let timedOut = false;
        try {
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              timedOut = true;
              control.abort();
              reject(new SyntheticProviderFailure("UNKNOWN_ACCEPTANCE"));
            }, this.timeoutMs);
          });
          const artifact = await Promise.race([
            this.provider.generate(shot, { signal: control.signal, attempt }),
            timeout,
          ]);
          if (control.signal.aborted) {
            state.state = "CANCELLED";
            state.attempts.push({
              attempt,
              outcome: "LATE_RESULT_FENCED",
              costMicroUsd: 0,
            });
            break;
          }
          validateGeneratedShot(artifact, shot, cost);
          invariant(
            await this.provider.verifyArtifact(artifact, shot),
            "GENERATED_ARTIFACT_BYTES_NOT_VERIFIED",
            409,
          );
          invariant(!control.signal.aborted, "PROVIDER_CANCEL_FENCE", 409);
          state.artifact = artifact;
          state.chargedMicroUsd = artifact.billedMicroUsd;
          state.state = "COMPLETED_SYNTHETIC";
          state.attempts.push({
            attempt,
            outcome: "SYNTHETIC_ONLY",
            costMicroUsd: artifact.billedMicroUsd,
          });
          break;
        } catch (e) {
          const category =
            e instanceof SyntheticProviderFailure
              ? e.category
              : "OUTPUT_INVALID";
          state.attempts.push({ attempt, outcome: category, costMicroUsd: 0 });
          if (timedOut || category === "UNKNOWN_ACCEPTANCE") {
            state.state = "HOLD_UNKNOWN";
            break;
          }
          if (control.signal.aborted) {
            state.state = "CANCELLED";
            break;
          }
          if (category === "KNOWN_NOT_ACCEPTED" && attempt < this.maxAttempts)
            continue;
          state.state = "FAILED";
          break;
        } finally {
          clearTimeout(timer);
        }
      }
      if (state.state !== "HOLD_UNKNOWN")
        state.releasedMicroUsd = cost - state.chargedMicroUsd;
      return state;
    })();
    this.calls.set(shot.idempotencyKey, { fingerprint, result });
    void result.finally(()=>this.controls.delete(shot.idempotencyKey));
    return result;
  }
}
