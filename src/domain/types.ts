type Id<Tag extends string> = string & { readonly __kind: Tag };
export type OrganizationId = Id<"organization">;
export type PropertyId = Id<"property">;
export type AssetId = Id<"asset">;

export interface WorkspaceScope {
  readonly organizationId: OrganizationId;
}

export type GenerationMode = "pov" | "cinematic" | "hybrid" | "interactive-3d";
export type AspectRatio = "16:9" | "9:16";
export type VideoDuration = 30 | 60;
export type EvidenceClass = "visual-evidence" | "spatial-verified";

export interface Organization {
  readonly id: OrganizationId;
  readonly name: string;
  readonly initials: string;
}

export interface MediaAsset {
  readonly id: AssetId;
  readonly organizationId: OrganizationId;
  readonly propertyId: PropertyId;
  readonly label: string;
  readonly path: string;
  readonly kind: "illustration" | "floor-plan";
  readonly source: "synthetic";
}

export interface Property {
  readonly id: PropertyId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly reference: string;
  readonly location: string;
  readonly category: "Daire" | "Villa" | "Konaklama";
  readonly areaM2: number;
  readonly rooms: string;
  readonly cover: string;
  readonly evidenceClass: EvidenceClass;
  readonly status: "review-ready" | "draft" | "evidence-needed";
  readonly description: string;
  readonly media: readonly MediaAsset[];
  readonly roomLabels: readonly string[];
}

interface VideoConfiguration {
  readonly durationSeconds: VideoDuration;
  readonly aspectRatio: AspectRatio;
}

export type GenerationConfiguration =
  | (VideoConfiguration & { readonly mode: "pov"; readonly cameraPace: "calm" | "balanced" })
  | (VideoConfiguration & { readonly mode: "cinematic"; readonly style: "editorial" | "soft"; readonly captions: boolean })
  | (VideoConfiguration & { readonly mode: "hybrid"; readonly povSharePercent: 25 | 50 | 75 })
  | { readonly mode: "interactive-3d"; readonly quality: "balanced" | "detailed"; readonly daypart: "day" | "dusk" };

export interface PreviewRequest {
  readonly organizationId: OrganizationId;
  readonly propertyId: PropertyId;
  readonly sourceAssetIds: readonly AssetId[];
  readonly configuration: GenerationConfiguration;
}

export interface StoryboardShot {
  readonly sequence: number;
  readonly roomLabel: string;
  readonly direction: string;
  readonly sourceAssetId: AssetId;
}

export interface PreviewPlan {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly propertyId: PropertyId;
  readonly mode: GenerationMode;
  readonly configuration: GenerationConfiguration;
  readonly kind: "storyboard" | "scene-plan";
  readonly adapter: "deterministic-local-fake";
  readonly syntheticOnly: true;
  readonly actualCostMicroUsd: 0;
  readonly disclosure: string;
  readonly shots: readonly StoryboardShot[];
  readonly checks: readonly string[];
}

export type DomainErrorCode =
  | "INVALID_CONFIGURATION"
  | "UNSUPPORTED_SETTING"
  | "PROPERTY_NOT_AVAILABLE"
  | "TENANT_SCOPE_MISMATCH"
  | "SOURCE_NOT_AVAILABLE"
  | "INSUFFICIENT_EVIDENCE";

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DomainError };
