import { planShots } from "@/domain/shots";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";
import type { GenerationInput } from "@/domain/platform";
import { invariant, type Scene } from "@/domain/platform";
import type { OutputEvidence } from "@/contracts/platform-ports";
import type { LocalPrivateStorage } from "./storage";
import { digest } from "./crypto";

const run = promisify(execFile);
export interface MediaSource {
  readonly id: string;
  readonly clean_hash: string;
}
export async function buildOutput(
  storage: LocalPrivateStorage,
  jobId: string,
  input: z.infer<typeof GenerationInput>,
  scene: Scene,
  sources: readonly MediaSource[],
): Promise<OutputEvidence> {
  const started = performance.now();
  const dir = await mkdtemp(join(storage.root, "worker-"));
  const common = {
    artifactId: jobId,
    actualExternalCostMicroUsd: 0 as const,
    manifestRevision: scene.revision,
    sourceHashes: sources.map((s) => s.clean_hash),
  };
  if (input.mode === "interactive-3d") {
    invariant(
      scene.measuredBy &&
        scene.rooms.length > 0 &&
        scene.rooms.every((r) => r.truth === "E2"),
      "E2_MEASUREMENTS_REQUIRED",
    );
    const manifest = join(dir, "scene.json"),
      output = join(dir, "scene.glb");
    await writeFile(manifest, JSON.stringify(scene), { mode: 0o600 });
    await run(
      "blender",
      [
        "--background",
        "--factory-startup",
        "--disable-autoexec",
        "--python",
        join(process.cwd(), "scripts/blender-scene.py"),
        "--",
        "--manifest",
        manifest,
        "--output",
        output,
      ],
      {
        timeout: 120_000,
        maxBuffer: 1_048_576,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          PATH: process.env["PATH"] ?? "/usr/bin:/bin",
          BLENDER_USER_CONFIG: dir,
          PYTHONNOUSERSITE: "1",
        },
      },
    );
    const bytes = await readFile(output);
    invariant(
      bytes.subarray(0, 4).toString() === "glTF" &&
        bytes.readUInt32LE(4) === 2 &&
        bytes.readUInt32LE(8) === bytes.length,
      "INVALID_GLB",
    );
    const model = JSON.parse(
      bytes
        .subarray(20, 20 + bytes.readUInt32LE(12))
        .toString()
        .trim(),
    ) as {
      buffers?: { uri?: string }[];
      images?: { uri?: string }[];
      meshes?: unknown[];
    };
    invariant(
      (model.meshes?.length ?? 0) > 0 &&
        !(model.buffers ?? []).some((b) => b.uri) &&
        !(model.images ?? []).some((b) => b.uri),
      "EXTERNAL_OR_EMPTY_GLB",
    );
    const stored = await storage.finalizeOutput(
      scene.organizationId,
      jobId,
      output,
      "glb",
    );
    return {
      ...common,
      kind: "parametric-mesh",
      mime: "model/gltf-binary",
      extension: "glb",
      durationSeconds: null,
      width: null,
      height: null,
      codec: null,
      bytes: stored.bytes,
      sha256: stored.hash,
      wallTimeMs: Math.round(performance.now() - started),
      qa: {
        integrity: true,
        architecturalFidelity: "HUMAN_REVIEW_REQUIRED",
        disclosure:
          "Ölçülü sentetik planın parametrik Blender mesh'i. Gerçek mülk rekonstrüksiyonu veya Marble/Atlas çıktısı değildir.",
      },
    };
  }
  invariant(sources.length > 0, "CLEAN_IMAGE_REQUIRED");
  const selected = sources.slice(0, 3),
    width = input.aspectRatio === "16:9" ? 640 : 360,
    height = input.aspectRatio === "16:9" ? 360 : 640;
  const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y"];
  for (const source of selected) {
    const path = storage.path(scene.organizationId, source.id, "source");
    invariant(
      digest(await readFile(path)) === source.clean_hash,
      "SOURCE_HASH_MISMATCH",
    );
    args.push("-loop", "1", "-i", path);
  }
  const frames = Math.round((input.durationSeconds * 24) / selected.length);
  const filters = selected.map(
    (_, i) =>
      `[${i}:v]scale=1600:1600:force_original_aspect_ratio=increase,crop=1600:1600,zoompan=z='min(1.0+on*0.0008,1.08)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${frames}:s=${width}x${height}:fps=24,trim=duration=${input.durationSeconds / selected.length},setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v${i}]`,
  );
  const concat =
    selected.map((_, i) => `[v${i}]`).join("") +
    `concat=n=${selected.length}:v=1:a=0`;
  filters.push(
    concat +
      (input.captions
        ? `,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='LOCAL SYNTHETIC ${input.mode.toUpperCase()}':fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:x=16:y=h-th-18[out]`
        : "[out]"),
  );
  const output = join(dir, "output.mp4");
  await run(
    "ffmpeg",
    [
      ...args,
      "-filter_complex_threads",
      "1",
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[out]",
      "-t",
      String(input.durationSeconds),
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-threads",
      "2",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-map_metadata",
      "-1",
      output,
    ],
    { timeout: 90_000, maxBuffer: 262_144 },
  );
  const probe = await run(
    "ffprobe",
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", output],
    { timeout: 10_000, maxBuffer: 262_144 },
  );
  const metadata = JSON.parse(probe.stdout) as {
    streams: {
      codec_type: string;
      codec_name: string;
      width?: number;
      height?: number;
    }[];
    format: { duration: string };
  };
  const video = metadata.streams.find((x) => x.codec_type === "video");
  const duration = Number(metadata.format.duration);
  invariant(
    video?.codec_name === "h264" &&
      video.width === width &&
      video.height === height &&
      Math.abs(duration - input.durationSeconds) < 0.15,
    "MEDIA_QA_FAILED",
  );
  const stored = await storage.finalizeOutput(
    scene.organizationId,
    jobId,
    output,
    "mp4",
  );
  return {
    ...common,
    cameraPlan: scene.rooms.some((r) => r.truth === "E2") ? planShots(scene, input.mode, input.durationSeconds) : null,
    kind: "image-motion-demo",
    mime: "video/mp4",
    extension: "mp4",
    durationSeconds: duration,
    width,
    height,
    codec: video.codec_name,
    bytes: stored.bytes,
    sha256: stored.hash,
    wallTimeMs: Math.round(performance.now() - started),
    qa: {
      integrity: true,
      architecturalFidelity: "HUMAN_REVIEW_REQUIRED",
      disclosure:
        "Gerçek MP4; yerel kaynak-görsel hareketi/kesme demosu. Fotogerçekçi AI POV veya gerçek mekânda kamera yürüyüşü değildir. Müzik/voiceover yok.",
    },
  };
}
