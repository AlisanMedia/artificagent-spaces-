import { z } from "zod";
import { invariant } from "@/domain/platform";
import {
  ServiceOptions,
  type ProductionServiceId,
} from "@/domain/production-services";
import { compileServiceProfile } from "@/server/production/prompts";
import { productionService } from "@/server/production/registry";
import type { PreparedMediaRequest } from "@/contracts/api-first-providers";
import {
  DisabledProviderTransport,
  allowlistedHttpsUrl,
  validateSourceGrant,
  type ProviderSourceScope,
} from "./api-first-policy";
import { FalKling4Payload, FalSeedance25Payload } from "./fal-video-disabled";
import { PedraTourPayload, PedraDisabledAdapter } from "./pedra-disabled";

const ImageUrl = z.url().max(4096);
const ImageBase = z
  .object({ imageUrl: ImageUrl, preserveAspectRatio: z.literal(false) })
  .strict();
export const PedraEnhance = ImageBase.extend({
  highFidelity: z.literal(true),
}).strict();
export const PedraFurnish = ImageBase.extend({
  roomType: z.enum([
    "Living room",
    "Dining + Living room",
    "Bedroom",
    "Dining room",
    "Terrace",
    "Entrance",
    "Office",
    "Bathroom",
  ]),
  style: z.enum([
    "Modern",
    "Scandinavian",
    "Contemporary",
    "Minimalist",
    "Mediterranean",
  ]),
}).strict();
export const PedraRemove = ImageBase.extend({ maskUrl: ImageUrl }).strict();
export const PedraSky = ImageBase.extend({
  skyStyle: z.enum([
    "sunny",
    "sunny-no-reflections",
    "sunrise",
    "dawn",
    "night",
  ]),
}).strict();
export const PedraRenovate = ImageBase.extend({
  style: z.enum([
    "Modern",
    "Scandinavian",
    "Contemporary",
    "Minimalist",
    "Mediterranean",
  ]),
  preserveWindows: z.literal(true),
  furnish: z.literal(false),
}).strict();
export const FalPrecision = z
  .object({
    image_urls: z.array(ImageUrl).length(1),
    prompt: z.string().min(3).max(50000),
    resolution: z.literal("2K"),
    aspect_ratio: z.literal("auto"),
    output_format: z.literal("png"),
    num_images: z.literal(1),
  })
  .strict();
const MediaAsset = z
  .object({
    source: z.literal("media_asset"),
    media_asset_id: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
  })
  .strict();
export const WorldPhotoPayload = z
  .object({
    model: z.literal("marble-1.1-plus"),
    display_name: z.literal("Spaces private scene"),
    permission: z
      .object({
        public: z.literal(false),
        allow_id_access: z.literal(false),
        allowed_readers: z.array(z.never()).max(0),
        allowed_writers: z.array(z.never()).max(0),
      })
      .strict(),
    world_prompt: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("image"),
          image_prompt: MediaAsset,
          text_prompt: z.string(),
          is_pano: z.literal("false"),
        })
        .strict(),
      z
        .object({
          type: z.literal("multi-image"),
          multi_image_prompt: z
            .array(z.object({ content: MediaAsset }).strict())
            .min(2)
            .max(4),
          text_prompt: z.string(),
        })
        .strict(),
    ]),
  })
  .strict();

