import { z } from "zod";
import type {
  MediaSubmission,
  ProviderEvidence,
  VideoProvider,
} from "@/contracts/platform-ports";
import { PlatformError } from "@/domain/platform";

const checked = "2026-10-22";
const candidate = (
  provider: string,
  name: string,
  sourceUrls: string[],
  officialModelId: string | null = null,
): ProviderEvidence => ({
  provider,
  candidate: name,
  officialModelId,
  revision: null,
  region: null,
  termsReviewed: false,
  pricingMicroUsd: null,
  verifiedAt: officialModelId ? checked : null,
  sourceUrls,
  enabled: false,
});
export const PROVIDERS = Object.freeze({
  astra: candidate(
    "OpenAI",
    "GPT-6 Astra",
    ["https://platform.openai.com/docs/models"],
    "gpt-6-astra",
  ),
  sol: candidate(
    "OpenAI",
    "GPT-6.1 Sol (current documented challenger)",
    ["https://platform.openai.com/docs/models"],
    "gpt-6.1-sol",
  ),
  opus: candidate(
    "Anthropic",
    "Claude Opus 5.5",
    ["https://platform.claude.com/docs/en/about-claude/models/overview"],
    "claude-opus-5-5",
  ),
  kling: candidate("Kling", "Kling O3 — model ID/schema not verified", [
    "https://app.klingai.com/global/dev/document-api/apiReference/model/omniVideo",
  ]),
  seedance: candidate(
    "BytePlus",
    "Seedance 2.5 — exact version/access not verified",
    ["https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API"],
  ),
  veo: candidate(
    "Google",
    "Veo 3.1 preview — official Gemini shutdown 2026-10-22; do not route",
    ["https://ai.google.dev/gemini-api/docs/video"],
  ),
  marble: candidate(
    "World Labs",
    "Marble 1.1 candidate",
    ["https://docs.worldlabs.ai/api"],
    "marble-1.1",
  ),
  atlas: candidate("World Labs", "Atlas — R&D, general API/rights unverified", [
    "https://docs.worldlabs.ai/api",
  ]),
});
export const SubmissionSchema = z
  .object({
    organizationId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    propertyId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    revision: z.number().int().positive(),
    mode: z.enum(["pov", "cinematic", "hybrid"]),
    sourceHashes: z
      .array(z.string().regex(/^[a-f0-9]{64}$/))
      .min(1)
      .max(20),
    maxCostMicroUsd: z.literal(0),
    eyeHeightMeters: z.literal(1.65),
    firstPerson: z.boolean(),
    forbiddenClaims: z.array(z.string().max(100)).max(50),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.mode === "pov" && !v.firstPerson)
      ctx.addIssue({
        code: "custom",
        message: "POV requires first-person eye-level view",
      });
  });

/** Internal request contract only. Unknown vendor payloads are never invented or transmitted. */
export class DisabledVideoAdapter implements VideoProvider {
  constructor(readonly evidence: ProviderEvidence) {}
  prepare(input: unknown): MediaSubmission {
    return SubmissionSchema.parse(input);
  }
  async submit(input: MediaSubmission): Promise<never> {
    this.prepare(input);
    throw new PlatformError("BLOCKED_EXTERNAL_APPROVAL", 403);
  }
}
export const klingAdapter = new DisabledVideoAdapter(PROVIDERS.kling);
export const seedanceAdapter = new DisabledVideoAdapter(PROVIDERS.seedance);
export const veoAdapter = new DisabledVideoAdapter(PROVIDERS.veo);

export const MarbleGenerate = z
  .object({
    display_name: z.string().min(1).max(100),
    model: z.literal("marble-1.1"),
    world_prompt: z
      .object({
        type: z.literal("text"),
        text_prompt: z.string().min(1).max(1000),
      })
      .strict(),
  })
  .strict();
export const MarbleExport = z.union([
  z
    .object({ asset_type: z.literal("mesh"), format: z.literal("glb") })
    .strict(),
  z
    .object({ asset_type: z.literal("splats"), format: z.literal("ply") })
    .strict(),
]);
export function prepareMarbleRequest(input: unknown) {
  return {
    method: "POST" as const,
    origin: "https://api.worldlabs.ai",
    path: "/marble/v1/worlds:generate",
    body: MarbleGenerate.parse(input),
    enabled: false as const,
    requiredSecretName: "WORLDLABS_API_KEY",
    externalBudgetMicroUsd: 0,
  };
}
export function routeProvider(requested: keyof typeof PROVIDERS): never {
  const provider = PROVIDERS[requested];
  if (!provider.officialModelId)
    throw new PlatformError("MODEL_OR_SCHEMA_NOT_VERIFIED", 409);
  throw new PlatformError("BLOCKED_EXTERNAL_APPROVAL", 403);
}
