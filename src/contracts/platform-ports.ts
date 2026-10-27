import type { CaptionLayout, ShotProvenance } from "@/domain/video-quality";
import type { ShotPlan } from "@/domain/shots";
import type { Scene, ViewerAction } from "@/domain/platform";

export interface ProviderEvidence {
  readonly provider: string;
  readonly candidate: string;
  readonly officialModelId: string | null;
  readonly revision: string | null;
  readonly region: string | null;
  readonly termsReviewed: boolean;
  readonly pricingMicroUsd: number | null;
  readonly verifiedAt: string | null;
  readonly sourceUrls: readonly string[];
  readonly enabled: false;
}
export interface MediaSubmission {
  readonly organizationId: string;
  readonly propertyId: string;
  readonly revision: number;
  readonly mode: "pov" | "cinematic" | "hybrid";
  readonly sourceHashes: readonly string[];
  readonly maxCostMicroUsd: number;
  readonly eyeHeightMeters: 1.65;
  readonly firstPerson: boolean;
  readonly forbiddenClaims: readonly string[];
}
export interface VideoProvider {
  readonly evidence: ProviderEvidence;
  prepare(input: unknown): MediaSubmission;
  submit(input: MediaSubmission): Promise<never>;
}
export interface PropertyVoiceProvider {
  readonly kind: "deterministic-local" | "elevenlabs-disabled";
  createSession(context: {
    readonly organizationId: string;
    readonly propertyId: string;
    readonly revision: number;
    readonly approvedScene: Scene;
    readonly visitorConsent: boolean;
  }): Promise<{ readonly localSessionId: string; readonly disclosure: string }>;
}
export interface GuideReply {
  readonly text: string;
  readonly category:
    | "intro"
    | "measurement"
    | "navigation"
    | "daypart"
    | "staging"
    | "contact"
    | "unknown"
    | "security";
  readonly command: ViewerAction | null;
  readonly evidenceIds: readonly string[];
  readonly simulated: true;
}
export interface OutputEvidence {
  readonly auxiliaryBytes?: number;
  readonly photoComposition?: {
    readonly version: "property-video-v1";
    readonly styleId: string;
    readonly requestedDurationSeconds: number;
    readonly clipSeconds: 5;
    readonly fit: "letterbox";
    readonly actualProvider: "local-ffmpeg";
    readonly plannedProvider: "fal";
    readonly plannedModel: string;
    readonly clips: readonly {
      readonly order: number;
      readonly artifactId: string;
      readonly sourceAssetId: string;
      readonly sourceSha256: string;
      readonly sha256: string;
      readonly bytes: number;
      readonly durationSeconds: number;
    }[];
  };
  readonly nativeRenderMetrics?: {
    readonly ffmpegExitCode: 0;
    readonly ffmpegWallTimeMs: number;
  };
  readonly renderProfile?: {
    readonly id: string;
    readonly labOnly: boolean;
    readonly width: number;
    readonly height: number;
    readonly durationSeconds: number;
  };
  readonly captionLayout?: CaptionLayout | null;
  readonly shotProvenance?: readonly ShotProvenance[];
  readonly brandSnapshot?: {
    displayName: string;
    logoSha256: string | null;
  } | null;
  readonly artifactId?: string;
  readonly manifestSha256?: string;
  readonly colorSpace?: "bt709-sdr";
  readonly cameraPlan?: ShotPlan | null;
  readonly kind: "image-motion-demo" | "parametric-mesh";
  readonly mime: "video/mp4" | "model/gltf-binary";
  readonly extension: "mp4" | "glb";
  readonly durationSeconds: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly codec: string | null;
  readonly bytes: number;
  readonly sha256: string;
  readonly wallTimeMs: number;
  readonly actualExternalCostMicroUsd: 0;
  readonly sourceHashes: readonly string[];
  readonly manifestRevision: number;
  readonly qa: {
    readonly integrity: true;
    readonly architecturalFidelity: "HUMAN_REVIEW_REQUIRED";
    readonly disclosure: string;
  };
}
