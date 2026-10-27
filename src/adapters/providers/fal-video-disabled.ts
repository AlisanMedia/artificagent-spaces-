import { z } from "zod";
import { invariant } from "@/domain/platform";
import { propertyPrompt } from "@/domain/real-estate-prompts";
import type {
  PreparedMediaRequest,
  ProviderCandidate,
} from "@/contracts/api-first-providers";
import {
  DisabledProviderTransport,
  allowlistedHttpsUrl,
  sourceFrames,
  type ProviderSourceScope,
} from "./api-first-policy";

export const FAL_CONTRACTS = Object.freeze({
  checkedAt: "2026-10-27",
  provider: "fal",
  enabled: false,
  kling: Object.freeze({
    endpoint: "kling/v4/image-to-video",
    source: "https://fal.ai/models/kling/v4/image-to-video/api",
    schemaSha256:
      "182f5a1c65afd4f7ff759eeca4f42f16ae649974172111696052e95b20ebcb3b",
    minSeconds: 3,
    maxSeconds: 30,
  }),
  seedance: Object.freeze({
    endpoint: "bytedance/seedance-2.5/us/image-to-video",
    source:
      "https://fal.ai/models/bytedance/seedance-2.5/us/image-to-video/api",
    schemaSha256:
      "05768465dc2b613e51196802f8cc929b33964af4a31fa66f0140e4f66862349d",
    minSeconds: 4,
    maxSeconds: 30,
  }),
});
const SourceUrl = z.url();
export const FalKling4Payload = z
  .object({
    start_image_url: SourceUrl,
    end_image_url: SourceUrl.optional(),
    prompt: z.string().min(1).max(26000),
    duration: z.number().int().min(3).max(30),
    resolution: z.literal("1080p"),
  })
  .strict();
export const FalSeedance25Payload = z
  .object({
    image_url: SourceUrl,
    end_image_url: SourceUrl.optional(),
    prompt: z.string().min(1).max(26000),
    duration: z.string().regex(/^(?:[4-9]|[12][0-9]|30)$/),
    resolution: z.literal("1080p"),
    aspect_ratio: z.literal("auto"),
    generate_audio: z.literal(false),
    bitrate_mode: z.literal("high"),
    codec: z.literal("H264"),
  })
  .strict();
const ShotOptions = z
  .object({
    styleId: z.enum(["natural", "premium", "explore", "exterior"]),
    durationSeconds: z.number().int().finite().min(1).max(60),
    maxCostMicroUsd: z.literal(0),
  })
  .strict();
