import { describe, it, expect, vi } from "vitest";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  PROPERTY_CAMERA_PROMPTS,
  PROPERTY_SOURCE_SUFFIX,
  PROPERTY_PROMPT_VERSION,
  propertyPrompt,
} from "@/domain/real-estate-prompts";
import {
  PROPERTY_STYLE_CARDS,
  STUDIO_PRODUCTS,
} from "@/domain/real-estate-styles";
import {
  planStudioProduct,
  localJobPhase,
  STUDIO_JOB_PHASES,
  type ApprovedPhotoReference,
} from "@/domain/api-first-studio";
import { GenerationInput } from "@/domain/platform";
import { renderProfile } from "@/domain/video-quality";
import {
  FalKling4DisabledAdapter,
  FalSeedance25DisabledAdapter,
  FalKling4Payload,
  FalSeedance25Payload,
  FAL_CONTRACTS,
  prepareFalQueueRead,
} from "@/adapters/providers/fal-video-disabled";
import { MarblePlusDisabledAdapter } from "@/adapters/providers/marble-plus-disabled";
import { PedraDisabledAdapter } from "@/adapters/providers/pedra-disabled";
import {
  allowlistedHttpsUrl,
  validateSourceGrant,
  type ScopedSourceGrant,
  type ProviderSourceScope,
} from "@/adapters/providers/api-first-policy";
import { verifyFalWebhook } from "@/adapters/providers/fal-webhook";
import { OfflineProviderAttempt } from "@/application/provider-attempt-v54";

const now = 1_800_000_000_000;
const photos: ApprovedPhotoReference[] = Array.from({ length: 12 }, (_, i) => ({
  organizationId: "org-a",
  propertyId: "property-a",
  revision: 2,
  assetId: `photo-${i}`,
  sha256: i.toString(16).padStart(64, "a"),
  width: 1200,
  height: 800,
  bytes: 12000,
  kind: "photo",
  roomId: "living",
}));
const grants: ScopedSourceGrant[] = photos.map((source) => ({
  source,
  url: `https://sources.spaces.invalid/${source.assetId}.jpg?scope=synthetic-only`,
  purpose: "provider-source",
  issuedAtMs: now - 1000,
  expiresAtMs: now + 59000,
}));
const scope: ProviderSourceScope = {
  organizationId: "org-a",
  propertyId: "property-a",
  revision: 2,
  sources: photos,
  approvedGrants: grants,
};
const hosts = ["sources.spaces.invalid"];
const request = {
  propertyId: "property-a",
  revision: 2,
  product: "video",
  styleId: "natural",
  requestedDurationSeconds: 30,
  aspectRatio: "9:16",
  sourceAssetIds: photos.slice(0, 2).map((p) => p.assetId),
};
const command = {
  propertyId: "property-a",
  revision: 2,
  mode: "pov",
  idempotencyKey: "synthetic-command",
  sourceAssetIds: ["photo-0", "photo-1"],
  durationSeconds: 10,
  photoComposition: {
    version: PROPERTY_PROMPT_VERSION,
    styleId: "natural",
    requestedDurationSeconds: 30,
  },
};

