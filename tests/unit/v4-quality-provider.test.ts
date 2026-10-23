// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PlatformRuntime } from "@/server/runtime";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sanitizeVideo } from "@/server/video-ingestion";
import { digest } from "@/server/crypto";
import { inspectVideo, type QualityExpectation } from "@/server/video-quality";
import { renderCaption } from "@/server/captions";
import { sampleStatistics, validateCaption } from "@/domain/video-quality";
import { LocalReferenceVideoProvider } from "@/adapters/fake/reference-video-provider";
import { ProviderReadinessHarness } from "@/application/provider-readiness";
import {
  validateShotScope,
  shotCostBound,
  validateGeneratedShot,
  type ApprovedShotScope,
  type ShotIntentValue,
  type GeneratedShotArtifact,
} from "@/domain/video-generation";
import type { ReferenceVideoProvider } from "@/contracts/video-generation";
import { SyntheticProviderFailure } from "@/contracts/video-generation";
import {
  prepareRunwayRequest,
  submitRunwayDisabled,
} from "@/adapters/providers/runway-disabled";
import { PROVIDERS, routeProvider } from "@/adapters/providers/registry";
import type { Actor } from "@/server/database";
import type { OutputEvidence } from "@/contracts/platform-ports";
let rt: PlatformRuntime,
  root: string,
  actor: Actor,
  scope: ApprovedShotScope,
  intent: ShotIntentValue,
  provider: LocalReferenceVideoProvider,
  evidence: OutputEvidence,
  path: string,
  artifact: GeneratedShotArtifact;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "spaces-v4-contract-"));
  rt = await PlatformRuntime.create(root, true, false);
  actor = await rt.db.actor("demo-admin-a", "studio");
  const p = await rt.properties.create(
    actor,
    { title: "V4 contract sentetik", syntheticOnly: true },
    "v4-contract",
  );
  const a = await rt.properties.upload(
    actor,
    p.id,
    await readFile("fixtures/video-quality-v4/photo-a.jpg"),
    "photo",
    {
      syntheticOnly: true,
      ownedOrLicensed: true,
      metadataRemovalAccepted: true,
    },
    "v4-source-photo",
    { mime: "image/jpeg", revision: 1 },
  );
  const references = [
    {
      evidenceId: a.id,
      sha256: a.cleanHash,
      kind: "image" as const,
      seconds: 0,
      truth: "E1" as const,
    },
  ];
  scope = {
    organizationId: actor.organizationId,
    propertyId: p.id,
    revision: 1,
    manifestSha256: digest(JSON.stringify(p.manifest)),
    epoch: 0,
    references,
    roomIds: [],
    forbiddenClaims: ["unseen-architecture", "invented-measurements"],
  };
  intent = {
    ...scope,
    modelId: "synthetic-local-v4",
    modelRevision: "1",
    idempotencyKey: "v4-provider-actual",
    mode: "pov",
    aspect: "9:16",
    resolution: "360p",
    durationSeconds: 4,
    camera: {
      view: "first-person-eye-level",
      eyeHeightMeters: 1.65,
      roomIds: [],
      pathPolicy: "CONFIRMED_REGIONS_ONLY",
    },
    consistency: {
      forbiddenClaims: [...scope.forbiddenClaims],
      preserveSourceFeatures: true,
      inventUnknownLayout: false,
    },
    rights: {
      ownedOrLicensed: true,
      syntheticOnly: true,
      moderation: "LOCAL_SYNTHETIC_CLEARED",
      publicationAllowed: false,
    },
    maxCostMicroUsd: 0,
  };
  // Only the contract fields, no scope-only roomIds/forbiddenClaims.
  delete (intent as unknown as Record<string, unknown>)["roomIds"];
  delete (intent as unknown as Record<string, unknown>)["forbiddenClaims"];
  provider = new LocalReferenceVideoProvider(
    async (shot) => {
      const job = await rt.jobs.submit(actor, {
        propertyId: p.id,
        revision: 1,
        mode: shot.mode,
        aspectRatio: shot.aspect,
        durationSeconds: shot.durationSeconds,
        captions: true,
        idempotencyKey: shot.idempotencyKey,
      });
      await rt.jobs.processNext();
      const done = await rt.jobs.get(actor, job.id);
      expect(done.state, done.error_code ?? "").toBe("awaiting-review");
      evidence = done.output!;
      path = rt.storage.path(
        actor.organizationId,
        evidence.artifactId!,
        "output",
        "mp4",
      );
      await expect(
        rt.releases.outputGrant(actor, job.id),
      ).rejects.toMatchObject({ code: "APPROVED_CURRENT_OUTPUT_REQUIRED" });
      return {
        organizationId: shot.organizationId,
        propertyId: shot.propertyId,
        revision: shot.revision,
        manifestSha256: shot.manifestSha256,
        sha256: evidence.sha256,
        bytes: evidence.bytes,
        codec: "h264",
        mime: "video/mp4",
        durationSeconds: evidence.durationSeconds!,
        referenceHashes: shot.references.map((r) => r.sha256),
        synthetic: true,
        disclosure: "SYNTHETIC_LOCAL_SOURCE_MOTION_NOT_GENERATIVE",
        hallucinationGuarantee: "NONE_HUMAN_REVIEW_REQUIRED",
        billedMicroUsd: 0,
      };
    },
    async (output) => {
      const q = await inspectVideo(path, expectation(output));
      return q.status === "PASS";
    },
  );
}, 30000);
afterAll(async () => {
  await rt.db.close();
  await rm(root, { recursive: true, force: true });
});
function expectation(output = artifact): QualityExpectation {
  return {
    width: 360,
    height: 640,
    durationSeconds: 4,
    revision: scope.revision,
    manifestSha256: scope.manifestSha256,
    sourceHashes: scope.references.map((r) => r.sha256),
    sourceIds: scope.references.map((r) => r.evidenceId),
    captionsRequired: true,
    evidence: { ...evidence, sha256: output.sha256 },
  };
}
function stub(
  generate: ReferenceVideoProvider["generate"],
  patch: Partial<ReferenceVideoProvider["capabilities"]> = {},
): ReferenceVideoProvider {
  return {
    capabilities: { ...provider.capabilities, ...patch },
    generate,
    verifyArtifact: async () => true,
  };
}
describe("actual synthetic artifact through provider-neutral contract and objective QA", () => {
  it("creates real MP4, verifies decoded file/provenance and stays behind the independent release gate", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    const harness = new ProviderReadinessHarness(provider, scope, 0, 2, 20000),
      pending = harness.submit(intent);
    expect(harness.submit(intent)).toBe(pending);
    const result = await pending;
    expect(result.state).toBe("COMPLETED_SYNTHETIC");
    expect(result.attempts).toHaveLength(1);
    artifact = result.artifact!;
    expect(artifact.hallucinationGuarantee).toBe("NONE_HUMAN_REVIEW_REQUIRED");
    expect(network).not.toHaveBeenCalled();
    network.mockRestore();
    const q = await inspectVideo(path, expectation());
    expect(q.status).toBe("PASS");
    expect(q.fullDecodeExit).toBe(0);
    expect(q.samples!.longestFrozenSeconds).toBeLessThan(2);
    expect(q.metadata).toMatchObject({
      width: 360,
      height: 640,
      codec: "h264",
      pixelFormat: "yuv420p",
      colorSpace: "bt709",
    });
  }, 30000);
  it("rejects missing/mismatched provenance, stale source, wrong aspect/caption/hash and corrupt media", async () => {
    for (const patch of [
      { revision: 2 },
      { manifestSha256: "0".repeat(64) },
      { width: 640, height: 360 },
      { sourceHashes: [] },
      { sourceIds: [] },
      { evidence: { ...evidence, sha256: "0".repeat(64) } },
      { evidence: { ...evidence, shotProvenance: [] } },
      {
        evidence: {
          ...evidence,
          captionLayout: { ...evidence.captionLayout!, width: 9999 },
        },
      },
    ])
      expect(
        (await inspectVideo(path, { ...expectation(), ...patch })).status,
      ).toBe("FAIL");
    const corrupt = join(root, "broken.mp4");
    await writeFile(corrupt, (await readFile(path)).subarray(0, 40));
    expect((await inspectVideo(corrupt, expectation())).status).toBe("FAIL");
    const black = await readFile(
      "fixtures/video-quality-v4/blank-negative.mp4",
    );
    const blank = await inspectVideo(
      "fixtures/video-quality-v4/blank-negative.mp4",
      {
        ...expectation(),
        width: 640,
        height: 360,
        captionsRequired: false,
        evidence: {
          ...evidence,
          sha256: digest(black),
          bytes: black.length,
          captionLayout: null,
        },
      },
    );
    expect(blank.status).toBe("FAIL");
    expect(blank.checks["sampledBlankFrames"]).toBe(false);
    expect(blank.checks["sampledFrozenFrames"]).toBe(false);
  }, 30000);
  it("rasterizes long Turkish caption/brand within exact 4% safe bounds, with opaque contrast", async () => {
    const caption = await renderCaption(
      "YEREL ÖRNEK • Sıcak Ev • " + "İstanbul sentetik marka ".repeat(5),
      360,
      640,
    );
    expect(validateCaption(caption.layout, 360, 640, true)).toBe(true);
    expect(caption.layout.height).toBeLessThan(640 * 0.3);
    await expect(renderCaption("", 360, 640)).rejects.toThrow();
    await expect(renderCaption("a", 100, 640)).rejects.toThrow();
    await expect(renderCaption("a".repeat(301), 360, 640)).rejects.toThrow();
  });
});
describe("provider capability, scope, spend and accounting fail closed without egress", () => {
  it("rejects unsupported model/revision/resolution/duration, forged A→B evidence, room and POV claims", () => {
    for (const patch of [
      { organizationId: "atelier" },
      { propertyId: "property-b" },
      { revision: 2 },
      { manifestSha256: "0".repeat(64) },
      { epoch: 1 },
      { modelId: "best-model" },
      { modelRevision: "new" },
      { resolution: "1080p" },
      { durationSeconds: 30 },
      { references: [{ ...intent.references[0]!, sha256: "0".repeat(64) }] },
      { references: [intent.references[0]!, intent.references[0]!] },
      { camera: { ...intent.camera, roomIds: ["invented-balcony"] } },
      { camera: { ...intent.camera, view: "composed" } },
      { consistency: { ...intent.consistency, forbiddenClaims: [] } },
    ])
      expect(() =>
        validateShotScope(
          { ...intent, ...patch },
          scope,
          provider.capabilities,
        ),
      ).toThrow();
    expect(
      validateShotScope(
        {
          ...intent,
          mode: "cinematic",
          camera: { ...intent.camera, view: "composed" },
        },
        scope,
        provider.capabilities,
      ).mode,
    ).toBe("cinematic");
  });
  it("refuses unknown prices and spending beyond USD0 before running any provider", () => {
    const generate = vi.fn(async () => artifact);
    expect(() =>
      new ProviderReadinessHarness(
        stub(generate, { tariff: null }),
        scope,
      ).submit(intent),
    ).toThrow("PROVIDER_PRICE_NOT_VERIFIED");
    const priced = {
      outputSecondMicroUsd: 100000,
      inputVideoSecondMicroUsd: 10000,
      minimumMicroUsd: 1000000,
      verifiedSource: "UNIT_TEST_ASSUMPTION_NOT_VENDOR_PRICE",
    };
    expect(() =>
      new ProviderReadinessHarness(
        stub(generate, { tariff: priced }),
        scope,
      ).submit(intent),
    ).toThrow("PROVIDER_SPEND_CAP_EXCEEDED");
    expect(() =>
      new ProviderReadinessHarness(
        stub(generate, { tariff: priced }),
        scope,
      ).submit({ ...intent, maxCostMicroUsd: 1000000 }),
    ).toThrow("PROVIDER_SPEND_CAP_EXCEEDED");
    expect(() =>
      new ProviderReadinessHarness(
        stub(generate, { local: false, enabled: false }),
        scope,
      ).submit(intent),
    ).toThrow("BLOCKED_EXTERNAL_APPROVAL");
    expect(generate).not.toHaveBeenCalled();
    expect(shotCostBound(intent, provider.capabilities)).toBe(0);
    expect(() => new ProviderReadinessHarness(provider, scope, -1)).toThrow();
    expect(() => new ProviderReadinessHarness(provider, scope, 0, 3)).toThrow();
  });
  it("records bounded known-not-accepted retries and never resubmits an unknown timeout", async () => {
    let calls = 0;
    const retry = stub(async () => {
      if (++calls === 1)
        throw new SyntheticProviderFailure("KNOWN_NOT_ACCEPTED");
      return artifact;
    });
    const result = await new ProviderReadinessHarness(retry, scope).submit(
      intent,
    );
    expect(result.state).toBe("COMPLETED_SYNTHETIC");
    expect(result.attempts).toHaveLength(2);
    expect(result.chargedMicroUsd).toBe(0);
    expect(result.releasedMicroUsd).toBe(0);
    const unknown = stub(async () => {
      throw new SyntheticProviderFailure("UNKNOWN_ACCEPTANCE");
    });
    const hold = await new ProviderReadinessHarness(unknown, scope).submit(
      intent,
    );
    expect(hold.state).toBe("HOLD_UNKNOWN");
    expect(hold.attempts).toHaveLength(1);
    const exhausted = await new ProviderReadinessHarness(
      stub(async () => {
        throw new SyntheticProviderFailure("KNOWN_NOT_ACCEPTED");
      }),
      scope,
    ).submit(intent);
    expect(exhausted.state).toBe("FAILED");
    expect(exhausted.attempts).toHaveLength(2);
    const failed = await new ProviderReadinessHarness(
      stub(async () => {
        throw new SyntheticProviderFailure("MODERATION_REJECTED");
      }),
      scope,
    ).submit(intent);
    expect(failed.state).toBe("FAILED");
    expect(failed.attempts).toHaveLength(1);
  });
  it("fences cancellation/late result and holds timeout without double charging or pretending a hallucination guarantee", async () => {
    let finish!: (a: GeneratedShotArtifact) => void;
    const late = stub(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
    const harness = new ProviderReadinessHarness(late, scope),
      pending = harness.submit(intent);
    harness.cancel(intent.idempotencyKey);
    finish(artifact);
    expect((await pending).state).toBe("CANCELLED");
    const timeout = new ProviderReadinessHarness(
      stub(
        async (_s, c) =>
          new Promise((_, reject) =>
            c.signal.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true },
            ),
          ),
      ),
      scope,
      0,
      2,
      10,
    );
    const timed = await timeout.submit(intent);
    expect(timed.state).toBe("HOLD_UNKNOWN");
    expect(timed.attempts).toHaveLength(1);
    for (const patch of [
      { propertyId: "property-b" },
      { codec: "hevc" },
      { mime: "application/json" },
      { sha256: "bad" },
      { bytes: 0 },
      { durationSeconds: 30 },
      { referenceHashes: [] },
      { billedMicroUsd: 1 },
      { disclosure: "PHOTOREAL_AI" },
      { hallucinationGuarantee: "GUARANTEED" },
    ])
      expect(() =>
        validateGeneratedShot(
          { ...artifact, ...patch } as GeneratedShotArtifact,
          intent,
          0,
        ),
      ).toThrow();
    const invalid = await new ProviderReadinessHarness(
      stub(async () => ({ ...artifact, referenceHashes: [] })),
      scope,
    ).submit(intent);
    expect(invalid.state).toBe("FAILED");
    const bytes = stub(async () => artifact);
    bytes.verifyArtifact = async () => false;
    expect(
      (await new ProviderReadinessHarness(bytes, scope).submit(intent)).state,
    ).toBe("FAILED");
  });
  it("detects idempotency conflicts and caps ephemeral harness entries", async () => {
    const harness = new ProviderReadinessHarness(
      stub(async () => artifact),
      scope,
    );
    await harness.submit(intent);
    expect(() => harness.submit({ ...intent, mode: "hybrid" })).toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
    for (let i = 1; i < 32; i++)
      await harness.submit({
        ...intent,
        idempotencyKey: "synthetic-item-" + i,
      });
    expect(() =>
      harness.submit({ ...intent, idempotencyKey: "synthetic-limit-item" }),
    ).toThrow("PROVIDER_LOCAL_HARNESS_LIMIT");
  });
  it("prepares a documented Runway subset with no URL fetch/credential and remains disabled", async () => {
    const input = {
      model: "gen4_turbo",
      promptImage: "data:image/png;base64,c3ludGhldGlj",
      promptText: "Synthetic reference only, no invented geometry",
      ratio: "1280:720",
      duration: 5,
    };
    expect(prepareRunwayRequest(input)).toMatchObject({
      enabled: false,
      externalBudgetMicroUsd: 0,
      headers: { "X-Runway-Version": "2024-11-06" },
      body: input,
    });
    expect(() =>
      prepareRunwayRequest({
        ...input,
        promptImage: "https://private.invalid/a",
      }),
    ).toThrow();
    expect(() =>
      prepareRunwayRequest({ ...input, model: "unknown" }),
    ).toThrow();
    expect(() => prepareRunwayRequest({ ...input, duration: 30 })).toThrow();
    await expect(submitRunwayDisabled(input)).rejects.toMatchObject({
      code: "BLOCKED_EXTERNAL_APPROVAL",
    });
    expect(PROVIDERS.runway.enabled).toBe(false);
    expect(PROVIDERS.runway.verifiedAt).toBe("2026-10-23");
    expect(() => routeProvider("runway")).toThrow("BLOCKED_EXTERNAL_APPROVAL");
  });
});