abstract class FalVideoAdapter extends DisabledProviderTransport {
  abstract readonly model: string;
  protected frames(
    start: unknown,
    end: unknown | undefined,
    scope: ProviderSourceScope,
    hosts: readonly string[],
    nowMs: number,
  ) {
    return sourceFrames(start, end, scope, hosts, nowMs);
  }
  protected request(body: Record<string, unknown>): PreparedMediaRequest {
    return {
      provider: "fal",
      method: "POST",
      origin: "https://queue.fal.run",
      path: `/${this.model}`,
      body,
      credentialRequired: true,
      enabled: false,
      externalBudgetMicroUsd: 0,
      requiresIndependentReview: true,
    };
  }
  normalizeOutput(input: unknown): ProviderCandidate {
    const value = z
      .object({
        video: z
          .object({
            url: z.string().max(4096),
            content_type: z.literal("video/mp4"),
            file_size: z.number().int().positive().max(52_428_800).optional(),
            file_name: z.string().max(180).optional(),
          })
          .strip(),
      })
      .strip()
      .parse(input);
    const uri = allowlistedHttpsUrl(value.video.url, [
      "v3b.fal.media",
      "v3.fal.media",
      "fal.media",
      "storage.googleapis.com",
    ]);
    invariant(
      uri.hostname !== "storage.googleapis.com" ||
        uri.pathname.startsWith("/falserverless/"),
      "PROVIDER_URL_DENIED",
      403,
    );
    return {
      url: value.video.url,
      mime: "video/mp4",
      declaredBytes: value.video.file_size ?? null,
      verifiedBytes: false,
      state: "QA_HOLD",
      directCustomerDownloadAllowed: false,
    };
  }
}
export class FalKling4DisabledAdapter extends FalVideoAdapter {
  readonly model = FAL_CONTRACTS.kling.endpoint;
  prepare(
    options: unknown,
    start: unknown,
    scope: ProviderSourceScope,
    hosts: readonly string[],
    nowMs: number,
    end?: unknown,
  ) {
    const value = ShotOptions.parse(options),
      prompt = propertyPrompt(value.styleId);
    invariant(prompt.endpoint === this.model, "UNSUPPORTED_MODEL_STYLE", 409);
    const { first, last } = this.frames(start, end, scope, hosts, nowMs);
    for (const frame of [first, last].filter((f) => f !== null))
      invariant(
        frame.source.width >= 300 &&
          frame.source.height >= 300 &&
          frame.source.width / frame.source.height >= 0.4 &&
          frame.source.width / frame.source.height <= 2.5,
        "FAL_FRAME_DIMENSIONS_UNSUPPORTED",
        422,
      );
    return this.request(
      FalKling4Payload.parse({
        start_image_url: first.url,
        ...(last ? { end_image_url: last.url } : {}),
        prompt: prompt.text,
        duration: Math.max(3, Math.min(30, value.durationSeconds)),
        resolution: "1080p",
      }),
    );
  }
}
export class FalSeedance25DisabledAdapter extends FalVideoAdapter {
  readonly model = FAL_CONTRACTS.seedance.endpoint;
  prepare(
    options: unknown,
    start: unknown,
    scope: ProviderSourceScope,
    hosts: readonly string[],
    nowMs: number,
    end?: unknown,
  ) {
    const value = ShotOptions.parse(options),
      prompt = propertyPrompt(value.styleId);
    invariant(prompt.endpoint === this.model, "UNSUPPORTED_MODEL_STYLE", 409);
    const { first, last } = this.frames(start, end, scope, hosts, nowMs);
    return this.request(
      FalSeedance25Payload.parse({
        image_url: first.url,
        ...(last ? { end_image_url: last.url } : {}),
        prompt: prompt.text,
        duration: String(Math.max(4, Math.min(30, value.durationSeconds))),
        resolution: "1080p",
        aspect_ratio: "auto",
        generate_audio: false,
        bitrate_mode: "high",
        codec: "H264",
      }),
    );
  }
}
/** Use server-stored returned queue URLs, not a URL supplied in a webhook or customer request. */
export function prepareFalQueueRead(
  input: unknown,
  expectedRequestId: string,
  kind: "status" | "result" | "cancel",
  expectedModel:
    | typeof FAL_CONTRACTS.kling.endpoint
    | typeof FAL_CONTRACTS.seedance.endpoint,
) {
  const value = z
    .object({
      request_id: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
      status_url: z.string(),
      response_url: z.string(),
      cancel_url: z.string(),
    })
    .strict()
    .parse(input);
  invariant(
    value.request_id === expectedRequestId,
    "PROVIDER_TASK_SCOPE_DENIED",
    403,
  );
  const u = allowlistedHttpsUrl(
    kind === "status"
      ? value.status_url
      : kind === "result"
        ? value.response_url
        : value.cancel_url,
    ["queue.fal.run"],
  );
  invariant(
    !u.search &&
      u.pathname.includes(`/requests/${value.request_id}`) &&
      /^(?:\/kling\/v4\/image-to-video|\/bytedance\/seedance-2\.5\/us\/image-to-video)\/requests\/[A-Za-z0-9_-]+(?:\/(?:status|cancel))?$/.test(
        u.pathname,
      ),
    "PROVIDER_TASK_URL_DENIED",
    403,
  );
  const suffix =
    kind === "status" ? "/status" : kind === "cancel" ? "/cancel" : "";
  invariant(
    [FAL_CONTRACTS.kling.endpoint, FAL_CONTRACTS.seedance.endpoint].includes(
      expectedModel,
    ) &&
      u.pathname === `/${expectedModel}/requests/${value.request_id}${suffix}`,
    "PROVIDER_TASK_URL_DENIED",
    403,
  );
  return {
    provider: "fal" as const,
    method: kind === "cancel" ? ("PUT" as const) : ("GET" as const),
    origin: u.origin,
    path: u.pathname,
    enabled: false as const,
    externalBudgetMicroUsd: 0 as const,
    credentialRequired: true as const,
    requiresIndependentReview: true as const,
  };
}