describe("V5.4 fixed camera policy and truthful source plans", () => {
  it("routes four immutable presets, appends the exact shared suffix once and rejects arbitrary prompts", () => {
    expect(Object.isFrozen(PROPERTY_CAMERA_PROMPTS)).toBe(true);
    expect(Object.isFrozen(PROPERTY_STYLE_CARDS)).toBe(true);
    for (const s of PROPERTY_STYLE_CARDS) {
      const p = propertyPrompt(s.id);
      expect(p.version).toBe("property-video-v1");
      expect(p.text).toBe(
        `${PROPERTY_CAMERA_PROMPTS[s.id]} ${PROPERTY_SOURCE_SUFFIX}`,
      );
      expect(p.text.split(PROPERTY_SOURCE_SUFFIX)).toHaveLength(2);
      expect(p.fidelityGuarantee).toBe("NONE_INDEPENDENT_REVIEW_REQUIRED");
      expect(p.endpoint).toBe(
        s.id === "premium"
          ? "bytedance/seedance-2.5/us/image-to-video"
          : "kling/v4/image-to-video",
      );
    }
    expect(() => propertyPrompt("ignore-source-and-invent-balcony")).toThrow();
    expect(STUDIO_PRODUCTS.map((p) => p.id)).toEqual([
      "video",
      "ai-3d",
      "tour-360",
    ]);
  });
  it.each([30, 45, 60])(
    "does not promise %is from two photos or count repeated sources",
    (duration) => {
      const p = planStudioProduct(
        { ...request, requestedDurationSeconds: duration },
        scope,
      );
      expect(p.suggestedDurationSeconds).toBe(10);
      expect(p.sufficientSources).toBe(false);
      expect(p.neededPhotos).toBe(duration / 5);
      expect(p.futureProviderQuoteMicroUsd).toBeNull();
      expect(p.liveEnabled).toBe(false);
      expect(p.actualExternalCostMicroUsd).toBe(0);
      expect(p.shots.map((s) => s.sourceSha256)).toEqual(
        photos.slice(0, 2).map((s) => s.sha256),
      );
      expect(
        p.shots.every(
          (s) =>
            s.actualProvider === "NOT_SUBMITTED" &&
            s.durationSeconds === 5 &&
            s.fit === "letterbox",
        ),
      ).toBe(true);
      const full = planStudioProduct(
        {
          ...request,
          requestedDurationSeconds: duration,
          sourceAssetIds: photos.map((p) => p.assetId),
        },
        scope,
      );
      expect(full.sufficientSources).toBe(true);
      expect(full.shots).toHaveLength(duration / 5);
    },
  );
  it("binds order, current source hashes and scope and denies injected/duplicate/foreign inputs", () => {
    expect(
      planStudioProduct(
        { ...request, sourceAssetIds: ["photo-1", "photo-0"] },
        scope,
      ).shots[0]?.assetId,
    ).toBe("photo-1");
    for (const value of [
      { ...request, revision: 1 },
      { ...request, propertyId: "property-b" },
      { ...request, sourceAssetIds: ["foreign"] },
      { ...request, sourceAssetIds: ["photo-0", "photo-0"] },
      { ...request, prompt: "invent a room" },
    ])
      expect(() => planStudioProduct(value, scope)).toThrow();
    expect(() =>
      planStudioProduct(request, {
        ...scope,
        sources: [{ ...photos[0]!, organizationId: "org-b" }, photos[1]!],
      }),
    ).toThrow();
    expect(() =>
      planStudioProduct(request, {
        ...scope,
        sources: [photos[0]!, { ...photos[1]!, sha256: photos[0]!.sha256 }],
      }),
    ).toThrow("DISTINCT_PHOTOS_REQUIRED");
  });
  it("distinguishes AI spatial interpretation from actual 2:1 panorama evidence", () => {
    expect(
      planStudioProduct({ ...request, product: "ai-3d" }, scope).blockers,
    ).toContain("BLOCKED_LEGAL_APPROVAL");
    expect(() =>
      planStudioProduct({ ...request, product: "tour-360" }, scope),
    ).toThrow("PANORAMA_2_TO_1_REQUIRED");
    expect(() =>
      planStudioProduct(
        { ...request, product: "tour-360" },
        {
          ...scope,
          sources: photos.map((s) => ({ ...s, width: 1600, height: 800 })),
        },
      ),
    ).toThrow("PANORAMA_CONFIRMATION_REQUIRED");
    expect(
      planStudioProduct(
        { ...request, product: "tour-360", panoramaConfirmed: true },
        {
          ...scope,
          sources: photos.map((s) => ({ ...s, width: 1600, height: 800 })),
        },
      ).product,
    ).toBe("tour-360");
  });
  it("preserves legacy duration restrictions while allowing only source-count-bound local photo edits", () => {
    expect(GenerationInput.parse(command).durationSeconds).toBe(10);
    for (const v of [
      { ...command, photoComposition: undefined },
      { ...command, durationSeconds: 60 },
      { ...command, mode: "interactive-3d" },
      { ...command, sourceAssetIds: undefined },
      { ...command, durationSeconds: 6 },
    ])
      expect(() => GenerationInput.parse(v)).toThrow();
    expect(
      GenerationInput.parse({
        ...command,
        photoComposition: undefined,
        durationSeconds: 8,
      }).durationSeconds,
    ).toBe(8);
    expect(() => renderProfile("16:9", 30)).toThrow(
      "UNSUPPORTED_LOCAL_DURATION",
    );
    expect(
      renderProfile("9:16", 5, undefined, "photo-clips-v54"),
    ).toMatchObject({
      width: 360,
      height: 640,
      durationSeconds: 5,
      id: "photo-clips-v54",
    });
    expect(() =>
      renderProfile("9:16", 60, undefined, "photo-clips-v54"),
    ).toThrow();
    for (const [input, output] of [
      ["unknown-submission", "qa-held"],
      ["rejected", "qa-held"],
      ["queued", "queued"],
      ["processing", "processing"],
      ["awaiting-review", "awaiting-review"],
      ["approved", "approved"],
      ["failed", "failed"],
      ["cancelled", "cancelled"],
      ["not-a-state", "draft"],
    ])
      expect(localJobPhase(input!)).toBe(output);
    expect(STUDIO_JOB_PHASES).toContain("awaiting-provider-approval");
  });
});

