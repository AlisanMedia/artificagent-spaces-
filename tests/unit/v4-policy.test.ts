// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GenerationInput } from "@/domain/platform";
import { benchmarkBudget } from "@/domain/benchmark-budget";
import {
  MEDIA_CAPABILITIES,
  adviseSelection,
  validateProbedVideo,
  type ProbedVideo,
} from "@/domain/media-capabilities";
import { mp4Hints } from "@/domain/mp4-preflight";
import { preflightSelection } from "@/features/platform/media-preflight";
import { StudioFunnel } from "@/domain/studio-funnel";
import {
  renderProfile,
  sampleStatistics,
  longestRun,
  validateCaption,
} from "@/domain/video-quality";
import {
  unitEconomics,
  observedEconomics,
  partnerContribution,
  type EconomicInputValue,
} from "@/domain/unit-economics";
let hdrBytes: Buffer, temporary: string;
beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), "spaces-hdr-hints-"));
  const path = join(temporary, "hdr.mp4");
  await promisify(execFile)(
    "ffmpeg",
    [
      "-v",
      "error",
      "-nostdin",
      "-i",
      "fixtures/video-quality-v4/footage.mp4",
      "-frames:v",
      "12",
      "-c:v",
      "libx264",
      "-threads",
      "1",
      "-pix_fmt",
      "yuv420p",
      "-color_primaries",
      "bt2020",
      "-color_trc",
      "smpte2084",
      "-colorspace",
      "bt2020nc",
      "-movflags",
      "+write_colr",
      path,
    ],
    { timeout: 10000 },
  );
  hdrBytes = await readFile(path);
});
afterAll(async () => {
  await rm(temporary, { recursive: true, force: true });
});
const video: ProbedVideo = {
  streams: [
    {
      codec_type: "video",
      codec_name: "h264",
      pix_fmt: "yuv420p",
      width: 1280,
      height: 720,
      r_frame_rate: "24/1",
      color_primaries: "bt709",
      color_transfer: "bt709",
      color_space: "bt709",
    },
  ],
  format: { duration: "2" },
};
describe("single source intake capability and non-destructive guidance", () => {
  it("supports only the exact JPEG/PNG/WebP and MP4 metadata contract", () => {
    for (const [name, type] of [
      ["a.jpg", "image/jpeg"],
      ["a.jpeg", "image/jpeg"],
      ["a.png", "image/png"],
      ["a.webp", "image/webp"],
      ["a.mp4", "video/mp4"],
    ])
      expect(
        adviseSelection({ name: name!, type: type!, size: 100 }).supported,
      ).toBe(true);
    for (const [name, type, size] of [
      ["a.heic", "image/heic", 50],
      ["a.heif", "image/heif", 50],
      ["a.mov", "video/quicktime", 100],
      ["a.webm", "video/webm", 100],
      ["a.exe", "application/octet-stream", 10],
      ["a.png", "image/jpeg", 50],
      ["../a.jpg", "image/jpeg", 50],
      ["a\n.jpg", "image/jpeg", 50],
      ["a.jpg", "image/jpeg", 0],
      ["a.jpg", "image/jpeg", MEDIA_CAPABILITIES.photo.maxBytes + 1],
      ["a.mp4", "video/mp4", MEDIA_CAPABILITIES.video.maxBytes + 1],
    ] as const) {
      const advice = adviseSelection({ name, type, size });
      expect(advice.supported).toBe(false);
      expect(advice.message.length).toBeGreaterThan(30);
    }
    expect(
      adviseSelection({
        name: "a".repeat(181) + ".jpg",
        type: "image/jpeg",
        size: 20,
      }).supported,
    ).toBe(false);
  });
  it("uses actual ffprobe fields to reject codec/color/streams/duration/pressure/FPS instead of guessing from extension", () => {
    expect(validateProbedVideo(video).fps).toBe(24);
    for (const patch of [
      { codec_name: "hevc" },
      { pix_fmt: "yuv420p10le" },
      { color_primaries: "bt2020" },
      { color_transfer: "smpte2084" },
      { color_space: "bt2020nc" },
      { width: 3840 },
      { height: 2160 },
      { width: 1800, height: 1800 },
      { width: 1 },
      { height: 1 },
      { r_frame_rate: "120/1" },
      { r_frame_rate: "0/0" },
    ])
      expect(() =>
        validateProbedVideo({
          ...video,
          streams: [{ ...video.streams[0]!, ...patch }],
        }),
      ).toThrow();
    for (const d of ["0", "31", "NaN"])
      expect(() =>
        validateProbedVideo({ ...video, format: { duration: d } }),
      ).toThrow();
    expect(() => validateProbedVideo({ ...video, streams: [] })).toThrow();
    expect(() =>
      validateProbedVideo({
        ...video,
        streams: [
          ...video.streams,
          { codec_type: "subtitle", codec_name: "mov_text" },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateProbedVideo({
        ...video,
        streams: [...video.streams, { codec_type: "audio", codec_name: "mp3" }],
      }),
    ).toThrow();
    expect(
      validateProbedVideo({
        ...video,
        streams: [...video.streams, { codec_type: "audio", codec_name: "aac" }],
      }).duration,
    ).toBe(2);
    expect(() =>
      validateProbedVideo({
        ...video,
        streams: [...video.streams, ...video.streams],
      }),
    ).toThrow();
    expect(
      validateProbedVideo({
        ...video,
        streams: [
          {
            ...video.streams[0]!,
            pix_fmt: "yuvj420p",
            color_space: "smpte170m",
            color_transfer: "unknown",
            color_primaries: "unknown",
          },
        ],
      }).fps,
    ).toBe(24);
  });
  it("reads bounded actual MP4 sample entries before any upload or reservation", async () => {
    const bytes = await readFile("fixtures/video-quality-v4/footage.mp4"),
      hints = mp4Hints(bytes);
    expect(hints).toMatchObject({
      codec: "h264",
      width: 1280,
      height: 720,
      highBitDepth: false,
      color: "unknown",
    });
    const codec = Buffer.from(bytes),
      avc1 = codec.indexOf(Buffer.from("avc1"), 40);
    expect(avc1).toBeGreaterThan(40);
    codec.write("hvc1", avc1);
    expect(
      (
        await preflightSelection(
          new File([codec], "a.mp4", { type: "video/mp4" }),
        )
      ).code,
    ).toBe("UNSUPPORTED_VIDEO_CODEC");
    const hdr = Buffer.from(hdrBytes),
      colr = hdr.indexOf(Buffer.from("nclx"));
    expect(colr).toBeGreaterThan(0);
    hdr.writeUInt16BE(9, colr + 4);
    expect(
      (
        await preflightSelection(
          new File([hdr], "a.mp4", { type: "video/mp4" }),
        )
      ).code,
    ).toBe("UNSUPPORTED_VIDEO_COLOR");
    const ten = Buffer.from(bytes),
      avcc = ten.indexOf(Buffer.from("avcC"));
    ten[avcc + 5] = 110;
    expect(mp4Hints(ten).highBitDepth).toBe(true);
    const fourK = Buffer.from(bytes);
    fourK.writeUInt16BE(3840, avc1 + 28);
    expect(
      (
        await preflightSelection(
          new File([fourK], "a.mp4", { type: "video/mp4" }),
        )
      ).code,
    ).toBe("VIDEO_DIMENSION_LIMIT");
    expect(
      (
        await preflightSelection(
          new File([bytes], "a.mp4", { type: "video/mp4" }),
        )
      ).supported,
    ).toBe(true);
    expect(
      (
        await preflightSelection(
          new File([bytes], "a.mov", { type: "video/quicktime" }),
        )
      ).supported,
    ).toBe(false);
    expect(
      (
        await preflightSelection(
          new File([new Uint8Array(10)], "a.png", { type: "image/png" }),
        )
      ).supported,
    ).toBe(true); // Hints are not decode/auth; server still rejects fake magic.
  });
  it("bounds malformed/truncated/large/deep MP4 hints without a decoder", () => {
    for (const bytes of [
      new Uint8Array(),
      new Uint8Array(4),
      new Uint8Array(21_000_000),
    ])
      expect(mp4Hints(bytes).codec).toBe("unknown");
    const bad = Buffer.alloc(16);
    bad.writeUInt32BE(9999);
    expect(mp4Hints(bad).codec).toBe("unknown");
    bad.writeUInt32BE(1);
    bad.writeBigUInt64BE(99999999n, 8);
    expect(mp4Hints(bad).codec).toBe("unknown");
    bad.writeUInt32BE(0);
    expect(mp4Hints(bad).codec).toBe("unknown");
    bad.writeUInt32BE(4);
    expect(mp4Hints(bad).codec).toBe("unknown");
    let nested = Buffer.alloc(8);
    for (let i = 0; i < 12; i++) {
      const b = Buffer.alloc(nested.length + 8);
      b.writeUInt32BE(b.length);
      b.write("moov", 4);
      nested.copy(b, 8);
      nested = b;
    }
    expect(mp4Hints(nested).codec).toBe("unknown");
  });
});
describe("ephemeral synthetic studio funnel", () => {
  it("is opt-in, strict, bounded, withdrawable and has no identity or conversion claims", () => {
    const a = new StudioFunnel(),
      b = new StudioFunnel();
    expect(a.record({ name: "picker_opened" })).toBe(false);
    a.consent(true);
    for (const name of [
      "picker_opened",
      "selection_supported",
      "selection_unsupported",
      "rights_accepted",
      "upload_succeeded",
      "upload_failed",
      "style_selected",
      "quote_returned",
      "job_started",
      "preview_opened",
      "review_pending",
      "approval_observed",
      "download_completed",
    ])
      expect(a.record({ name })).toBe(true);
    expect(a.snapshot().total).toBe(14);
    expect(b.snapshot().total).toBe(0);
    for (const payload of [
      { name: "upload_succeeded", filename: "PRIVATE" },
      { name: "job_started", organizationId: "other" },
      { name: "sale_closed" },
      { name: "voice", transcript: "PRIVATE" },
    ])
      expect(() => a.record(payload)).toThrow();
    expect(JSON.stringify(a.snapshot())).not.toContain("PRIVATE");
    for (let i = 0; i < 600; i++) a.record({ name: "picker_opened" });
    expect(a.snapshot().total).toBe(512);
    a.consent(false);
    expect(a.snapshot()).toMatchObject({
      enabled: false,
      total: 0,
      counts: {},
      persistent: false,
      networkRequests: 0,
      conversionUplift: null,
    });
    expect(a.record({ name: "picker_opened" })).toBe(false);
    a.consent(true);
    expect(a.snapshot().total).toBe(1);
    a.clear();
    expect(a.snapshot().total).toBe(0);
  });
});
describe("bounded local render profiles and objective frame/caption checks", () => {
  it("keeps 15/30s and higher resolutions out of the public generation schema", () => {
    expect(
      GenerationInput.safeParse({
        propertyId: "p",
        revision: 1,
        mode: "pov",
        idempotencyKey: "lab-leak-no",
        durationSeconds: 30,
      }).success,
    ).toBe(false);
    expect(
      GenerationInput.safeParse({
        propertyId: "p",
        revision: 1,
        mode: "pov",
        idempotencyKey: "lab-leak-no",
        laboratory: { profile: "lab-1080p-30s" },
      }).success,
    ).toBe(false);
    expect(renderProfile("16:9", 4)).toMatchObject({
      width: 640,
      height: 360,
      labOnly: false,
    });
    expect(renderProfile("9:16", 8, "lab-720p-15s")).toMatchObject({
      width: 720,
      height: 1280,
      durationSeconds: 15,
      labOnly: true,
    });
    expect(renderProfile("16:9", 16, "lab-1080p-30s")).toMatchObject({
      width: 1920,
      height: 1080,
      durationSeconds: 30,
    });
    expect(() => renderProfile("16:9", 30)).toThrow();
    expect(() =>
      renderProfile("16:9", 4, "unknown" as "lab-720p-15s"),
    ).toThrow();
  });
  it("detects blank/frozen samples without asserting creative fidelity", () => {
    const data = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 100, 200, 100, 200]);
    const samples = sampleStatistics(data, 2, 2);
    expect(samples[0]).toMatchObject({ mean: 0, deviation: 0, change: null });
    expect(samples[2]!.change).toBe(150);
    expect(longestRun(samples, (s) => s.mean < 5)).toBe(2);
    expect(() => sampleStatistics(new Uint8Array())).toThrow();
    expect(() => sampleStatistics(new Uint8Array(3), 2, 2)).toThrow();
    const box = {
      x: 18,
      y: 450,
      width: 300,
      height: 90,
      fontPixels: 16,
      contrastRatio: 21,
      rasterized: true as const,
    };
    expect(validateCaption(box, 360, 640, true)).toBe(true);
    expect(validateCaption(null, 360, 640, false)).toBe(true);
    expect(validateCaption(null, 360, 640, true)).toBe(false);
    for (const patch of [
      { x: 0 },
      { y: 0 },
      { width: 400 },
      { height: 200 },
      { fontPixels: 10 },
      { contrastRatio: 2 },
      { width: 0 },
    ])
      expect(validateCaption({ ...box, ...patch }, 360, 640, true)).toBe(false);
  });
});
const economic: EconomicInputValue = {
  seconds: 30,
  referenceVideoSeconds: 2,
  renderWallSeconds: 10,
  bytesPerAttempt: 500000,
  retentionMonths: 1,
  downloads: 3,
  rejectionRate: 0.2,
  reviewMinutesPerAttempt: 3,
  finalApprovalMinutes: 1,
  reviewerAvailableMinutes: 9600,
  priceMicroUsd: 19000000,
  acceptedExportsPerAgency: 10,
  allocatedMonthlyFixedMicroUsd: 20000000,
  customerOnboardingMicroUsd: 10000000,
  rates: {
    providerOutputSecond: null,
    providerReferenceSecond: null,
    workerHour: 150000,
    storageGibMonth: 23000,
    egressGib: 100000,
    humanHour: 20000000,
    supportPerAccepted: 500000,
    abusePerAccepted: 250000,
    paymentFixed: 300000,
    paymentBps: 290,
    taxBps: 0,
  },
};
describe("conditional unit economics, unknown costs and human approval capacity", () => {
  it("refuses to turn zero external local spend into a profitable AI claim", () => {
    const r = unitEconomics(economic);
    expect(r.status).toBe("UNKNOWN_REQUIRED_COSTS");
    expect(r.grossMargin).toBeNull();
    expect(r.costPerAcceptedMicroUsd).toBeNull();
    expect(r.knownLowerBoundPerAcceptedMicroUsd).toBeGreaterThan(0);
    expect(r.maxProviderSpendPerAttemptFor60PctMicroUsd).toBeGreaterThan(0);
    expect(observedEconomics(8, 0, 0)).toMatchObject({
      externalCostPerHumanAcceptedMicroUsd: null,
      commercialProfitability: "NOT_VERIFIED",
    });
    expect(
      observedEconomics(8, 2, 500).externalCostPerHumanAcceptedMicroUsd,
    ).toBe(250);
    expect(() => observedEconomics(1, 2, 0)).toThrow();
    expect(() => observedEconomics(-1, 0, 0)).toThrow();
  });
  it("computes explicit illustrative margin, break-even and review bottleneck without auto-release", () => {
    const r = unitEconomics({
      ...economic,
      rates: {
        ...economic.rates,
        providerOutputSecond: 0,
        providerReferenceSecond: 0,
      },
    });
    expect(r.costPerAcceptedMicroUsd).toBeGreaterThan(0);
    expect(r.grossMargin).toBeGreaterThan(0.6);
    expect(r.expectedAttemptsPerAccepted).toBe(1.25);
    expect(r.successProbabilityWithinTwoAttempts).toBeCloseTo(0.96);
    expect(r.reviewMinutesPerAccepted).toBe(4.75);
    expect(r.breakEvenExportsPerCustomer).toBe(1);
    expect(r.reviewerCapacityAcceptedPerMonth).toBe(Math.floor(9600 / 4.75));
    const bad = unitEconomics({
      ...economic,
      priceMicroUsd: 1000000,
      rejectionRate: 0.4,
      reviewMinutesPerAttempt: 8,
      rates: {
        ...economic.rates,
        humanHour: 40000000,
        providerOutputSecond: 1000000,
        providerReferenceSecond: 0,
      },
    });
    expect(bad.grossMargin).toBeLessThan(0);
    expect(bad.breakEvenExportsPerCustomer).toBeNull();
    expect(bad.maxProviderSpendPerAttemptFor60PctMicroUsd).toBe(0);
  });
  it("keeps missing compute, storage, human, fees/tax unknown and rejects unsafe money/assumptions", () => {
    for (const key of Object.keys(economic.rates))
      expect(
        unitEconomics({
          ...economic,
          rates: { ...economic.rates, [key]: null },
        }).grossMargin,
      ).toBeNull();
    expect(
      unitEconomics({
        ...economic,
        rates: { ...economic.rates, workerHour: null },
      }).maxOutputSecondRateFor60PctMicroUsd,
    ).toBeNull();
    for (const patch of [
      { seconds: 0 },
      { rejectionRate: 1 },
      { reviewMinutesPerAttempt: 0 },
      { priceMicroUsd: -1 },
      { bytesPerAttempt: 0 },
      { rates: { ...economic.rates, paymentBps: 10001 } },
    ])
      expect(() => unitEconomics({ ...economic, ...patch })).toThrow();
  });
});

describe("future paid benchmark is a dry-run cost envelope, never permission", () => {
  const config = {
    candidates: [
      { modelId: "a", perOutputSecondMicroUsd: 50000 },
      { modelId: "b", perOutputSecondMicroUsd: 120000 },
    ],
    screen: { shotsPerModel: 2, secondsPerShot: 5, maxAttemptsPerShot: 2 },
    ownerSelectedHardCapMicroUsd: null,
    accountHardCapVerified: false,
    termsAndDpaApproved: false,
    syntheticRightsApprovedForVendor: false,
    minimumCreditPurchaseMicroUsd: null,
  };
  it("calculates published-only bounds and leaves all current execution gates closed", () => {
    const p = benchmarkBudget(config);
    expect(p.basePublishedInferenceMicroUsd).toBe(1700000);
    expect(p.worstPublishedInferenceMicroUsd).toBe(3400000);
    expect(p.readiness).toBe("BLOCKED_EXTERNAL_APPROVAL");
    expect(p.actualExternalSpendMicroUsd).toBe(0);
    expect(p.blockers).toHaveLength(5);
  });
  it("rejects inadequate cap or unknown minimum and never turns documentary completion into transport", () => {
    expect(
      benchmarkBudget({ ...config, ownerSelectedHardCapMicroUsd: 1 }).blockers,
    ).toContain("INSUFFICIENT_RESERVED_CAP");
    expect(
      benchmarkBudget({
        ...config,
        ownerSelectedHardCapMicroUsd: 5000000,
        minimumCreditPurchaseMicroUsd: 10000000,
      }).blockers,
    ).toContain("MINIMUM_PURCHASE_EXCEEDS_CAP");
    expect(
      benchmarkBudget({
        ...config,
        ownerSelectedHardCapMicroUsd: 10000000,
        minimumCreditPurchaseMicroUsd: 10000000,
        accountHardCapVerified: true,
        termsAndDpaApproved: true,
        syntheticRightsApprovedForVendor: true,
      }).readiness,
    ).toBe("DOCUMENTARY_GATE_ONLY_TRANSPORT_STILL_DISABLED");
    expect(() =>
      benchmarkBudget({
        ...config,
        screen: { ...config.screen, maxAttemptsPerShot: 99 },
      }),
    ).toThrow();
  });
});

describe("reseller packaging remains conditional on contract and actual accepted costs", () => {
  it("does not silently assume a commission or positive partner margin", () => {
    const p = {
      monthlyPriceMicroUsd: 299000000,
      includedAcceptedExports: 10,
      perAcceptedCostMicroUsd: null,
      allocatedOperationsMicroUsd: 20000000,
      resellerCommissionBps: null,
    };
    expect(partnerContribution(p).monthlyContributionMicroUsd).toBeNull();
    expect(() =>
      partnerContribution({
        ...p,
        includedAcceptedExports: 2,
        perAcceptedCostMicroUsd: Number.MAX_SAFE_INTEGER,
        resellerCommissionBps: 0,
      }),
    ).toThrow();
    expect(
      partnerContribution({
        ...p,
        perAcceptedCostMicroUsd: 5000000,
        resellerCommissionBps: 1000,
      }).monthlyContributionMicroUsd,
    ).toBe(199100000);
    expect(() =>
      partnerContribution({ ...p, includedAcceptedExports: -1 }),
    ).toThrow();
    expect(() =>
      partnerContribution({ ...p, resellerCommissionBps: 10001 }),
    ).toThrow();
    expect(() =>
      partnerContribution({ ...p, perAcceptedCostMicroUsd: -1 }),
    ).toThrow();
  });
});
