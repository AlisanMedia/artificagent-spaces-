import type { ReferenceVideoProvider } from "@/contracts/video-generation";
import type {
  GeneratedShotArtifact,
  GenerationCapabilities,
  ShotIntentValue,
} from "@/domain/video-generation";
/** Actual local renderer/artifact verifier injected by the caller. Never substitutes fixture JSON for video. */
export class LocalReferenceVideoProvider implements ReferenceVideoProvider {
  readonly capabilities: GenerationCapabilities = {
    modelId: "synthetic-local-v4",
    revision: "1",
    local: true,
    enabled: true,
    kinds: ["image", "video"],
    resolutions: ["360p"],
    aspects: ["16:9", "9:16"],
    minSeconds: 4,
    maxSeconds: 16,
    tariff: {
      outputSecondMicroUsd: 0,
      inputVideoSecondMicroUsd: 0,
      minimumMicroUsd: 0,
      verifiedSource: "ZERO_EXTERNAL_SYNTHETIC_ONLY",
    },
  };
  constructor(
    readonly render: (
      shot: ShotIntentValue,
      signal: AbortSignal,
    ) => Promise<GeneratedShotArtifact>,
    readonly verifyArtifact: (
      artifact: GeneratedShotArtifact,
      shot: ShotIntentValue,
    ) => Promise<boolean>,
  ) {}
  generate(
    shot: ShotIntentValue,
    context: { signal: AbortSignal; attempt: number },
  ) {
    context.signal.throwIfAborted();
    return this.render(shot, context.signal);
  }
}