describe("V5.4 disabled fal contracts from independent official schema snapshots", () => {
  const kling = new FalKling4DisabledAdapter(),
    seedance = new FalSeedance25DisabledAdapter();
  it("prepares Kling integer duration and Seedance string duration, silent H264 without unapproved fields", () => {
    const k = kling.prepare(
      { styleId: "natural", durationSeconds: 1, maxCostMicroUsd: 0 },
      grants[0],
      scope,
      hosts,
      now,
    );
    expect(k).toMatchObject({
      enabled: false,
      externalBudgetMicroUsd: 0,
      path: "/kling/v4/image-to-video",
    });
    expect(k.body).toMatchObject({ duration: 3, resolution: "1080p" });
    expect(k.body).not.toHaveProperty("generate_audio");
    const s = seedance.prepare(
      { styleId: "premium", durationSeconds: 60, maxCostMicroUsd: 0 },
      grants[0],
      scope,
      hosts,
      now,
    );
    expect(s.body).toMatchObject({
      duration: "30",
      generate_audio: false,
      codec: "H264",
      bitrate_mode: "high",
      aspect_ratio: "auto",
    });
    for (const [name, payload] of [
      ["fal-kling-openapi", k.body],
      ["fal-seedance-openapi", s.body],
    ] as const) {
      const snapshot = JSON.parse(
        readFileSync(`fixtures/providers-v54/${name}.json`, "utf8"),
      ) as {
        schemas: Record<
          string,
          { properties: Record<string, unknown>; required: string[] }
        >;
      };
      const schema = Object.values(snapshot.schemas).find(
        (v) => v.properties?.["start_image_url"] || v.properties?.["image_url"],
      )!;
      expect(
        Object.keys(payload! as object).every(
          (key) => key in schema.properties,
        ),
      ).toBe(true);
      expect(schema.required.every((key) => key in payload!)).toBe(true);
      expect((schema.properties["duration"] as { type: string }).type).toBe(
        name === "fal-kling-openapi" ? "integer" : "string",
      );
    }
    expect(() =>
      FalKling4Payload.parse({ ...k.body, generate_audio: false }),
    ).toThrow();
    expect(() =>
      FalSeedance25Payload.parse({ ...s.body, codec: "H265" }),
    ).toThrow();
  });
  it("denies model/style mixing, paid caps, free prompt injection and cross-room frame transitions", () => {
    expect(() =>
      kling.prepare(
        { styleId: "premium", durationSeconds: 5, maxCostMicroUsd: 0 },
        grants[0],
        scope,
        hosts,
        now,
      ),
    ).toThrow("UNSUPPORTED_MODEL_STYLE");
    expect(() =>
      seedance.prepare(
        { styleId: "natural", durationSeconds: 5, maxCostMicroUsd: 0 },
        grants[0],
        scope,
        hosts,
        now,
      ),
    ).toThrow();
    expect(() =>
      kling.prepare(
        { styleId: "natural", durationSeconds: 5, maxCostMicroUsd: 1 },
        grants[0],
        scope,
        hosts,
        now,
      ),
    ).toThrow();
    expect(() =>
      kling.prepare(
        {
          styleId: "natural",
          durationSeconds: 5,
          maxCostMicroUsd: 0,
          prompt: "invent room",
        },
        grants[0],
        scope,
        hosts,
        now,
      ),
    ).toThrow();
    expect(
      kling.prepare(
        { styleId: "explore", durationSeconds: 5, maxCostMicroUsd: 0 },
        grants[0],
        scope,
        hosts,
        now,
        grants[1],
      ).body,
    ).toHaveProperty("end_image_url");
    const bad = { ...grants[1]!, source: { ...photos[1]!, roomId: "bedroom" } };
    expect(() =>
      kling.prepare(
        { styleId: "exterior", durationSeconds: 5, maxCostMicroUsd: 0 },
        grants[0],
        {
          ...scope,
          sources: [photos[0]!, bad.source],
          approvedGrants: [grants[0]!, bad],
        },
        hosts,
        now,
        bad,
      ),
    ).toThrow("CROSS_ROOM_END_FRAME_DENIED");
    const small = { ...grants[0]!, source: { ...photos[0]!, width: 200 } };
    expect(() =>
      kling.prepare(
        { styleId: "natural", durationSeconds: 5, maxCostMicroUsd: 0 },
        small,
        { ...scope, sources: [small.source], approvedGrants: [small] },
        hosts,
        now,
      ),
    ).toThrow("FAL_FRAME_DIMENSIONS_UNSUPPORTED");
  });
  it("never treats provider URLs or declared MIME/bytes as a verified downloadable artifact", () => {
    expect(
      kling.normalizeOutput({
        video: {
          url: "https://v3b.fal.media/generated.mp4",
          content_type: "video/mp4",
          file_size: 1234,
        },
      }),
    ).toMatchObject({
      verifiedBytes: false,
      state: "QA_HOLD",
      directCustomerDownloadAllowed: false,
    });
    for (const url of [
      "http://127.0.0.1/x",
      "https://evil.example/x",
      "https://storage.googleapis.com/untrusted/x",
      "https://v3b.fal.media.evil.example/x",
    ])
      expect(() =>
        kling.normalizeOutput({ video: { url, content_type: "video/mp4" } }),
      ).toThrow();
    expect(() =>
      seedance.normalizeOutput({
        video: { url: "https://v3b.fal.media/x", content_type: "text/html" },
      }),
    ).toThrow();
    expect(() =>
      kling.normalizeOutput({
        video: {
          url: "https://v3b.fal.media/x",
          content_type: "video/mp4",
          file_size: 100_000_000,
        },
      }),
    ).toThrow();
    expect(
      seedance.normalizeOutput({
        video: {
          url: "https://storage.googleapis.com/falserverless/generated.mp4",
          content_type: "video/mp4",
        },
      }).verifiedBytes,
    ).toBe(false);
  });
  it("pins server-returned queue task URLs and their operation to the stored request", () => {
    const model = FAL_CONTRACTS.kling.endpoint;
    const h = {
      request_id: "request-a",
      status_url: `https://queue.fal.run/${model}/requests/request-a/status`,
      response_url: `https://queue.fal.run/${model}/requests/request-a`,
      cancel_url: `https://queue.fal.run/${model}/requests/request-a/cancel`,
    };
    expect(prepareFalQueueRead(h, "request-a", "status", model).method).toBe(
      "GET",
    );
    expect(prepareFalQueueRead(h, "request-a", "cancel", model).method).toBe(
      "PUT",
    );
    expect(prepareFalQueueRead(h, "request-a", "result", model).path).toBe(
      `/${model}/requests/request-a`,
    );
    expect(() =>
      prepareFalQueueRead(h, "request-b", "status", model),
    ).toThrow();
    expect(() =>
      prepareFalQueueRead(
        { ...h, response_url: "https://evil.example/request-a" },
        "request-a",
        "result",
        model,
      ),
    ).toThrow();
    expect(() =>
      prepareFalQueueRead(
        { ...h, status_url: h.cancel_url },
        "request-a",
        "status",
        model,
      ),
    ).toThrow();
    expect(() =>
      prepareFalQueueRead(
        h,
        "request-a",
        "result",
        FAL_CONTRACTS.seedance.endpoint,
      ),
    ).toThrow();
    for (const endpoint of [model, FAL_CONTRACTS.seedance.endpoint]) {
      const snapshot = JSON.parse(
        readFileSync(
          endpoint === model
            ? "fixtures/providers-v54/fal-kling-openapi.json"
            : "fixtures/providers-v54/fal-seedance-openapi.json",
          "utf8",
        ),
      ) as { paths: string[] };
      for (const kind of ["status", "cancel", "result"] as const) {
        const suffix = kind === "result" ? "" : `/${kind}`;
        const url = `https://queue.fal.run/${endpoint}/requests/request-a${suffix}`;
        const request = prepareFalQueueRead(
          {
            request_id: "request-a",
            status_url: url,
            cancel_url: url,
            response_url: url,
          },
          "request-a",
          kind,
          endpoint,
        );
        expect(snapshot.paths).toContain(
          request.path.replace("request-a", "{request_id}"),
        );
      }
    }
  });
});