describe("actual AAC privacy and actual unsupported HEVC remain server verified", () => {
  it("removes a real AAC track and location/comment tags, and refuses real HEVC before generation", async () => {
    const run = promisify(execFile),
      input = join(root, "with-audio.mp4");
    await run(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-i",
        "fixtures/video-quality-v4/footage.mp4",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:sample_rate=44100",
        "-t",
        "1",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-threads",
        "1",
        "-metadata",
        "location=+00.0000+000.0000/",
        "-metadata",
        "comment=SYNTHETIC_PRIVATE_TAG",
        input,
      ],
      { timeout: 15000 },
    );
    const before = JSON.parse(
      (
        await run("ffprobe", [
          "-v",
          "error",
          "-show_streams",
          "-of",
          "json",
          input,
        ])
      ).stdout,
    );
    expect(
      before.streams.some(
        (s: { codec_name: string }) => s.codec_name === "aac",
      ),
    ).toBe(true);
    const clean = await sanitizeVideo(rt.storage.root, await readFile(input)),
      output = join(root, "clean-audio.mp4");
    await writeFile(output, clean.clean);
    const after = JSON.parse(
      (
        await run("ffprobe", [
          "-v",
          "error",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          output,
        ])
      ).stdout,
    );
    expect(after.streams).toHaveLength(1);
    expect(after.streams[0].codec_type).toBe("video");
    expect(JSON.stringify(after)).not.toContain("SYNTHETIC_PRIVATE_TAG");
    expect(after.format.tags).not.toHaveProperty("location");
    const hevc = join(root, "hevc.mp4");
    await run(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=64x64:rate=24",
        "-frames:v",
        "12",
        "-c:v",
        "libx265",
        "-threads",
        "1",
        "-x265-params",
        "pools=none:frame-threads=1:log-level=error",
        hevc,
      ],
      { timeout: 15000, maxBuffer: 65536 },
    );
    await expect(
      sanitizeVideo(rt.storage.root, await readFile(hevc)),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_VIDEO_CODEC" });
  }, 30000);
});

