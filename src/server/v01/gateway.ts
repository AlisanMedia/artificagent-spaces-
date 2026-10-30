import { z } from "zod";
import { invariant } from "@/domain/platform";
import { V01_MODEL, type V01Permit } from "./authorization";

export interface V01Gateway {
  readonly mode: V01Permit["mode"];
  preflight(): Promise<void>;
  submit(
    body: {
      start_image_url: string;
      prompt: string;
      duration: number;
      resolution: "1080p";
    },
    requestId: string,
  ): Promise<unknown>;
  status(providerId: string): Promise<unknown>;
  result(providerId: string): Promise<unknown>;
  download(url: string, maxBytes: number): Promise<Uint8Array>;
}
export const ProviderId = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);
export function queuePath(providerId: string, kind: "status" | "result") {
  // Current fal queue docs explicitly require owner/app, NOT the entire endpoint path.
  return `/kling/v4/requests/${ProviderId.parse(providerId)}${kind === "status" ? "/status" : ""}`;
}
export function parseReceipt(value: unknown) {
  const r = z
    .object({
      request_id: ProviderId,
      status: z.enum(["IN_QUEUE", "IN_PROGRESS", "COMPLETED"]).optional(),
      status_url: z.string().optional(),
      response_url: z.string().optional(),
    })
    .strip()
    .parse(value);
  const routes = validateQueueUrls(r.request_id, r.status_url, r.response_url);
  return { ...r, routes };
}
export function parseStatus(value: unknown, expected: string) {
  const r = z
    .object({
      request_id: ProviderId,
      status: z.enum(["IN_QUEUE", "IN_PROGRESS", "COMPLETED"]),
    })
    .strip()
    .parse(value);
  invariant(r.request_id === expected, "V01_PROVIDER_ID_MISMATCH", 403);
  return r.status;
}
export function parseResult(value: unknown) {
  const r = z
    .object({
      video: z
        .object({
          url: z.string().max(2048),
          content_type: z.literal("video/mp4").optional(),
        })
        .strip(),
    })
    .strip()
    .parse(value);
  return r.video.url;
}
export const V01_SUBMIT_PATH = "/" + V01_MODEL;

export function validateQueueUrls(
  id: string,
  status?: string | null,
  result?: string | null,
) {
  ProviderId.parse(id);
  const base = "https://queue.fal.run";
  const allowed = [queuePath(id, "result"), `/${V01_MODEL}/requests/${id}`];
  const resultUrl = result ?? base + queuePath(id, "result");
  const statusUrl = status ?? base + queuePath(id, "status");
  for (const [value, suffix] of [
    [resultUrl, ""],
    [statusUrl, "/status"],
  ] as const) {
    const u = new URL(value);
    invariant(
      u.origin === base &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash &&
        allowed.some((p) => u.pathname === p + suffix),
      "V01_QUEUE_SCOPE_DENIED",
      403,
    );
  }
  invariant(
    statusUrl === resultUrl + "/status",
    "V01_QUEUE_ROUTE_PAIR_MISMATCH",
    403,
  );
  return { status: statusUrl, result: resultUrl };
}