describe("V5.4 private grant, Marble and genuine panorama boundaries", () => {
  it("rejects forged URL/grant, expiry, wrong revision/hash, private hosts and oversized frames before transport", () => {
    for (const g of [
      { ...grants[0]!, url: grants[1]!.url },
      { ...grants[0]!, source: { ...photos[0]!, revision: 1 } },
      { ...grants[0]!, source: { ...photos[0]!, sha256: "f".repeat(64) } },
      { ...grants[0]!, expiresAtMs: now - 1 },
      { ...grants[0]!, expiresAtMs: now + 120000 },
    ])
      expect(() => validateSourceGrant(g, scope, hosts, now)).toThrow();
    for (const url of [
      "http://sources.spaces.invalid/a",
      "https://sources.spaces.invalid@evil.example/a",
      "https://127.0.0.1/a",
      "https://sources.spaces.invalid/a%2fprivate",
      "https://sources.spaces.invalid:8443/a",
      "not-url",
    ])
      expect(() => allowlistedHttpsUrl(url, hosts)).toThrow();
  });
  it("prepares private photo / multi-photo Marble 1.1 Plus with no invented angles or reconstruction claim", () => {
    const p = new MarblePlusDisabledAdapter();
    expect(
      p.prepare("Synthetic property", [grants[0]], scope, hosts, now),
    ).toMatchObject({
      enabled: false,
      body: {
        model: "marble-1.1-plus",
        permission: { public: false, allow_id_access: false },
        world_prompt: { type: "image", is_pano: "false" },
      },
    });
    const m = p.prepare(
      "Synthetic property",
      grants.slice(0, 2),
      scope,
      hosts,
      now,
    );
    expect(m.body).toMatchObject({
      world_prompt: { type: "multi-image", reconstruct_images: false },
    });
    expect(JSON.stringify(m.body)).not.toContain("azimuth");
    expect(() =>
      p.prepare("Synthetic property", grants.slice(0, 5), scope, hosts, now),
    ).toThrow("MARBLE_PHOTO_LIMIT");
    expect(() =>
      p.prepare(
        "Synthetic property",
        [grants[0], grants[0]],
        scope,
        hosts,
        now,
      ),
    ).toThrow("DISTINCT_PHOTOS_REQUIRED");
    expect(p.prepareOperation("op-a").path).toBe("/marble/v1/operations/op-a");
    expect(() => p.prepareOperation("../bad")).toThrow();
    expect(p.prepareExport("world-a", "mesh").body).toEqual({
      asset_type: "mesh",
      format: "glb",
    });
    expect(p.prepareExport("world-a", "splats").body).toMatchObject({
      format: "ply",
    });
    for (const [done, error, state] of [
      [false, null, "PROCESSING"],
      [true, null, "QA_HOLD"],
      [true, { code: 1 }, "FAILED"],
    ] as const)
      expect(
        p.normalizeOperation({ operation_id: "op-a", done, error }, "op-a")
          .state,
      ).toBe(state);
    expect(() =>
      p.normalizeOperation({ operation_id: "foreign", done: true }, "op-a"),
    ).toThrow();
    expect(() =>
      p.normalizeAsset("https://evil.example/x", [], "spz"),
    ).toThrow();
    expect(
      p.normalizeAsset(
        "https://assets.spaces.invalid/x",
        ["assets.spaces.invalid"],
        "glb",
      ).permissionToPublish,
    ).toBe(false);
  });
  it("requires actual panorama ratio, rejects Turkish provider language and discards untrusted HTML", () => {
    const p = new PedraDisabledAdapter(),
      tourId = "11111111-1111-4111-8111-111111111111";
    expect(() =>
      p.prepare("Synthetic tour", "en", [grants[0]], scope, hosts, now),
    ).toThrow("PANORAMA_2_TO_1_REQUIRED");
    const pan = {
        ...grants[0]!,
        source: {
          ...photos[0]!,
          width: 1600,
          height: 800,
          kind: "panorama" as const,
        },
      },
      panScope = { ...scope, sources: [pan.source], approvedGrants: [pan] };
    expect(() =>
      p.prepare("Synthetic tour", "tr", [pan], panScope, hosts, now),
    ).toThrow();
    expect(
      p.prepare("Synthetic tour", "en", [pan], panScope, hosts, now).body,
    ).toEqual({
      name: "Synthetic tour",
      linking: "sequential",
      language: "en",
      scenes: [{ imageUrl: pan.url }],
    });
    expect(p.prepareStatus(tourId).body).toEqual({ tourId });
    expect(() => p.prepareStatus("../bad")).toThrow();
    const result = p.normalizeOutput(
      {
        tourId,
        status: "ready",
        tourUrl: `https://app.pedra.ai/virtual-tour/${tourId}`,
        shareable: true,
        embedCode: '<iframe src="javascript:alert(1)"><script>steal()</script>',
      },
      tourId,
    );
    expect(result.publicationAllowed).toBe(false);
    expect(result.state).toBe("QA_HOLD");
    expect(result).not.toHaveProperty("embedCode");
    expect(() =>
      p.normalizeOutput(
        { tourId, status: "ready", tourUrl: "https://evil.example/x" },
        tourId,
      ),
    ).toThrow();
    expect(() =>
      p.normalizeOutput(
        {
          tourId,
          status: "ready",
          tourUrl: `https://app.pedra.ai/virtual-tour/${tourId}?redirect=evil`,
        },
        tourId,
      ),
    ).toThrow();
  });
  it("all real operations remain closed with unknown prices and no network even if an enable flag is supplied", async () => {
    const old = process.env["SPACES_PROVIDER_LIVE_ENABLED"];
    process.env["SPACES_PROVIDER_LIVE_ENABLED"] = "true";
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("UNEXPECTED_EGRESS"));
    try {
      for (const p of [
        new FalKling4DisabledAdapter(),
        new FalSeedance25DisabledAdapter(),
        new MarblePlusDisabledAdapter(),
        new PedraDisabledAdapter(),
      ]) {
        expect(p.enabled).toBe(false);
        expect(p.estimateQuote().providerPriceMicroUsd).toBeNull();
        for (const method of [
          "submit",
          "getStatus",
          "getResult",
          "cancel",
        ] as const)
          await expect(p[method]({ maxCostMicroUsd: 1000 })).rejects.toThrow(
            "BLOCKED_EXTERNAL_APPROVAL",
          );
      }
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
      if (old === undefined) delete process.env["SPACES_PROVIDER_LIVE_ENABLED"];
      else process.env["SPACES_PROVIDER_LIVE_ENABLED"] = old;
    }
  });
});