describe("assembled reel has no internal fade-to-black flash", () => {
  it("keeps a real cinematic cut bright at the midpoint without changing QA thresholds", async () => {
    const property = await rt.properties.create(
      actor,
      { title: "V4 internal cut fixture", syntheticOnly: true },
      "v4-two-shot-cut",
    );
    for (const name of ["photo-a.jpg", "photo-b.webp"])
      await rt.properties.upload(
        actor,
        property.id,
        await readFile("fixtures/video-quality-v4/" + name),
        "photo",
        {
          syntheticOnly: true,
          ownedOrLicensed: true,
          metadataRemovalAccepted: true,
        },
      );
    const a = await rt.properties.assets(actor, property.id);
    const j = await rt.jobs.submit(actor, {
      propertyId: property.id,
      revision: 1,
      mode: "cinematic",
      aspectRatio: "9:16",
      durationSeconds: 4,
      sourceAssetIds: a.map((s) => s.id),
      idempotencyKey: "v4-cinematic-cut",
    });
    await rt.jobs.processNext();
    const done = await rt.jobs.get(actor, j.id);
    expect(done.state).toBe("awaiting-review");
    const p = rt.storage.path(
      actor.organizationId,
      done.output!.artifactId!,
      "output",
      "mp4",
    );
    const decoded = await promisify(execFile)(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-ss",
        "2",
        "-threads",
        "1",
        "-i",
        p,
        "-frames:v",
        "1",
        "-vf",
        "crop=iw:ih*0.65:0:0,scale=96:54,format=gray",
        "-threads",
        "1",
        "-f",
        "rawvideo",
        "pipe:1",
      ],
      { timeout: 10000, encoding: "buffer", maxBuffer: 65536 },
    );
    expect(sampleStatistics(decoded.stdout)[0]!.mean).toBeGreaterThan(20);
  }, 30000);
});

