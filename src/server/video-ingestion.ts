import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { invariant, PlatformError } from "@/domain/platform";
import {
  VIDEO_MAX_BYTES,
  VIDEO_MAX_SECONDS,
  validateMp4Magic,
} from "@/domain/media-intake";
import { isolatedWorkerEnvironment } from "./media";
const run = promisify(execFile);
let active = 0;
export async function sanitizeVideo(
  root: string,
  bytes: Uint8Array,
  signal?: AbortSignal,
) {
  invariant(
    bytes.length > 0 && bytes.length <= VIDEO_MAX_BYTES,
    "UPLOAD_SIZE_LIMIT",
    413,
  );
  validateMp4Magic(bytes);
  invariant(active < 1, "VIDEO_UPLOAD_BUSY", 429);
  signal?.throwIfAborted();
  active++;
  let dir: string | undefined;
  try {
    dir = await mkdtemp(join(root, "video-quarantine-"));
    const input = join(dir, "input.mp4"),
      output = join(dir, "clean.mp4");
    await writeFile(input, bytes, { mode: 0o600 });
    const env = isolatedWorkerEnvironment();
    const probe = await run(
      "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-enable_drefs",
        "0",
        "-use_absolute_path",
        "0",
        "-probesize",
        "5242880",
        "-analyzeduration",
        "3000000",
        "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate:format=duration",
        "-of",
        "json",
        input,
      ],
      { timeout: 10000, maxBuffer: 131072, env, signal },
    );
    const meta = JSON.parse(probe.stdout) as {
      streams: {
        codec_type: string;
        codec_name: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
      }[];
      format: { duration: string };
    };
    const video = meta.streams.filter((s) => s.codec_type === "video");
    const v = video[0];
    const duration = Number(meta.format.duration);
    invariant(
      video.length === 1 &&
        meta.streams.length <= 2 &&
        meta.streams.every(
          (s) =>
            s.codec_type === "video" ||
            (s.codec_type === "audio" && s.codec_name === "aac"),
        ),
      "UNSUPPORTED_VIDEO_STREAMS",
      415,
    );
    invariant(v?.codec_name === "h264", "UNSUPPORTED_VIDEO_CODEC", 415);
    invariant(
      Number.isFinite(duration) &&
        duration >= 0.25 &&
        duration <= VIDEO_MAX_SECONDS,
      "VIDEO_DURATION_LIMIT",
      422,
    );
    invariant(
      v.width &&
        v.height &&
        v.width >= 64 &&
        v.height >= 64 &&
        v.width <= 1920 &&
        v.height <= 1920 &&
        v.width * v.height <= 2073600,
      "VIDEO_DIMENSION_LIMIT",
      422,
    );
    const [n, d] = (v.r_frame_rate ?? "0/1").split("/").map(Number);
    const fps = n! / d!;
    invariant(
      Number.isFinite(fps) && fps > 0 && fps <= 60,
      "VIDEO_FRAME_RATE_LIMIT",
      422,
    );
    await run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-xerror",
        "-protocol_whitelist",
        "file,pipe",
        "-enable_drefs",
        "0",
        "-use_absolute_path",
        "0",
        "-threads",
        "1",
        "-max_alloc",
        "67108864",
        "-max_pixels",
        "2073600",
        "-i",
        input,
        "-map",
        "0:v:0",
        "-an",
        "-sn",
        "-dn",
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-t",
        String(VIDEO_MAX_SECONDS),
        "-vf",
        "scale='min(720,iw)':'min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=24,setsar=1,format=yuv420p",
        "-c:v",
        "libx264",
        "-threads",
        "1",
        "-preset",
        "fast",
        "-crf",
        "26",
        "-movflags",
        "+faststart",
        "-fs",
        "8388608",
        output,
      ],
      { timeout: 60000, maxBuffer: 262144, env, signal },
    );
    const clean = await readFile(output);
    invariant(
      clean.length > 0 && clean.length <= 8388608,
      "VIDEO_NORMALIZATION_LIMIT",
      422,
    );
    const checked = await run(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_name,codec_type,width,height:stream_tags:format=duration:format_tags",
        "-of",
        "json",
        output,
      ],
      { timeout: 10000, maxBuffer: 131072, env, signal },
    );
    const normalized = JSON.parse(checked.stdout) as {
      streams: {
        codec_type: string;
        width: number;
        height: number;
        tags?: Record<string, string>;
      }[];
      format: { duration: string; tags?: Record<string, string> };
    };
    const safeTags = new Set([
      "major_brand",
      "minor_version",
      "compatible_brands",
      "encoder",
      "language",
      "handler_name",
      "vendor_id",
    ]);
    invariant(
      normalized.streams.length === 1 &&
        normalized.streams[0]?.codec_type === "video" &&
        Object.keys(normalized.format.tags ?? {}).every((k) =>
          safeTags.has(k),
        ) &&
        normalized.streams.every((s) =>
          Object.keys(s.tags ?? {}).every((k) => safeTags.has(k)),
        ),
      "VIDEO_METADATA_STRIP_FAILED",
      422,
    );
    invariant(
      Math.abs(Number(normalized.format.duration) - duration) < 0.2,
      "VIDEO_DECODE_INCOMPLETE",
      422,
    );
    return {
      clean,
      width: normalized.streams[0]!.width,
      height: normalized.streams[0]!.height,
      durationSeconds: Number(normalized.format.duration),
    };
  } catch (e) {
    if (e instanceof PlatformError) throw e;
    throw new PlatformError(
      signal?.aborted ? "UPLOAD_CANCELLED" : "VIDEO_DECODE_FAILED",
      422,
    );
  } finally {
    active--;
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}