describe("V5.4 authenticated callbacks and bounded reconciliation", () => {
  const keys = generateKeyPairSync("ed25519"),
    publicJwk = keys.publicKey.export({ format: "jwk" });
  function signed(
    body: Uint8Array,
    requestId = "request-a",
    userId = "synthetic-fal-user",
    time = String(now / 1000),
  ) {
    const message = Buffer.from(
      [
        requestId,
        userId,
        time,
        createHash("sha256").update(body).digest("hex"),
      ].join("\n"),
    );
    return new Headers({
      "x-fal-webhook-request-id": requestId,
      "x-fal-webhook-user-id": userId,
      "x-fal-webhook-timestamp": time,
      "x-fal-webhook-signature": sign(null, message, keys.privateKey).toString(
        "hex",
      ),
    });
  }
  it("verifies real Ed25519 raw-body signature, timestamp, server request/user and key freshness", () => {
    const body = Buffer.from(
        JSON.stringify({
          request_id: "request-a",
          status: "OK",
          payload: { video: { url: "https://v3b.fal.media/synthetic.mp4" } },
        }),
      ),
      headers = signed(body),
      expected = {
        requestId: "request-a",
        providerUserId: "synthetic-fal-user",
      },
      trusted = { fetchedAtMs: now - 1000, keys: [publicJwk] };
    expect(
      verifyFalWebhook(body, headers, expected, trusted, now).authenticated,
    ).toBe(true);
    for (const [b, h, e, k, t] of [
      [Buffer.from("tampered"), headers, expected, trusted, now],
      [body, signed(body, "request-b"), expected, trusted, now],
      [body, signed(body, "request-a", "foreign"), expected, trusted, now],
      [body, headers, expected, trusted, now + 301000],
      [
        body,
        headers,
        expected,
        { ...trusted, fetchedAtMs: now - 86400001 },
        now,
      ],
      [body, new Headers(), expected, trusted, now],
      [body, headers, expected, { ...trusted, keys: [] }, now],
    ] as const)
      expect(() => verifyFalWebhook(b, h, e, k, t)).toThrow();
    const other = Buffer.from(
      JSON.stringify({ request_id: "different", status: "OK" }),
    );
    expect(() =>
      verifyFalWebhook(other, signed(other), expected, trusted, now),
    ).toThrow("PROVIDER_TASK_SCOPE_DENIED");
  });
  const binding = {
    organizationId: "org-a",
    propertyId: "property-a",
    revision: 2,
    sourceFingerprint: "sources-a",
    fence: "fence-a",
  };
  it("holds ambiguous submission, bounds known-rejection retries and never treats a callback as release approval", () => {
    const p = new OfflineProviderAttempt(binding, "key", "fingerprint");
    expect(() =>
      p.recordSubmission("other", "fingerprint", {
        kind: "UNKNOWN_ACCEPTANCE",
      }),
    ).toThrow("IDEMPOTENCY_CONFLICT");
    expect(
      p.recordSubmission("key", "fingerprint", { kind: "UNKNOWN_ACCEPTANCE" }),
    ).toBe("HOLD_UNKNOWN");
    expect(() =>
      p.recordSubmission("key", "fingerprint", { kind: "UNKNOWN_ACCEPTANCE" }),
    ).toThrow("AUTOMATIC_RESUBMIT_DENIED");
    const retry = new OfflineProviderAttempt(binding, "key", "fingerprint");
    expect(
      retry.recordSubmission("key", "fingerprint", {
        kind: "KNOWN_NOT_ACCEPTED",
      }),
    ).toBe("PREPARED");
    expect(
      retry.recordSubmission("key", "fingerprint", {
        kind: "KNOWN_NOT_ACCEPTED",
      }),
    ).toBe("FAILED");
    const ok = new OfflineProviderAttempt(binding, "key", "fingerprint");
    ok.recordSubmission("key", "fingerprint", {
      kind: "ACCEPTED_MOCK",
      requestId: "request-a",
    });
    const event = {
      requestId: "request-a",
      authenticated: true,
      bodySha256: "hash-a",
      status: "OK" as const,
    };
    for (const current of [
      { ...binding, organizationId: "org-b" },
      { ...binding, propertyId: "property-b" },
      { ...binding, revision: 1 },
      { ...binding, sourceFingerprint: "changed" },
      { ...binding, fence: "old" },
    ])
      expect(() => ok.receive(event, current)).toThrow(
        "PROVIDER_CALLBACK_SCOPE_DENIED",
      );
    expect(() =>
      ok.receive({ ...event, authenticated: false }, binding),
    ).toThrow();
    expect(ok.receive(event, binding)).toEqual({
      duplicate: false,
      state: "QA_HOLD",
    });
    expect(ok.receive(event, binding).duplicate).toBe(true);
    const cancelled = new OfflineProviderAttempt(binding, "key", "fingerprint");
    cancelled.recordSubmission("key", "fingerprint", {
      kind: "ACCEPTED_MOCK",
      requestId: "request-a",
    });
    cancelled.cancel();
    expect(() => cancelled.receive(event, binding)).toThrow(
      "LATE_PROVIDER_RESULT_FENCED",
    );
    const failed = new OfflineProviderAttempt(binding, "key", "fingerprint");
    failed.recordSubmission("key", "fingerprint", {
      kind: "ACCEPTED_MOCK",
      requestId: "request-a",
    });
    expect(failed.receive({ ...event, status: "ERROR" }, binding).state).toBe(
      "FAILED",
    );
  });
});