describe("source geometry proportions survive photo-motion framing", () => {
  it("keeps a circular source feature circular in both actual export orientations", async () => {
    const p = await rt.properties.create(
      actor,
      { title: "Synthetic ratio calibration", syntheticOnly: true },
      "v4-ratio-calibration",
    );
    const image = await sharp(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="#ddd"/><circle cx="500" cy="500" r="100" fill="#f00000"/></svg>',
      ),
    )
      .png()
      .toBuffer();
    await rt.properties.upload(actor, p.id, image, "photo", {
      syntheticOnly: true,
      ownedOrLicensed: true,
      metadataRemovalAccepted: true,
    });
    for (const aspect of ["16:9", "9:16"] as const) {
      const job = await rt.jobs.submit(actor, {
        propertyId: p.id,
        revision: 1,
        mode: "pov",
        aspectRatio: aspect,
        durationSeconds: 4,
        captions: false,
        idempotencyKey: "ratio-frame-" + aspect,
      });
      await rt.jobs.processNext();
      const done = await rt.jobs.get(actor, job.id);
      expect(done.state).toBe("awaiting-review");
      const file = rt.storage.path(
        actor.organizationId,
        done.output!.artifactId!,
        "output",
        "mp4",
      );
      const decoded = await promisify(execFile)(
        "ffmpeg",
        [
          "-v",
          "error",
          "-nostdin",
          "-ss",
          "1",
          "-threads",
          "1",
          "-i",
          file,
          "-frames:v",
          "1",
          "-pix_fmt",
          "rgb24",
          "-threads",
          "1",
          "-f",
          "rawvideo",
          "pipe:1",
        ],
        { timeout: 10000, encoding: "buffer", maxBuffer: 2_000_000 },
      );
      let minX = 9999,
        maxX = 0,
        minY = 9999,
        maxY = 0;
      const width = done.output!.width!,
        height = done.output!.height!;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * 3;
          if (
            decoded.stdout[offset]! > 150 &&
            decoded.stdout[offset + 1]! < 100 &&
            decoded.stdout[offset + 2]! < 100
          ) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      expect(maxX - minX).toBeGreaterThan(50);
      expect((maxX - minX) / (maxY - minY)).toBeGreaterThan(0.95);
      expect((maxX - minX) / (maxY - minY)).toBeLessThan(1.05);
    }
  }, 30000);
});
