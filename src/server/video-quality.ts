import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  sampleStatistics,
  longestRun,
  validateCaption,
} from "@/domain/video-quality";
import type { OutputEvidence } from "@/contracts/platform-ports";
import { digest } from "./crypto";
import { invariant } from "@/domain/platform";
import { isolatedWorkerEnvironment } from "./media";
const run = promisify(execFile);
export interface QualityExpectation {
  width: number;
  height: number;
  durationSeconds: number;
  revision: number;
  manifestSha256: string;
  sourceHashes: readonly string[];
  sourceIds: readonly string[];
  captionsRequired: boolean;
  evidence: OutputEvidence;
}
export interface QualityReport {
  schemaVersion: 1;
  status: "PASS" | "FAIL";
  checks: Record<string, boolean>;
  metadata: {
    width: number;
    height: number;
    durationSeconds: number;
    codec: string;
    pixelFormat: string;
    colorSpace: string;
    bytes: number;
    sha256: string;
  } | null;
  samples: {
    count: number;
    rateFps: 6;
    longestBlankSeconds: number;
    longestFrozenSeconds: number;
  } | null;
  fullDecodeExit: 0 | null;
  ffprobeExit: 0 | null;
  reason: string | null;
  subjectiveCreativeQuality: "NOT_MEASURED";
  architecturalFidelity: "HUMAN_REVIEW_REQUIRED";
}
/** Called with private owned output paths, never untrusted URLs or client paths. */
export async function inspectVideo(
  path: string,
  expected: QualityExpectation,
): Promise<QualityReport> {
  const report: QualityReport = {
    schemaVersion: 1,
    status: "FAIL",
    checks: {},
    metadata: null,
    samples: null,
    fullDecodeExit: null,
    ffprobeExit: null,
    reason: null,
    subjectiveCreativeQuality: "NOT_MEASURED",
    architecturalFidelity: "HUMAN_REVIEW_REQUIRED",
  };
  try {
    const size = (await stat(path)).size;
    if (size <= 0 || size > 52_428_800) throw new Error("OUTPUT_SIZE_LIMIT");
    const p = await run(
      "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-max_alloc",
        "67108864",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        path,
      ],
      { timeout: 10000, maxBuffer: 262144, env: isolatedWorkerEnvironment() },
    );
    report.ffprobeExit = 0;
    const meta = JSON.parse(p.stdout) as {
      streams: {
        codec_type: string;
        codec_name: string;
        width: number;
        height: number;
        pix_fmt: string;
        color_space: string;
        color_primaries: string;
        color_transfer: string;
        tags?: Record<string, string>;
      }[];
      format: { duration: string; tags?: Record<string, string> };
    };
    const v = meta.streams.find((s) => s.codec_type === "video");
    if (!v) throw new Error("NO_VIDEO_STREAM");
    const sha = digest(await readFile(path)),
      duration = Number(meta.format.duration);
    report.metadata = {
      width: v.width,
      height: v.height,
      durationSeconds: duration,
      codec: v.codec_name,
      pixelFormat: v.pix_fmt,
      colorSpace: v.color_space,
      bytes: size,
      sha256: sha,
    };
    const safe = new Set([
      "major_brand",
      "minor_version",
      "compatible_brands",
      "encoder",
      "language",
      "handler_name",
      "vendor_id",
    ]);
    report.checks = {
      hashAndMedia:
        sha === expected.evidence.sha256 &&
        size === expected.evidence.bytes &&
        expected.evidence.mime === "video/mp4" &&
        expected.evidence.codec === v.codec_name,
      dimensionsAndAspect:
        v.width === expected.width &&
        v.height === expected.height &&
        [16 / 9, 9 / 16].some((r) => Math.abs(v.width / v.height - r) < 0.001),
      duration:
        Number.isFinite(duration) &&
        duration <= 30.15 &&
        Math.abs(duration - expected.durationSeconds) < 0.15,
      codecAndColor:
        v.codec_name === "h264" &&
        v.pix_fmt === "yuv420p" &&
        v.color_space === "bt709" &&
        v.color_primaries === "bt709" &&
        v.color_transfer === "bt709",
      metadataAudioPrivacy:
        meta.streams.length === 1 &&
        Object.keys(meta.format.tags ?? {}).every((t) => safe.has(t)) &&
        meta.streams.every((s) =>
          Object.keys(s.tags ?? {}).every((t) => safe.has(t)),
        ),
      revision:
        expected.evidence.manifestRevision === expected.revision &&
        expected.evidence.manifestSha256 === expected.manifestSha256,
      provenance:
        expected.sourceHashes.length > 0 &&
        expected.sourceHashes.every((h) => /^[a-f0-9]{64}$/.test(h)) &&
        JSON.stringify(expected.evidence.sourceHashes) ===
          JSON.stringify(expected.sourceHashes) &&
        (expected.evidence.shotProvenance?.length ?? 0) > 0 &&
        JSON.stringify(
          expected.evidence.shotProvenance?.map((s) => s.sourceId),
        ) === JSON.stringify(expected.sourceIds) &&
        expected.evidence.shotProvenance!.every(
          (s, i, all) =>
            expected.sourceHashes.includes(s.sourceSha256) &&
            s.endSeconds > s.startSeconds &&
            Math.abs(s.startSeconds - (i ? all[i - 1]!.endSeconds : 0)) < 0.001,
        ) &&
        Math.abs(
          expected.evidence.shotProvenance!.at(-1)!.endSeconds -
            expected.durationSeconds,
        ) < 0.001,
      captionBoundsAndContrast: validateCaption(
        expected.evidence.captionLayout,
        expected.width,
        expected.height,
        expected.captionsRequired,
      ),
    };
    if (
      !Number.isFinite(duration) ||
      duration > 30.15 ||
      v.width < 64 ||
      v.height < 64 ||
      v.width > 1920 ||
      v.height > 1920 ||
      v.width * v.height > 2073600 ||
      v.codec_name !== "h264" ||
      v.pix_fmt !== "yuv420p"
    )
      throw new Error("UNSAFE_DECODE_METADATA");
    // Full decode catches packet corruption outside the sampled frames. No external protocols.
    await run(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-xerror",
        "-protocol_whitelist",
        "file,pipe",
        "-threads",
        "1",
        "-max_alloc",
        "67108864",
        "-max_pixels",
        "2073600",
        "-i",
        path,
        "-map",
        "0:v:0",
        "-an",
        "-f",
        "null",
        "-",
      ],
      { timeout: 60000, maxBuffer: 262144, env: isolatedWorkerEnvironment() },
    );
    report.fullDecodeExit = 0;
    report.checks["fullDecode"] = true;
    const frames = await run(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-protocol_whitelist",
        "file,pipe",
        "-threads",
        "1",
        "-max_alloc",
        "67108864",
        "-max_pixels",
        "2073600",
        "-i",
        path,
        "-an",
        "-t",
        "30",
        "-vf",
        "crop=iw:ih*0.65:0:ih*0.1,scale=96:54,fps=6,format=gray",
        "-threads",
        "1",
        "-f",
        "rawvideo",
        "pipe:1",
      ],
      {
        timeout: 60000,
        maxBuffer: 6_000_000,
        encoding: "buffer",
        env: isolatedWorkerEnvironment(),
      },
    );
    const samples = sampleStatistics(frames.stdout);
    const blank =
      longestRun(samples, (s) => s.mean < 5 || s.deviation < 1.5) / 6;
    const frozen =
      longestRun(samples, (s) => s.change !== null && s.change < 0.025) / 6;
    report.samples = {
      count: samples.length,
      rateFps: 6,
      longestBlankSeconds: blank,
      longestFrozenSeconds: frozen,
    };
    report.checks["sampledBlankFrames"] = blank <= 0.34;
    report.checks["sampledFrozenFrames"] = frozen < 2;
    report.status = Object.values(report.checks).every(Boolean)
      ? "PASS"
      : "FAIL";
  } catch {
    report.reason = "BOUNDED_PROBE_OR_DECODE_FAILED";
    report.checks["fullDecode"] = false;
  }
  return report;
}
export async function extractInspectionFrames(
  path: string,
  destination: string,
  duration: number,
) {
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const times = [
    Math.min(0.25, duration / 5),
    duration / 2,
    Math.max(0, duration - 0.25),
  ];
  for (const [i, time] of times.entries())
    await run(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-protocol_whitelist",
        "file,pipe",
        "-y",
        "-ss",
        String(time),
        "-threads",
        "1",
        "-max_alloc",
        "67108864",
        "-max_pixels",
        "2073600",
        "-i",
        path,
        "-frames:v",
        "1",
        "-vf",
        "scale=640:640:force_original_aspect_ratio=decrease",
        "-threads",
        "1",
        join(destination, `${i + 1}.png`),
      ],
      { timeout: 15000, maxBuffer: 65536, env: isolatedWorkerEnvironment() },
    );
}

