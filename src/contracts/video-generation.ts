import type {
  GenerationCapabilities,
  GeneratedShotArtifact,
  ShotIntentValue,
} from "@/domain/video-generation";
export interface ReferenceVideoProvider {
  readonly capabilities: GenerationCapabilities;
  verifyArtifact(
    artifact: GeneratedShotArtifact,
    shot: ShotIntentValue,
  ): Promise<boolean>;
  generate(
    shot: ShotIntentValue,
    context: { readonly signal: AbortSignal; readonly attempt: number },
  ): Promise<GeneratedShotArtifact>;
}
export type ProviderFailureCategory =
  | "KNOWN_NOT_ACCEPTED"
  | "UNKNOWN_ACCEPTANCE"
  | "MODERATION_REJECTED"
  | "OUTPUT_INVALID";
export class SyntheticProviderFailure extends Error {
  constructor(readonly category: ProviderFailureCategory) {
    super(category);
  }
}
