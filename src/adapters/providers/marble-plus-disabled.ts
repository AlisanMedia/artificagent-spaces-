import { z } from "zod";
import { invariant } from "@/domain/platform";
import { PROPERTY_3D_GUIDANCE } from "@/domain/real-estate-prompts";
import type { PreparedMediaRequest } from "@/contracts/api-first-providers";
import {
  DisabledProviderTransport,
  validateSourceGrant,
  allowlistedHttpsUrl,
  type ProviderSourceScope,
} from "./api-first-policy";

const UriImage = z.object({ source: z.literal("uri"), uri: z.url() }).strict();
export const MarblePhotoPrompt = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("image"),
      image_prompt: UriImage,
      text_prompt: z.literal(PROPERTY_3D_GUIDANCE),
      disable_recaption: z.literal(true),
      is_pano: z.literal("false"),
    })
    .strict(),
  z
    .object({
      type: z.literal("multi-image"),
      multi_image_prompt: z
        .array(z.object({ content: UriImage }).strict())
        .min(2)
        .max(4),
      text_prompt: z.literal(PROPERTY_3D_GUIDANCE),
      disable_recaption: z.literal(true),
      reconstruct_images: z.literal(false),
    })
    .strict(),
]);
export const MarblePlusPayload = z
  .object({
    model: z.literal("marble-1.1-plus"),
    display_name: z.string().min(1).max(64),
    permission: z
      .object({
        public: z.literal(false),
        allow_id_access: z.literal(false),
        allowed_readers: z.array(z.never()).max(0),
        allowed_writers: z.array(z.never()).max(0),
      })
      .strict(),
    world_prompt: MarblePhotoPrompt,
  })
  .strict();
export class MarblePlusDisabledAdapter extends DisabledProviderTransport {
  readonly legalGate = "BLOCKED_LEGAL_APPROVAL" as const;
  prepare(
    title: string,
    references: readonly unknown[],
    scope: ProviderSourceScope,
    hosts: readonly string[],
    nowMs: number,
  ): PreparedMediaRequest {
    invariant(
      references.length >= 1 && references.length <= 4,
      "MARBLE_PHOTO_LIMIT",
      422,
    );
    const refs = references.map((r) =>
      validateSourceGrant(r, scope, hosts, nowMs),
    );
    invariant(
      refs.every((r) => r.source.kind === "photo"),
      "MARBLE_PHOTO_REFERENCE_REQUIRED",
      422,
    );
    invariant(
      new Set(refs.map((r) => r.source.sha256)).size === refs.length,
      "DISTINCT_PHOTOS_REQUIRED",
      409,
    );
    const body = MarblePlusPayload.parse({
      model: "marble-1.1-plus",
      display_name: title,
      permission: {
        public: false,
        allow_id_access: false,
        allowed_readers: [],
        allowed_writers: [],
      },
      world_prompt:
        refs.length === 1
          ? {
              type: "image",
              image_prompt: { source: "uri", uri: refs[0]!.url },
              is_pano: "false",
              text_prompt: PROPERTY_3D_GUIDANCE,
              disable_recaption: true,
            }
          : {
              type: "multi-image",
              multi_image_prompt: refs.map((r) => ({
                content: { source: "uri", uri: r.url },
              })),
              text_prompt: PROPERTY_3D_GUIDANCE,
              disable_recaption: true,
              reconstruct_images: false,
            },
    });
    return {
      provider: "worldlabs",
      method: "POST",
      origin: "https://api.worldlabs.ai",
      path: "/marble/v1/worlds:generate",
      body,
      enabled: false,
      externalBudgetMicroUsd: 0,
      credentialRequired: true,
      requiresIndependentReview: true,
    };
  }
  prepareOperation(operationId: string): PreparedMediaRequest {
    invariant(
      /^[A-Za-z0-9_-]{1,120}$/.test(operationId),
      "INVALID_PROVIDER_TASK_ID",
      422,
    );
    return {
      provider: "worldlabs",
      method: "GET",
      origin: "https://api.worldlabs.ai",
      path: `/marble/v1/operations/${operationId}`,
      enabled: false,
      externalBudgetMicroUsd: 0,
      credentialRequired: true,
      requiresIndependentReview: true,
    };
  }
  prepareExport(
    worldId: string,
    assetType: "mesh" | "splats",
  ): PreparedMediaRequest {
    invariant(
      /^[A-Za-z0-9_-]{1,120}$/.test(worldId),
      "INVALID_PROVIDER_TASK_ID",
      422,
    );
    return {
      provider: "worldlabs",
      method: "POST",
      origin: "https://api.worldlabs.ai",
      path: `/marble/v1/worlds/${worldId}:export`,
      body:
        assetType === "mesh"
          ? { asset_type: "mesh", format: "glb" }
          : { asset_type: "splats", format: "ply", resolution: "full_res" },
      enabled: false,
      externalBudgetMicroUsd: 0,
      credentialRequired: true,
      requiresIndependentReview: true,
    };
  }
  normalizeOperation(input: unknown, expectedOperationId: string) {
    const op = z
      .object({
        operation_id: z.string(),
        done: z.boolean(),
        error: z.unknown().nullish(),
        response: z.unknown().nullish(),
      })
      .strip()
      .parse(input);
    invariant(
      op.operation_id === expectedOperationId,
      "PROVIDER_TASK_SCOPE_DENIED",
      403,
    );
    return {
      operationId: op.operation_id,
      state: !op.done ? "PROCESSING" : op.error ? "FAILED" : "QA_HOLD",
      untrustedWorld: op.response ?? null,
      requiresIndependentReview: true as const,
      geometryTruth: "AI_INTERPRETATION_NOT_SURVEY" as const,
    };
  }
  normalizeAsset(
    url: string,
    approvedHosts: readonly string[],
    kind: "spz" | "pano" | "collider" | "glb" | "ply",
  ) {
    allowlistedHttpsUrl(url, approvedHosts);
    return {
      url,
      kind,
      verifiedBytes: false as const,
      state: "QA_HOLD" as const,
      permissionToPublish: false as const,
    };
  }
}
