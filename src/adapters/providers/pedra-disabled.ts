import { z } from "zod";
import { invariant } from "@/domain/platform";
import type { PreparedMediaRequest } from "@/contracts/api-first-providers";
import {
  DisabledProviderTransport,
  validateSourceGrant,
  allowlistedHttpsUrl,
  type ProviderSourceScope,
} from "./api-first-policy";

export const PEDRA_LANGUAGES = ["en", "es", "fr", "de", "it", "pt"] as const;
export const PedraTourPayload = z
  .object({
    name: z.string().min(1).max(120),
    linking: z.literal("sequential"),
    language: z.enum(PEDRA_LANGUAGES),
    scenes: z
      .array(
        z
          .object({
            imageUrl: z.url(),
            name: z.string().min(1).max(80).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();
/** Credentials belong in the future server transport's JSON body per official docs. No credential is read, injected or serialized here. */
export class PedraDisabledAdapter extends DisabledProviderTransport {
  readonly publicationGate = "BLOCKED_PUBLIC_TOUR_APPROVAL" as const;
  prepare(
    title: string,
    language: string,
    references: readonly unknown[],
    scope: ProviderSourceScope,
    hosts: readonly string[],
    nowMs: number,
  ): PreparedMediaRequest {
    const refs = references.map((r) =>
      validateSourceGrant(r, scope, hosts, nowMs),
    );
    invariant(
      refs.length >= 1 &&
        refs.length <= 12 &&
        refs.every(
          (r) =>
            r.source.kind === "panorama" &&
            r.source.width === r.source.height * 2,
        ),
      "PANORAMA_2_TO_1_REQUIRED",
      422,
    );
    invariant(
      new Set(refs.map((r) => r.source.sha256)).size === refs.length,
      "DISTINCT_PHOTOS_REQUIRED",
      409,
    );
    return {
      provider: "pedra",
      method: "POST",
      origin: "https://app.pedra.ai",
      path: "/api/create_virtual_tour",
      body: PedraTourPayload.parse({
        name: title,
        linking: "sequential",
        language,
        scenes: refs.map((r) => ({ imageUrl: r.url })),
      }),
      enabled: false,
      externalBudgetMicroUsd: 0,
      credentialRequired: true,
      requiresIndependentReview: true,
    };
  }
  prepareStatus(tourId: string): PreparedMediaRequest {
    invariant(
      /^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(tourId),
      "INVALID_PROVIDER_TASK_ID",
      422,
    );
    return {
      provider: "pedra",
      method: "POST",
      origin: "https://app.pedra.ai",
      path: "/api/get_virtual_tour",
      body: { tourId },
      enabled: false,
      externalBudgetMicroUsd: 0,
      credentialRequired: true,
      requiresIndependentReview: true,
    };
  }
  normalizeOutput(input: unknown, expectedTourId: string) {
    const result = z
      .object({
        tourId: z.uuid(),
        status: z.enum(["processing", "ready", "failed"]),
        tourUrl: z.string(),
        shareable: z.boolean().optional(),
        embedCode: z.string().max(20000).optional(),
      })
      .strip()
      .parse(input);
    invariant(
      result.tourId === expectedTourId,
      "PROVIDER_TASK_SCOPE_DENIED",
      403,
    );
    const url = allowlistedHttpsUrl(result.tourUrl, ["app.pedra.ai"]);
    invariant(
      (!url.search && url.pathname === `/virtual-tour/${result.tourId}`) ||
        (!url.search &&
          new RegExp(
            `^/(?:en|es|fr|de|it|pt)/virtual-tour/${result.tourId}$`,
          ).test(url.pathname)),
      "UNAPPROVED_TOUR_URL",
      403,
    );
    // NEVER return or render embedCode. A separately approved release can construct its own allowlisted React iframe.
    return {
      tourId: result.tourId,
      state: result.status === "ready" ? ("QA_HOLD" as const) : result.status,
      tourUrl: url.toString(),
      shareableAtProvider: result.shareable === true,
      publicationAllowed: false as const,
      rawEmbedDiscarded: true as const,
      product: "PANORAMA_360_NOT_FREE_WALK_3D" as const,
    };
  }
}
