import { z } from "zod";
import { Id, invariant } from "./platform";
import { PropertyStyle, propertyPrompt } from "./real-estate-prompts";

export const StudioPlanRequest = z
  .object({
    propertyId: Id,
    revision: z.number().int().positive(),
    product: z.enum(["video", "ai-3d", "tour-360"]),
    styleId: PropertyStyle.default("natural"),
    requestedDurationSeconds: z
      .union([z.literal(30), z.literal(45), z.literal(60)])
      .default(30),
    aspectRatio: z.enum(["16:9", "9:16"]).default("9:16"),
    sourceAssetIds: z.array(Id).min(1).max(12),
    panoramaConfirmed: z.boolean().default(false),
  })
  .strict();
export const ApprovedPhoto = z
  .object({
    organizationId: Id,
    propertyId: Id,
    revision: z.number().int().positive(),
    assetId: Id,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    bytes: z.number().int().positive().max(5_242_880),
    kind: z.enum(["photo", "panorama"]),
    roomId: Id.optional(),
  })
  .strict();
export type ApprovedPhotoReference = z.infer<typeof ApprovedPhoto>;
export interface ApprovedPhotoScope {
  readonly organizationId: string;
  readonly propertyId: string;
  readonly revision: number;
  readonly sources: readonly ApprovedPhotoReference[];
}
export function selectScopedPhotos(input: unknown, scope: ApprovedPhotoScope) {
  const request = StudioPlanRequest.parse(input);
  invariant(
    request.propertyId === scope.propertyId &&
      request.revision === scope.revision,
    "STUDIO_SCOPE_OR_REVISION_DENIED",
    403,
  );
  invariant(
    new Set(request.sourceAssetIds).size === request.sourceAssetIds.length,
    "DUPLICATE_MEDIA",
    409,
  );
  const photos = request.sourceAssetIds.map((id) => {
    const source = scope.sources.find((s) => s.assetId === id);
    invariant(source, "MEDIA_SCOPE_DENIED", 403);
    const photo = ApprovedPhoto.parse(source);
    invariant(
      photo.organizationId === scope.organizationId &&
        photo.propertyId === scope.propertyId &&
        photo.revision === scope.revision,
      "MEDIA_SCOPE_DENIED",
      403,
    );
    return photo;
  });
  invariant(
    new Set(photos.map((s) => s.sha256)).size === photos.length,
    "DISTINCT_PHOTOS_REQUIRED",
    409,
  );
  return { request, photos };
}
export function planStudioProduct(input: unknown, scope: ApprovedPhotoScope) {
  const { request, photos } = selectScopedPhotos(input, scope);
  if (request.product === "tour-360") {
    invariant(
      photos.every((p) => p.width === p.height * 2),
      "PANORAMA_2_TO_1_REQUIRED",
      422,
    );
    invariant(request.panoramaConfirmed, "PANORAMA_CONFIRMATION_REQUIRED", 422);
  }
  const prompt = propertyPrompt(request.styleId);
  const neededPhotos = request.requestedDurationSeconds / 5;
  const used = photos.slice(0, neededPhotos);
  return {
    schemaVersion: "spaces-studio-v54" as const,
    product: request.product,
    panoramaConfirmed:
      request.product === "tour-360" && request.panoramaConfirmed,
    propertyId: scope.propertyId,
    revision: scope.revision,
    aspectRatio: request.aspectRatio,
    requestedDurationSeconds: request.requestedDurationSeconds,
    availablePhotos: photos.length,
    neededPhotos,
    suggestedDurationSeconds: used.length * 5,
    sufficientSources:
      request.product !== "video" || photos.length >= neededPhotos,
    plannedResolution: "1080p" as const,
    liveEnabled: false as const,
    actualExternalCostMicroUsd: 0 as const,
    futureProviderQuoteMicroUsd: null,
    requiresIndependentReview: true as const,
    blockers:
      request.product === "ai-3d"
        ? ["BLOCKED_LEGAL_APPROVAL", "BLOCKED_EXTERNAL_APPROVAL"]
        : ["BLOCKED_EXTERNAL_APPROVAL"],
    shots:
      request.product === "video"
        ? used.map((source, index) => ({
            order: index,
            assetId: source.assetId,
            sourceSha256: source.sha256,
            organizationId: scope.organizationId,
            propertyId: scope.propertyId,
            revision: scope.revision,
            styleId: request.styleId,
            promptVersion: prompt.version,
            plannedProvider: "fal" as const,
            plannedModel: prompt.endpoint,
            durationSeconds: 5 as const,
            fit: "letterbox" as const,
            actualProvider: "NOT_SUBMITTED" as const,
          }))
        : [],
    sourceHashes: photos.map((s) => s.sha256),
  };
}
export type StudioProductPlan = ReturnType<typeof planStudioProduct>;
export const STUDIO_JOB_PHASES = Object.freeze([
  "draft",
  "awaiting-rights",
  "awaiting-provider-approval",
  "queued",
  "processing",
  "received",
  "qa-held",
  "awaiting-review",
  "approved",
  "downloadable",
  "failed",
  "cancelled",
] as const);
export function localJobPhase(state: string) {
  const mapping: Record<string, string> = {
    queued: "queued",
    processing: "processing",
    "awaiting-review": "awaiting-review",
    approved: "approved",
    rejected: "qa-held",
    "unknown-submission": "qa-held",
    failed: "failed",
    cancelled: "cancelled",
  };
  return mapping[state] ?? "draft";
}
