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
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", path],
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
