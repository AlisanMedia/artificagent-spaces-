// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { lookup } from "node:dns";
import {
  SERVICE_IDS,
  SERVICE_FAMILIES,
  ProductionRequest,
} from "@/domain/production-services";
import { PRODUCTION_SERVICES } from "@/server/production/registry";
import {
  compileServiceProfile,
  ARCH_PRESERVE,
} from "@/server/production/prompts";
import {
  ProductionDisabledAdapter,
  normalizeProductionResult,
  WorldPhotoPayload,
  classifyProductionFailure,
  type ProductionSourceScope,
} from "@/adapters/providers/production-disabled";
import { LockedProductionTransport } from "@/server/production/transport";
import { ProductionAttempt } from "@/server/production/attempt";
import { LockedCandidateRetriever } from "@/server/production/output-ingress";
import type { ScopedSourceGrant } from "@/adapters/providers/api-first-policy";
import { buildApprovedListingBundle } from "@/server/production/bundle";
import {
  prepareProductionOperation,
  prepareWorldMediaAsset,
  normalizeFalQueueReceipt,
} from "@/adapters/providers/production-operations";

const now = 1_800_000_000_000;
vi.mock("node:https", () => ({
  request: vi.fn(() => {
    throw Error("NETWORK_FORBIDDEN");
  }),
}));
vi.mock("node:dns", () => ({
  lookup: vi.fn(() => {
    throw Error("DNS_FORBIDDEN");
  }),
}));
const source = {
  organizationId: "org-a",
  propertyId: "property-a",
  revision: 2,
  assetId: "photo-a",
  sha256: "a".repeat(64),
  width: 1200,
  height: 800,
  bytes: 12345,
  kind: "photo" as const,
  roomId: "living",
};
const grant: ScopedSourceGrant = {
  source,
  url: "https://sources.spaces.invalid/approved.jpg?grant=fixture",
  purpose: "provider-source",
  issuedAtMs: now - 1000,
  expiresAtMs: now + 59000,
};
const scope: ProductionSourceScope = {
  organizationId: source.organizationId,
  propertyId: source.propertyId,
  revision: 2,
  sources: [source],
  approvedGrants: [grant],
  rightsApproved: true,
  conceptApproved: true,
  publicTourApproved: false,
  panoramaHashes: [],
  emptyRoomHashes: [source.sha256],
  exteriorHashes: [source.sha256],
  mediaAssets: [
    {
      assetId: source.assetId,
      sha256: source.sha256,
      mediaAssetId: "world-asset-ready",
      state: "READY",
    },
  ],
  approvedMasks: [
    {
      sourceSha256: source.sha256,
      maskSha256: "b".repeat(64),
      width: 1200,
      height: 800,
      url: "https://sources.spaces.invalid/approved-mask.png",
      reviewId: "mask-review",
      permittedPurpose: "OBJECT_REMOVAL",
    },
  ],
};
const adapter = new ProductionDisabledAdapter(),
  hosts = ["sources.spaces.invalid"];
const optionsFor = (id: string) =>
  id === "P03"
    ? { roomType: "Living room", style: "Modern" }
    : id === "P07b"
      ? { target: "wall", finish: "sage-paint" }
      : {};