export interface ProductionSourceScope extends ProviderSourceScope {
  /** All additional claims below are server-verified records, never body/query/dynamic-variable claims. */
  readonly rightsApproved: boolean;
  readonly conceptApproved: boolean;
  readonly publicTourApproved: boolean;
  readonly panoramaHashes: readonly string[];
  readonly emptyRoomHashes: readonly string[];
  readonly exteriorHashes: readonly string[];
  readonly mediaAssets: readonly {
    assetId: string;
    sha256: string;
    mediaAssetId: string;
    state: "READY";
  }[];
  readonly approvedMasks: readonly {
    sourceSha256: string;
    maskSha256: string;
    url: string;
    width: number;
    height: number;
    reviewId: string;
    permittedPurpose: "OBJECT_REMOVAL" | "FINISH_CONCEPT";
  }[];
}
export interface PreparedProductionRequest extends PreparedMediaRequest {
  readonly provenance: {
    serviceId: ProductionServiceId;
    profileVersion: string;
    profileSha256: string;
    promptSha256: string | null;
    schemaRevision: string;
    sourceHashes: readonly string[];
    organizationId: string;
    propertyId: string;
    revision: number;
  };
  readonly expiresAtMs: number;
  readonly unknownAcceptancePolicy: "HOLD_NO_RESUBMIT";
}
export class ProductionDisabledAdapter extends DisabledProviderTransport {
  /** Builds wire DTOs without reading a secret or making a request. Call admission is separately hard locked. */
  prepare(
    id: ProductionServiceId,
    optionsInput: unknown,
    references: readonly unknown[],
    scope: ProductionSourceScope,
    hosts: readonly string[],
    nowMs: number,
  ): PreparedProductionRequest {
    const definition = productionService(id),
      options = ServiceOptions.parse(optionsInput);
    invariant(scope.rightsApproved, "SOURCE_RIGHTS_REQUIRED", 403);
    invariant(id !== "B01", "ACCEPTED_BUNDLE_REQUIRED", 422);
    invariant(
      Object.keys(options).every((k) =>
        definition.optionKeys.includes(k as keyof ServiceOptions),
      ),
      "SERVICE_OPTIONS_NOT_ALLOWED",
      422,
    );
    invariant(
      references.length >= 1 &&
        references.length <= (id === "T01" ? 12 : id === "T02" ? 4 : 1),
      "SERVICE_SOURCE_COUNT",
      422,
    );
    const refs = references.map((r) =>
      validateSourceGrant(r, scope, hosts, nowMs),
    );
    invariant(
      new Set(refs.map((r) => r.source.sha256)).size === refs.length,
      "DISTINCT_PHOTOS_REQUIRED",
      409,
    );
    invariant(
      refs.every(
        (r) => r.source.kind === (id === "T01" ? "panorama" : "photo"),
      ),
      "SERVICE_CAPTURE_TYPE_REQUIRED",
      422,
    );
    if (id === "P07" || id === "P07b")
      invariant(scope.conceptApproved, "CONCEPT_PERMISSION_REQUIRED", 403);
    const first = refs[0]!,
      hash = first.source.sha256,
      profile = compileServiceProfile(id, options);
    if (id === "P03")
      invariant(
        scope.emptyRoomHashes.includes(hash),
        "EMPTY_ROOM_EVIDENCE_REQUIRED",
        422,
      );
    if (id === "V04" || id === "P06")
      invariant(
        scope.exteriorHashes.includes(hash),
        "EXTERIOR_EVIDENCE_REQUIRED",
        422,
      );
    let body: Readonly<Record<string, unknown>>;
    let origin: string, path: string;
    if (id.startsWith("V")) {
      invariant(
        first.source.width >= 300 &&
          first.source.height >= 300 &&
          first.source.width / first.source.height >= 0.4 &&
          first.source.width / first.source.height <= 2.5,
        "VIDEO_REFERENCE_DIMENSIONS",
        422,
      );
      body =
        id === "V02"
          ? FalSeedance25Payload.parse({
              image_url: first.url,
              prompt: profile.text,
              duration: String(Math.max(4, options.durationSeconds ?? 6)),
              resolution: "1080p",
              aspect_ratio: "auto",
              generate_audio: false,
              bitrate_mode: "high",
              codec: "H264",
            })
          : FalKling4Payload.parse({
              start_image_url: first.url,
              prompt: profile.text,
              duration: options.durationSeconds ?? 5,
              resolution: "1080p",
            });
      origin = "https://queue.fal.run";
      path = "/" + definition.endpoint;
    } else if (id === "P07b") {
      invariant(
        scope.approvedMasks.some(
          (m) =>
            m.sourceSha256 === hash &&
            m.width === first.source.width &&
            m.height === first.source.height &&
            m.reviewId &&
            m.permittedPurpose === "FINISH_CONCEPT",
        ),
        "TARGET_REGION_REVIEW_REQUIRED",
        403,
      );
      body = FalPrecision.parse({
        image_urls: [first.url],
        prompt: profile.text,
        resolution: "2K",
        aspect_ratio: "auto",
        output_format: "png",
        num_images: 1,
      });
      origin = "https://queue.fal.run";
      path = "/" + definition.endpoint;
    } else if (id === "T02") {
      if (refs.length > 1)
        invariant(
          first.source.roomId &&
            refs.every((r) => r.source.roomId === first.source.roomId),
          "SAME_SCENE_EVIDENCE_REQUIRED",
          403,
        );
      const assets = refs.map((r) => {
        const a = scope.mediaAssets.find(
          (m) =>
            m.assetId === r.source.assetId &&
            m.sha256 === r.source.sha256 &&
            m.state === "READY",
        );
        invariant(a, "WORLD_MEDIA_ASSET_NOT_READY", 409);
        return {
          source: "media_asset" as const,
          media_asset_id: a.mediaAssetId,
        };
      });
      body = WorldPhotoPayload.parse({
        model: "marble-1.1-plus",
        display_name: "Spaces private scene",
        permission: {
          public: false,
          allow_id_access: false,
          allowed_readers: [],
          allowed_writers: [],
        },
        world_prompt:
          assets.length === 1
            ? {
                type: "image",
                image_prompt: assets[0],
                text_prompt: profile.text,
                is_pano: "false",
              }
            : {
                type: "multi-image",
                multi_image_prompt: assets.map((a) => ({ content: a })),
                text_prompt: profile.text,
              },
      });
      origin = "https://api.worldlabs.ai";
      path = "/marble/v1/worlds:generate";
    } else if (id === "T01") {
      invariant(scope.publicTourApproved, "BLOCKED_PUBLIC_TOUR_APPROVAL", 403);
      invariant(
        refs.every(
          (r) =>
            r.source.width === r.source.height * 2 &&
            scope.panoramaHashes.includes(r.source.sha256),
        ),
        "GENUINE_PANORAMA_EVIDENCE_REQUIRED",
        422,
      );
      body = PedraTourPayload.parse({
        name: "Spaces approved tour",
        linking: "sequential",
        language: "en",
        scenes: refs.map((r) => ({ imageUrl: r.url })),
      });
      origin = "https://app.pedra.ai";
      path = definition.endpoint;
    } else {
      const base = { imageUrl: first.url, preserveAspectRatio: false as const };
      switch (id) {
        case "P01":
        case "P02":
          body = PedraEnhance.parse({ ...base, highFidelity: true });
          break;
        case "P03":
          body = PedraFurnish.parse({
            ...base,
            roomType: options.roomType,
            style: options.style,
          });
          break;
        case "P04":
          body = ImageBase.parse(base);
          break;
        case "P05": {
          const mask = scope.approvedMasks.find(
            (m) =>
              m.sourceSha256 === hash &&
              m.width === first.source.width &&
              m.height === first.source.height &&
              m.reviewId &&
              m.permittedPurpose === "OBJECT_REMOVAL",
          );
          invariant(mask, "SOURCE_BOUND_MASK_REVIEW_REQUIRED", 403);
          allowlistedHttpsUrl(mask.url, hosts);
          body = PedraRemove.parse({ ...base, maskUrl: mask.url });
          break;
        }
        case "P06":
          body = PedraSky.parse({
            ...base,
            skyStyle: options.skyStyle ?? "sunny",
          });
          break;
        case "P07":
          body = PedraRenovate.parse({
            ...base,
            style: options.style ?? "Modern",
            preserveWindows: true,
            furnish: false,
          });
          break;
        default:
          throw new Error("UNSUPPORTED_PRODUCTION_SERVICE");
      }
      origin = "https://app.pedra.ai";
      path = definition.endpoint;
    }
    return {
      provider: definition.provider as "fal" | "pedra" | "worldlabs",
      method: "POST",
      origin,
      path,
      body,
      credentialRequired: true,
      enabled: false,
      externalBudgetMicroUsd: 0,
      requiresIndependentReview: true,
      expiresAtMs: Math.min(...refs.map((r) => r.expiresAtMs)),
      unknownAcceptancePolicy: "HOLD_NO_RESUBMIT",
      provenance: {
        serviceId: id,
        profileVersion: profile.version,
        profileSha256: profile.profileSha256,
        promptSha256: profile.promptSha256,
        schemaRevision: definition.schemaRevision,
        sourceHashes: refs.map((r) => r.source.sha256),
        organizationId: scope.organizationId,
        propertyId: scope.propertyId,
        revision: scope.revision,
      },
    };
  }
}
const ImageResult = z.object({ url: z.string().max(4096) }).strip();
/** Endpoint-specific shape: changing an array to an object is a schema failure, never silently accepted. */
export function normalizeProductionResult(
  id: ProductionServiceId,
  input: unknown,
) {
  const d = productionService(id);
  if (
    d.output === "hosted-360" ||
    d.output === "private-world" ||
    d.output === "bundle"
  )
    throw new Error("DEDICATED_SPATIAL_OR_BUNDLE_PARSER_REQUIRED");
  let outputs: { url: string }[];
  if (d.provider === "pedra") {
    if (id === "P05" || id === "P06")
      outputs = [z.object({ output: ImageResult }).strip().parse(input).output];
    else
      outputs = z
        .object({ output: z.array(ImageResult).min(1).max(4) })
        .strip()
        .parse(input).output;
  } else if (id === "P07b")
    outputs = z
      .object({
        images: z
          .array(
            ImageResult.extend({
              content_type: z.literal("image/png"),
            }).strip(),
          )
          .length(1),
      })
      .strip()
      .parse(input).images;
  else
    outputs = [
      z
        .object({
          video: ImageResult.extend({
            content_type: z.literal("video/mp4"),
          }).strip(),
        })
        .strip()
        .parse(input).video,
    ];
  return outputs.map((o) => {
    const u = allowlistedHttpsUrl(
      o.url,
      d.provider === "pedra"
        ? ["img.pedra.ai"]
        : [
            "v3b.fal.media",
            "v3.fal.media",
            "fal.media",
            "storage.googleapis.com",
          ],
    );
    invariant(
      u.hostname !== "storage.googleapis.com" ||
        u.pathname.startsWith("/falserverless/"),
      "PROVIDER_URL_DENIED",
      403,
    );
    return {
      url: u.toString(),
      declaredKind: d.output,
      verifiedBytes: false as const,
      state: "QA_HOLD" as const,
      directCustomerDownloadAllowed: false as const,
    };
  });
}
export function normalizeTourResult(input: unknown, expectedId: string) {
  return new PedraDisabledAdapter().normalizeOutput(input, expectedId);
}
export function classifyProductionFailure(input: {
  httpStatus?: number;
  timedOut?: boolean;
  accepted?: boolean;
  cancelled?: boolean;
}) {
  if (input.cancelled && input.accepted === false)
    return "CANCELLED_NO_ACCEPTANCE" as const;
  if (input.timedOut || input.accepted === undefined || input.accepted === true)
    return "HOLD_UNKNOWN_NO_RESUBMIT" as const;
  return input.httpStatus === 429
    ? ("KNOWN_NOT_ACCEPTED_BACKOFF_ONLY" as const)
    : ("KNOWN_NOT_ACCEPTED_FAILED" as const);
}
