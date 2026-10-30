// @vitest-environment node
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { compileServiceProfile } from "@/server/production/prompts";
import { digest } from "@/server/crypto";
import { parseReceipt, validateQueueUrls } from "@/server/v01/gateway";
import type { V01Authority, V01Permit } from "@/server/v01/authorization";
const calls = vi.hoisted(() => ({
  requests: [] as {
    url: string;
    options: { headers: Record<string, string>; method: string };
    body: string | undefined;
  }[],
  responseStatus: 200,
  responseType: "application/json",
  response: Buffer.from("{}"),
}));
vi.mock("node:https", () => ({
  Agent: class {
    destroy() {}
  },
  request: (
    url: URL,
    options: { headers: Record<string, string>; method: string },
    callback: (
      res: EventEmitter & {
        statusCode: number;
        headers: Record<string, string>;
        destroy(): void;
      },
    ) => void,
  ) => {
    const req = new EventEmitter() as EventEmitter & {
      end(body?: Buffer): void;
      destroy(error: Error): void;
    };
    req.destroy = (e) => {
      queueMicrotask(() => req.emit("error", e));
    };
    req.end = (body) => {
      calls.requests.push({
        url: String(url),
        options,
        body: body?.toString(),
      });
      queueMicrotask(() => {
        const res = new EventEmitter() as Parameters<typeof callback>[0];
        res.statusCode = calls.responseStatus;
        res.headers = {
          "content-type": calls.responseType,
          "content-length": String(calls.response.length),
        };
        res.destroy = () => {};
        callback(res);
        queueMicrotask(() => {
          res.emit("data", calls.response);
          res.emit("end");
        });
      });
    };
    return req;
  },
}));
import { FalV01Gateway, v01ResultUrl } from "@/server/v01/fal-http";
const image = Buffer.from([255, 216, 255, 10, 20]);
const p = {
  version: "v01-owner-test-v1",
  id: "test-permit",
  mode: "fal-live-test",
  organizationId: "studio",
  propertyId: "test-property",
  revision: 1,
  sourceSha256: digest(image),
  serviceId: "V01",
  model: "kling/v4/image-to-video",
  profile: "v01-provider-1080p-v1",
  durationSeconds: 4,
  aspectRatio: "16:9",
  maxRequests: 1,
  maxPolls: 8,
  pollIntervalMs: 5000,
  issuedAtMs: 1,
  expiresAtMs: Number.MAX_SAFE_INTEGER,
  submitWithinMs: 120000,
  maxJobWallMs: 600000,
  maxSourceBytes: 1000,
  maxOutputBytes: 1000,
  unitPriceMicroUsdPerSecond: 1,
  perRequestCapMicroUsd: 4,
  totalCapMicroUsd: 4,
  priceEvidenceSha256: "a".repeat(64),
  accountAccessVerified: true,
  syntheticOwnedSourceOnly: true,
  rightsAndRetentionApproved: true,
  providerHardCapAndOverageReviewed: true,
  transferMethod: "inline-base64-request-only",
  fixtureOutputSha256: null,
} satisfies V01Permit;
beforeEach(() => {
  calls.requests.length = 0;
  calls.responseStatus = 200;
  calls.responseType = "application/json";
  calls.response = Buffer.from("{}");
});
function gateway() {
  const readKey = vi.fn(async () => "offline-placeholder");
  const authority: V01Authority = {
    load: async () => ({ permit: p, payloadSha256: "b".repeat(64) }),
  };
  return {
    g: new FalV01Gateway(authority, "b".repeat(64), readKey, "known-task"),
    readKey,
  };
}
describe("real V01 HTTP serializer/parsers with completely intercepted network", () => {
  it("sends exactly one inline image submit and root-level GET status/result with current headers", async () => {
    const { g } = gateway();
    const body = {
      start_image_url: "data:image/jpeg;base64," + image.toString("base64"),
      prompt: compileServiceProfile("V01", {
        durationSeconds: 4,
        aspectRatio: "16:9",
      }).text!,
      duration: 4,
      resolution: "1080p" as const,
    };
    await g.submit(body);
    await g.status("known-task");
    await g.result("known-task");
    expect(calls.requests.map((x) => [x.options.method, x.url])).toEqual([
      ["POST", "https://queue.fal.run/kling/v4/image-to-video"],
      ["GET", "https://queue.fal.run/kling/v4/requests/known-task/status"],
      ["GET", "https://queue.fal.run/kling/v4/requests/known-task"],
    ]);
    expect(JSON.parse(calls.requests[0]!.body!)).toEqual(body);
    expect(
      calls.requests.every(
        (x) => x.options.headers["authorization"] === "Key offline-placeholder",
      ),
    ).toBe(true);
  });
  it("does not forward provider credentials to CDN outputs or follow redirects", async () => {
    const { g } = gateway();
    calls.responseType = "video/mp4";
    calls.response = Buffer.from("intercepted synthetic bytes");
    await g.download("https://v3.fal.media/owned-fixture.mp4", 1000);
    expect(calls.requests[0]!.options.headers["authorization"]).toBeUndefined();
    calls.responseStatus = 302;
    await expect(
      g.download("https://v3.fal.media/owned-fixture.mp4", 1000),
    ).rejects.toThrow();
    expect(calls.requests).toHaveLength(2);
  });
  it.each([
    "http://v3.fal.media/x.mp4",
    "https://127.0.0.1/x.mp4",
    "https://v3.fal.media.evil.invalid/x.mp4",
    "https://v3.fal.media:444/x.mp4",
    "https://user:password@v3.fal.media/x.mp4",
  ])("denies unsafe result URL %s before credential/network", async (url) => {
    const { g, readKey } = gateway();
    await expect(g.download(url, 1000)).rejects.toThrow();
    expect(readKey).not.toHaveBeenCalled();
    expect(calls.requests).toHaveLength(0);
    expect(() => v01ResultUrl(url)).toThrow();
  });
  it("rejects source/prompt/model-task confusion before HTTP and never automatically repeats POST", async () => {
    const { g, readKey } = gateway();
    await expect(
      g.submit({
        start_image_url: "https://external.invalid/customer.jpg",
        prompt: "invent another room",
        duration: 4,
        resolution: "1080p",
      }),
    ).rejects.toThrow();
    await expect(g.status("some-other-property-task")).rejects.toThrow(
      "V01_PROVIDER_ID_MISMATCH",
    );
    expect(readKey).not.toHaveBeenCalled();
    expect(calls.requests).toHaveLength(0);
    calls.responseStatus = 503;
    await expect(
      g.submit({
        start_image_url: "data:image/jpeg;base64," + image.toString("base64"),
        prompt: compileServiceProfile("V01", {
          durationSeconds: 4,
          aspectRatio: "16:9",
        }).text!,
        duration: 4,
        resolution: "1080p",
      }),
    ).rejects.toThrow();
    expect(
      calls.requests.filter((x) => x.options.method === "POST"),
    ).toHaveLength(1);
  });
  it("accepts the documented receipt without status, binds both published URL forms and rejects cross-task pairs", () => {
    expect(
      parseReceipt({
        request_id: "known-task",
        status_url: "https://queue.fal.run/kling/v4/requests/known-task/status",
        response_url: "https://queue.fal.run/kling/v4/requests/known-task",
      }).request_id,
    ).toBe("known-task");
    expect(
      validateQueueUrls(
        "known-task",
        "https://queue.fal.run/kling/v4/image-to-video/requests/known-task/status",
        "https://queue.fal.run/kling/v4/image-to-video/requests/known-task",
      ).result,
    ).toContain("image-to-video");
    expect(() =>
      parseReceipt({
        request_id: "known-task",
        status_url:
          "https://queue.fal.run/kling/v4/requests/another-task/status",
      }),
    ).toThrow();
    expect(() =>
      validateQueueUrls(
        "known-task",
        "https://evil.invalid/kling/v4/requests/known-task/status",
      ),
    ).toThrow();
  });
});