/** V01 has its OWN exact1080p profile. It never invokes local360p/720p resizing or encodes invented detail. */
export async function validateV01Video(
  rawPath: string,
  cleanPath: string,
  expected: {
    durationSeconds: 4 | 8;
    aspectRatio: "16:9" | "9:16";
    maxBytes: number;
    sourceId: string;
    sourceSha256: string;
    revision: number;
    manifestSha256: string;
    requestId: string;
    mode: "offline-fixture" | "fal-live-test";
  },
) {
  const started = performance.now();
  const raw = await readFile(rawPath);
  invariant(
    raw.length > 32 &&
      raw.length <= expected.maxBytes &&
      raw.subarray(4, 8).toString() === "ftyp",
    "V01_MP4_BYTES_REQUIRED",
    422,
  );
  const info = await run(
    "ffprobe",
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-max_alloc",
      "67108864",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      rawPath,
    ],
    { timeout: 10_000, maxBuffer: 262_144, env: isolatedWorkerEnvironment() },
  );
  const m = JSON.parse(info.stdout) as {
    streams: {
      codec_type: string;
      codec_name: string;
      width: number;
      height: number;
      pix_fmt: string;
      sample_aspect_ratio?: string;
      avg_frame_rate: string;
      color_transfer?: string;
    }[];
    format: { duration: string };
  };
  const [width, height] =
    expected.aspectRatio === "16:9" ? [1920, 1080] : [1080, 1920];
  const v = m.streams[0],
    duration = Number(m.format.duration);
  const [n, d] = (v?.avg_frame_rate ?? "0/1").split("/").map(Number),
    fps = n! / d!;
  invariant(
    m.streams.length === 1 &&
      v?.codec_type === "video" &&
      v.codec_name === "h264" &&
      v.pix_fmt === "yuv420p" &&
      v.width === width &&
      v.height === height &&
      [undefined, "N/A", "1:1"].includes(v.sample_aspect_ratio) &&
      Number.isFinite(fps) &&
      fps > 0 &&
      fps <= 60 &&
      Number.isFinite(duration) &&
      Math.abs(duration - expected.durationSeconds) < 0.15 &&
      !["smpte2084", "arib-std-b67"].includes(v.color_transfer ?? ""),
    "V01_1080P_PROFILE_MISMATCH",
    422,
  );
  // Copy only: remove metadata, no scaling, frame interpolation, cropping, audio substitution or local render fallback.
  await run(
    "ffmpeg",
    [
      "-v",
      "error",
      "-nostdin",
      "-protocol_whitelist",
      "file,pipe",
      "-threads",
      "1",
      "-max_alloc",
      "67108864",
      "-max_pixels",
      "2073600",
      "-i",
      rawPath,
      "-map",
      "0:v:0",
      "-c:v",
      "copy",
      "-map_metadata",
      "-1",
      "-an",
      "-movflags",
      "+faststart",
      "-fs",
      String(expected.maxBytes),
      "-n",
      cleanPath,
    ],
    { timeout: 30_000, maxBuffer: 65_536, env: isolatedWorkerEnvironment() },
  );
  const clean = await readFile(cleanPath);
  const evidence: OutputEvidence = {
    kind:
      expected.mode === "fal-live-test"
        ? "provider-video"
        : "provider-contract-fixture",
    providerVideo: {
      profile: "v01-provider-1080p-v1",
      mode: expected.mode,
      productionRequestId: expected.requestId,
      nativeDetailVerified: false,
    },
    mime: "video/mp4",
    extension: "mp4",
    durationSeconds: duration,
    width,
    height,
    codec: "h264",
    bytes: clean.length,
    sha256: digest(clean),
    wallTimeMs: Math.round(performance.now() - started),
    actualExternalCostMicroUsd: expected.mode === "offline-fixture" ? 0 : null,
    sourceHashes: [expected.sourceSha256],
    manifestRevision: expected.revision,
    manifestSha256: expected.manifestSha256,
    shotProvenance: [
      {
        sourceId: expected.sourceId,
        sourceSha256: expected.sourceSha256,
        startSeconds: 0,
        endSeconds: expected.durationSeconds,
        operation: "provider-image-to-video",
      },
    ],
    qa: {
      integrity: true,
      architecturalFidelity: "HUMAN_REVIEW_REQUIRED",
      disclosure:
        expected.mode === "offline-fixture"
          ? "Hazır sentetik offline fixture video; yüklediğin fotoğraftan AI ile üretilmedi, fal üretimi değildir. 1080p dosya ölçülmüştür; doğal kaynak ayrıntısı veya ticari kalite kanıtlanmadı."
          : "Gerçek V01 sağlayıcı test çıktısı; bağımsız kaynak/mimari inceleme gerekir. Ölçülen1080p, native kaynak ayrıntısı garantisi değildir.",
    },
  };
  const qa = await inspectVideo(cleanPath, {
    width,
    height,
    durationSeconds: expected.durationSeconds,
    revision: expected.revision,
    manifestSha256: expected.manifestSha256,
    sourceHashes: [expected.sourceSha256],
    sourceIds: [expected.sourceId],
    captionsRequired: false,
    evidence,
  });
  invariant(qa.status === "PASS", "V01_VIDEO_QA_HOLD", 422);
  return { evidence, qa, rawSha256: digest(raw) };
}