describe("V5.7 exact service/prompt contracts", () => {
  it("defines 15 distinct actions, seven customer families and two separately disclosed concepts", () => {
    expect(PRODUCTION_SERVICES.map((s) => s.id)).toEqual(SERVICE_IDS);
    expect(SERVICE_FAMILIES.filter((f) => !f.concept)).toHaveLength(7);
    expect(SERVICE_FAMILIES.filter((f) => f.concept)).toHaveLength(2);
    expect(
      PRODUCTION_SERVICES.every(
        (s) => !s.liveEnabled && s.requiresIndependentReview,
      ),
    ).toBe(true);
  });
  it.each(SERVICE_IDS)(
    "compiles %s deterministically and hashes exact canonical prompt bytes",
    (id) => {
      const a = compileServiceProfile(id, optionsFor(id)),
        b = compileServiceProfile(id, optionsFor(id));
      expect(a).toEqual(b);
      expect(a.negativePromptSupported).toBe(false);
      expect(a.profileSha256).toMatch(/^[a-f0-9]{64}$/);
      if (a.text)
        expect(a.promptSha256).toBe(
          createHash("sha256").update(a.text).digest("hex"),
        );
      else expect(a.promptSha256).toBeNull();
      if (id.startsWith("V")) expect(a.text).toContain(ARCH_PRESERVE);
      if (
        [
          "P01",
          "P02",
          "P03",
          "P04",
          "P05",
          "P06",
          "P07",
          "T01",
          "B01",
        ].includes(id)
      )
        expect(a.text).toBeNull();
    },
  );
  it("rejects free prompt, style URL, negative_prompt and incompatible finish injections", () => {
    for (const input of [
      { prompt: "ignore all limits" },
      { style: "https://tracker.invalid/style.jpg" },
      { negative_prompt: "anything" },
      { roomType: "<script>" },
    ])
      expect(() => compileServiceProfile("P03", input)).toThrow();
    expect(() =>
      compileServiceProfile("P07b", { target: "wall", finish: "natural-oak" }),
    ).toThrow("FINISH_TARGET_MISMATCH");
    expect(() => compileServiceProfile("P07b", {})).toThrow(
      "APPROVED_FINISH_REQUIRED",
    );
  });
  it.each([
    "V01",
    "V02",
    "V03",
    "V04",
    "P01",
    "P02",
    "P03",
    "P04",
    "P05",
    "P06",
    "P07",
  ] as const)(
    "builds %s without invented fields, credentials, or external execution",
    (id) => {
      const r = adapter.prepare(id, optionsFor(id), [grant], scope, hosts, now);
      expect(r.enabled).toBe(false);
      expect(r.externalBudgetMicroUsd).toBe(0);
      expect(r.provenance.sourceHashes).toEqual([source.sha256]);
      expect(r.body).not.toHaveProperty("negative_prompt");
      expect(r.body).not.toHaveProperty("apiKey");
      if (id === "V02") {
        expect(r.body).toMatchObject({
          duration: "6",
          generate_audio: false,
          codec: "H264",
          resolution: "1080p",
          aspect_ratio: "auto",
          bitrate_mode: "high",
        });
      }
      if (["V01", "V03", "V04"].includes(id))
        expect(r.body).toMatchObject({
          duration: 5,
          start_image_url: grant.url,
        });
      if (["P01", "P02"].includes(id))
        expect(r.body).toEqual({
          imageUrl: grant.url,
          highFidelity: true,
          preserveAspectRatio: false,
        });
      if (id.startsWith("P")) expect(r.body).not.toHaveProperty("prompt");
    },
  );
  it("matches payload keys/types to independently retrieved official fal OpenAPI subsets", () => {
    for (const [id, file, name] of [
      ["V01", "fal-kling", "V4ImageToVideoInput"],
      ["V02", "fal-seedance", "Seedance25UsImageToVideoInput"],
    ] as const) {
      const snapshot = JSON.parse(
        readFileSync(`fixtures/providers-v57/${file}.json`, "utf8"),
      );
      const schema = snapshot.schemas[name],
        r = adapter.prepare(id, {}, [grant], scope, hosts, now);
      for (const key of Object.keys(r.body!))
        expect(Object.keys(schema.properties)).toContain(key);
      expect(schema.properties).not.toHaveProperty("negative_prompt");
      if (id === "V02")
        expect(schema.properties.duration.enum).toContain(r.body!["duration"]);
      else
        expect(typeof r.body!["duration"]).toBe(
          schema.properties.duration.type === "integer"
            ? "number"
            : "unexpected",
        );
    }
  });
  it("does not confuse concept permission with target-mask approval", () => {
    expect(() =>
      adapter.prepare("P07b", optionsFor("P07b"), [grant], scope, hosts, now),
    ).toThrow("TARGET_REGION_REVIEW_REQUIRED");
    const s = {
      ...scope,
      approvedMasks: scope.approvedMasks.map((m) => ({
        ...m,
        permittedPurpose: "FINISH_CONCEPT" as const,
      })),
    };
    const r = adapter.prepare(
      "P07b",
      optionsFor("P07b"),
      [grant],
      s,
      hosts,
      now,
    );
    expect(r.body).toMatchObject({
      resolution: "2K",
      num_images: 1,
      output_format: "png",
      aspect_ratio: "auto",
    });
    expect(r.provenance.profileVersion).toBe("photo.precision-edit.v1");
    expect(() =>
      adapter.prepare(
        "P07",
        {},
        [grant],
        { ...scope, conceptApproved: false },
        hosts,
        now,
      ),
    ).toThrow("CONCEPT_PERMISSION_REQUIRED");
  });
  it("rejects tenant/revision/SHA/rights/grant-window cross-talk before request construction", () => {
    for (const patch of [
      { organizationId: "org-b" },
      { revision: 3 },
      { propertyId: "property-b" },
    ])
      expect(() =>
        adapter.prepare("P01", {}, [grant], { ...scope, ...patch }, hosts, now),
      ).toThrow();
    expect(() =>
      adapter.prepare(
        "P01",
        {},
        [{ ...grant, source: { ...source, sha256: "b".repeat(64) } }],
        scope,
        hosts,
        now,
      ),
    ).toThrow();
    expect(() =>
      adapter.prepare(
        "P01",
        {},
        [grant],
        { ...scope, rightsApproved: false },
        hosts,
        now,
      ),
    ).toThrow("SOURCE_RIGHTS_REQUIRED");
    expect(() =>
      adapter.prepare("P01", {}, [grant], scope, hosts, now + 60_000),
    ).toThrow();
    expect(() =>
      adapter.prepare("P01", { style: "Modern" }, [grant], scope, hosts, now),
    ).toThrow("SERVICE_OPTIONS_NOT_ALLOWED");
    expect(() =>
      adapter.prepare(
        "P05",
        {},
        [grant],
        { ...scope, approvedMasks: [] },
        hosts,
        now,
      ),
    ).toThrow();
    expect(() =>
      adapter.prepare(
        "P03",
        optionsFor("P03"),
        [grant],
        { ...scope, emptyRoomHashes: [] },
        hosts,
        now,
      ),
    ).toThrow();
    expect(() =>
      adapter.prepare(
        "V04",
        {},
        [grant],
        { ...scope, exteriorHashes: [] },
        hosts,
        now,
      ),
    ).toThrow();
  });
  it("uses private ready media-assets for World Labs and refuses unrelated rooms or invented azimuth", () => {
    const r = adapter.prepare("T02", {}, [grant], scope, hosts, now);
    expect(WorldPhotoPayload.parse(r.body).world_prompt).toMatchObject({
      type: "image",
      image_prompt: {
        source: "media_asset",
        media_asset_id: "world-asset-ready",
      },
    });
    expect(r.body!["permission"]).toMatchObject({
      public: false,
      allow_id_access: false,
    });
    expect(JSON.stringify(r.body)).not.toContain(grant.url);
    expect(() =>
      adapter.prepare(
        "T02",
        {},
        [grant],
        { ...scope, mediaAssets: [] },
        hosts,
        now,
      ),
    ).toThrow();
    const s2 = {
        ...source,
        assetId: "photo-b",
        sha256: "b".repeat(64),
        roomId: "bedroom",
      },
      g2 = {
        ...grant,
        source: s2,
        url: "https://sources.spaces.invalid/b.jpg",
      };
    const two = {
      ...scope,
      sources: [source, s2],
      approvedGrants: [grant, g2],
      mediaAssets: [
        ...scope.mediaAssets,
        {
          assetId: s2.assetId,
          sha256: s2.sha256,
          mediaAssetId: "world-b",
          state: "READY" as const,
        },
      ],
    };
    expect(() =>
      adapter.prepare("T02", {}, [grant, g2], two, hosts, now),
    ).toThrow("SAME_SCENE_EVIDENCE_REQUIRED");
    const same = { ...g2, source: { ...s2, roomId: "living" } },
      good = {
        ...two,
        sources: [source, same.source],
        approvedGrants: [grant, same],
      };
    const multi = adapter.prepare("T02", {}, [grant, same], good, hosts, now);
    expect(JSON.stringify(multi.body)).not.toContain("azimuth");
    expect(multi.body!["world_prompt"]).toMatchObject({ type: "multi-image" });
  });
  it("requires proven panoramas and publication permission before Pedra hosted tour preparation", () => {
    const p = {
        ...source,
        kind: "panorama" as const,
        width: 1600,
        height: 800,
      },
      g = { ...grant, source: p },
      s = { ...scope, sources: [p], approvedGrants: [g] };
    expect(() => adapter.prepare("T01", {}, [g], s, hosts, now)).toThrow(
      "BLOCKED_PUBLIC_TOUR_APPROVAL",
    );
    expect(() =>
      adapter.prepare(
        "T01",
        {},
        [g],
        { ...s, publicTourApproved: true },
        hosts,
        now,
      ),
    ).toThrow("GENUINE_PANORAMA_EVIDENCE_REQUIRED");
    const r = adapter.prepare(
      "T01",
      {},
      [g],
      { ...s, publicTourApproved: true, panoramaHashes: [p.sha256] },
      hosts,
      now,
    );
    expect(r.body).toMatchObject({ language: "en", linking: "sequential" });
    expect(r.body).not.toHaveProperty("embedCode");
  });
  it("has no secret reads, HTTP primitive or billing side effects even with flags and supplied credentials", async () => {
    const primitive = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw Error("NETWORK_FORBIDDEN");
    });
    const read = vi.fn(async () => "never-read-fixture");
    const r = adapter.prepare("P01", {}, [grant], scope, hosts, now);
    vi.stubEnv("SPACES_PROVIDER_LIVE_ENABLED", "true");
    vi.stubEnv("SPACES_EXTERNAL_MAX_USD", "999");
    await expect(
      new LockedProductionTransport().execute(
        r,
        { read },
        new AbortController().signal,
      ),
    ).rejects.toThrow("BLOCKED_EXTERNAL_APPROVAL");
    for (const operation of [
      "submit",
      "getStatus",
      "getResult",
      "cancel",
    ] as const)
      await expect(adapter[operation](r)).rejects.toThrow(
        "BLOCKED_EXTERNAL_APPROVAL",
      );
    expect(read).not.toHaveBeenCalled();
    await expect(
      new LockedCandidateRetriever().retrieve(
        {
          url: "https://img.pedra.ai/offline-never-downloaded",
          provider: "pedra",
          mime: "image/png",
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow("BLOCKED_EXTERNAL_APPROVAL");
    expect(primitive).not.toHaveBeenCalled();
    expect(httpsRequest).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
    primitive.mockRestore();
    vi.unstubAllEnvs();
  });
  it("rejects nonzero authorization rather than treating a quote or secret as approval", () => {
    const body = {
      propertyId: "property-a",
      revision: 2,
      serviceId: "P01",
      sourceAssetIds: ["photo-a"],
      rights: { syntheticOnly: true, ownedOrLicensed: true },
      idempotencyKey: "sample-idempotency",
      maxCostMicroUsd: 1,
    };
    expect(ProductionRequest.safeParse(body).success).toBe(false);
    expect(
      ProductionRequest.safeParse({
        ...body,
        maxCostMicroUsd: 0,
        prompt: "injected",
      }).success,
    ).toBe(false);
  });
});
describe("V5.7 untrusted result/operation policy", () => {
  it("constructs only server-bound poll/cancel/media-asset paths and discards callback URL injection", () => {
    const receipt = normalizeFalQueueReceipt({
      request_id: "stored-queue-task",
      status: "IN_QUEUE",
      response_url: "https://attacker.invalid",
    });
    expect(receipt).not.toHaveProperty("response_url");
    expect(
      prepareProductionOperation("P07b", receipt.request_id, "status"),
    ).toMatchObject({
      origin: "https://queue.fal.run",
      path: "/fal-ai/nano-banana-pro/edit/requests/stored-queue-task/status",
      enabled: false,
    });
    expect(
      prepareProductionOperation("V01", receipt.request_id, "cancel").method,
    ).toBe("PUT");
    expect(
      prepareProductionOperation("T02", "stored-operation", "result").path,
    ).toBe("/marble/v1/operations/stored-operation");
    expect(() =>
      prepareProductionOperation("T02", "operation", "cancel"),
    ).toThrow("PROVIDER_CANCEL_NOT_VERIFIED");
    expect(() => prepareProductionOperation("P01", "task", "status")).toThrow(
      "SYNC_OR_CANCEL_RECONCILIATION_REQUIRED",
    );
    expect(() =>
      prepareProductionOperation("V01", "../other?host=evil", "result"),
    ).toThrow();
    const media = prepareWorldMediaAsset(grant, scope, hosts, now);
    expect(media.body).toMatchObject({ extension: "jpg", kind: "image" });
    expect(JSON.stringify(media.body)).not.toContain("property-a");
    expect(media.enabled).toBe(false);
  });
  it.each(["P01", "P02", "P03", "P04", "P07"] as const)(
    "%s accepts only the documented array shape and preserves QA hold",
    (id) => {
      const [r] = normalizeProductionResult(id, {
        output: [{ url: "https://img.pedra.ai/generated-fixture" }],
        apiKey: "must-discard-untrusted",
      });
      expect(r).toMatchObject({
        verifiedBytes: false,
        state: "QA_HOLD",
        directCustomerDownloadAllowed: false,
      });
      expect(JSON.stringify(r)).not.toContain("apiKey");
      expect(() =>
        normalizeProductionResult(id, {
          output: { url: "https://img.pedra.ai/generated-fixture" },
        }),
      ).toThrow();
    },
  );
  it.each(["P05", "P06"] as const)(
    "%s accepts only the documented object shape",
    (id) => {
      expect(
        normalizeProductionResult(id, {
          output: { url: "https://img.pedra.ai/generated-fixture" },
        }),
      ).toHaveLength(1);
      expect(() =>
        normalizeProductionResult(id, {
          output: [{ url: "https://img.pedra.ai/generated-fixture" }],
        }),
      ).toThrow();
    },
  );
  it("refuses SSRF, localhost, unsafe metadata and wrong declared media", () => {
    for (const url of [
      "http://img.pedra.ai/a",
      "https://127.0.0.1/a",
      "https://img.pedra.ai.evil.invalid/a",
      "https://user:pass@img.pedra.ai/a",
      "https://img.pedra.ai/%2fsecret",
    ])
      expect(() =>
        normalizeProductionResult("P05", { output: { url } }),
      ).toThrow();
    expect(() =>
      normalizeProductionResult("V01", {
        video: { url: "https://v3.fal.media/clip", content_type: "text/html" },
      }),
    ).toThrow();
    expect(
      normalizeProductionResult("V02", {
        video: { url: "https://v3.fal.media/clip", content_type: "video/mp4" },
      })[0]!.verifiedBytes,
    ).toBe(false);
    expect(
      normalizeProductionResult("P07b", {
        images: [
          { url: "https://v3.fal.media/image", content_type: "image/png" },
        ],
      }),
    ).toHaveLength(1);
    expect(() =>
      normalizeProductionResult("V01", {
        video: {
          url: "https://storage.googleapis.com/other-bucket/private",
          content_type: "video/mp4",
        },
      }),
    ).toThrow();
  });
  it("holds unknown acceptance/timeout/cancelled submitted work and never invents a refund", () => {
    expect(classifyProductionFailure({ timedOut: true })).toBe(
      "HOLD_UNKNOWN_NO_RESUBMIT",
    );
    expect(classifyProductionFailure({ accepted: true, cancelled: true })).toBe(
      "HOLD_UNKNOWN_NO_RESUBMIT",
    );
    expect(
      classifyProductionFailure({ accepted: false, httpStatus: 429 }),
    ).toBe("KNOWN_NOT_ACCEPTED_BACKOFF_ONLY");
    const a = new ProductionAttempt();
    expect(() => a.begin(null, 0, 0)).toThrow();
    expect(() => a.begin(100, 100, 0)).toThrow("BLOCKED_EXTERNAL_APPROVAL");
    a.begin(0, 0, 0);
    a.submitted("unknown");
    expect(() => a.begin(0, 0, 0)).toThrow("ATTEMPT_FENCED");
    expect(a.actualMicroUsd).toBeNull();
    const retried = new ProductionAttempt();
    retried.begin(0, 0, 0);
    retried.submitted("known-not-accepted");
    retried.begin(0, 0, 0);
    retried.submitted("unknown");
    expect(retried.actualMicroUsd).toBeNull();
    const b = new ProductionAttempt();
    b.begin(0, 0, 0);
    b.submitted("accepted");
    b.poll("processing", 0, now + 1, now);
    b.cancel();
    expect(b.state).toBe("HOLD_UNKNOWN");
    expect(() => b.poll("received", 0, now + 1, now)).toThrow();
    const c = new ProductionAttempt();
    c.begin(0, 0, 0);
    c.submitted("known-not-accepted");
    c.begin(0, 0, 0);
    c.submitted("known-not-accepted");
    expect(c.state).toBe("FAILED");
    const d = new ProductionAttempt();
    d.begin(0, 0, 0);
    d.submitted("accepted");
    d.poll("queued", 0, now, now);
    expect(d.state).toBe("HOLD_UNKNOWN");
  });
  it("makes an actual bounded ZIP only from approved same-scope immutable artifacts", () => {
    const bytes = readFileSync("public/golden-v5/living.png"),
      hash = createHash("sha256").update(bytes).digest("hex");
    const a = {
      id: "artifact-1",
      organizationId: "org-a",
      propertyId: "property-a",
      revision: 2,
      bytes,
      sha256: hash,
      mime: "image/png" as const,
      createdBy: "creator",
      reviewerId: "reviewer",
      reviewedOutputSha256: hash,
      state: "approved" as const,
      revoked: false,
      disclosure: "Explicit offline contract fixture",
    };
    const s = {
      organizationId: "org-a",
      propertyId: "property-a",
      revision: 2,
    };
    const r = buildApprovedListingBundle([a], s);
    expect(r.bytes.readUInt32LE(0)).toBe(0x04034b50);
    expect(r.bytes.includes(Buffer.from("provenance.json"))).toBe(true);
    expect(r.state).toBe("QA_HOLD");
    for (const p of [
      { reviewerId: "creator" },
      { revoked: true },
      { sha256: "f".repeat(64) },
      { organizationId: "org-b" },
      { revision: 3 },
    ])
      expect(() => buildApprovedListingBundle([{ ...a, ...p }], s)).toThrow();
  });
});
