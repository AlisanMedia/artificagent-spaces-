import {
  StudioPlanRequest,
  planStudioProduct,
  type ApprovedPhotoReference,
} from "@/domain/api-first-studio";
import { invariant } from "@/domain/platform";
import type { StudioPlanView } from "@/contracts/studio-ui";
import type { Actor, Database } from "./database";
import { authorize, type PropertyService } from "./properties";
import { digest } from "./crypto";

/** Scoped read-only planning: no ledger reservation, provider submission, secret lookup or remote URL. */
export async function prepareStudioPlan(
  db: Database,
  properties: PropertyService,
  actor: Actor,
  input: unknown,
): Promise<StudioPlanView> {
  await authorize(db, actor, "edit");
  const request = StudioPlanRequest.parse(input);
  const property = await properties.get(actor, request.propertyId);
  invariant(property.revision === request.revision, "STALE_REVISION", 409);
  const records = await properties.assets(actor, property.id);
  const sources: ApprovedPhotoReference[] = records
    .filter(
      (a) =>
        a.status === "clean" && (a.kind === "photo" || a.kind === "panorama"),
    )
    .map((a) => ({
      organizationId: actor.organizationId,
      propertyId: property.id,
      revision: property.revision,
      assetId: a.id,
      sha256: a.clean_hash,
      bytes: a.bytes,
      width: a.width,
      height: a.height,
      kind: a.kind as "photo" | "panorama",
    }));
  const plan = planStudioProduct(request, {
    organizationId: actor.organizationId,
    propertyId: property.id,
    revision: property.revision,
    sources,
  });
  invariant(
    request.product !== "ai-3d" || request.sourceAssetIds.length <= 4,
    "MARBLE_PHOTO_LIMIT",
    422,
  );
  return {
    product: request.product,
    styleId: request.styleId,
    propertyId: property.id,
    revision: property.revision,
    fingerprint: digest(JSON.stringify(plan)),
    availablePhotos: plan.availablePhotos,
    neededPhotos: plan.neededPhotos,
    requestedDurationSeconds: plan.requestedDurationSeconds,
    suggestedDurationSeconds: plan.suggestedDurationSeconds,
    sufficientSources: plan.sufficientSources,
    localSourceAssetIds: plan.shots.map((s) => s.assetId),
    liveEnabled: false,
    plannedResolution: "1080p",
    currentLocalResolution:
      request.aspectRatio === "16:9" ? "640×360" : "360×640",
    futurePriceMicroUsd: null,
    actualExternalCostMicroUsd: 0,
    requiresIndependentReview: true,
    blockers:
      request.product === "tour-360"
        ? [...plan.blockers, "BLOCKED_PUBLIC_TOUR_APPROVAL"]
        : plan.blockers,
  };
}
export const STUDIO_PROVIDER_READINESS = Object.freeze({
  liveEnabled: false,
  approvedExternalSpendMicroUsd: 0,
  providerQuoteMicroUsd: null,
  video: [
    {
      provider: "fal",
      model: "kling/v4/image-to-video",
      styles: ["natural", "explore", "exterior"],
      enabled: false,
    },
    {
      provider: "fal",
      model: "bytedance/seedance-2.5/us/image-to-video",
      styles: ["premium"],
      enabled: false,
    },
  ],
  ai3d: {
    provider: "worldlabs",
    model: "marble-1.1-plus",
    enabled: false,
    legalGate: "BLOCKED_LEGAL_APPROVAL",
    maxPhotoReferences: 4,
  },
  tour360: {
    provider: "pedra",
    enabled: false,
    input: "2:1 equirectangular panorama",
    automaticPublicLink: true,
    releaseGate: "BLOCKED_PUBLIC_TOUR_APPROVAL",
    languages: ["en", "es", "fr", "de", "it", "pt"],
  },
  requiredGates: [
    "OWNER_APPROVAL",
    "SECURE_SERVER_CREDENTIALS",
    "MODEL_ENTITLEMENT",
    "LEGAL_DPA_RETENTION_REGION",
    "DOWNSTREAM_RESELLER_RIGHTS",
    "VERIFIED_HARD_SPEND_BOUND",
    "INDEPENDENT_RELEASE_REVIEW",
  ],
});
