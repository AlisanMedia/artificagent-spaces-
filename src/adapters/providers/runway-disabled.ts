import { z } from "zod";
import { PlatformError } from "@/domain/platform";
/** Documented subset, retrieved 2026-10-23. Not a transport, account entitlement or legal clearance. */
export const RunwayImageToVideo = z
  .object({
    model: z.enum(["gen4_turbo", "gen4.5"]),
    promptImage: z
      .string()
      .max(10_000_000)
      .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
    promptText: z.string().min(1).max(1000),
    ratio: z.enum(["1280:720", "720:1280"]),
    duration: z.number().int().min(2).max(10),
  })
  .strict();
export function prepareRunwayRequest(input: unknown) {
  return {
    enabled: false as const,
    method: "POST" as const,
    origin: "https://api.dev.runwayml.com",
    path: "/v1/image_to_video",
    headers: {
      "X-Runway-Version": "2024-11-06",
      "Content-Type": "application/json",
    },
    requiredSecretName: "RUNWAY_API_SECRET",
    body: RunwayImageToVideo.parse(input),
    externalBudgetMicroUsd: 0,
    rightsAndDpaCleared: false,
  };
}
export async function submitRunwayDisabled(input: unknown): Promise<never> {
  prepareRunwayRequest(input);
  throw new PlatformError("BLOCKED_EXTERNAL_APPROVAL", 403);
}
