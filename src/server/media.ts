import { planShots } from "@/domain/shots";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";
import type { GenerationInput } from "@/domain/platform";
import { invariant, type Scene } from "@/domain/platform";
import type { OutputEvidence } from "@/contracts/platform-ports";
import type { LocalPrivateStorage } from "./storage";
import { digest } from "./crypto";
import {
  renderProfile,
  validateCaption,
  type LabProfile,
} from "@/domain/video-quality";
import { renderCaption } from "./captions";

const run = promisify(execFile);
export function isolatedWorkerEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    PATH: process.env["PATH"] ?? "/usr/bin:/bin",
    LANG: "C.UTF-8",
    PYTHONNOUSERSITE: "1",
  };
}
export interface MediaSource {
  readonly id: string;
  readonly clean_hash: string;
  readonly kind: string;
  readonly mime?: string | undefined;
}
export async function buildOutput(
  storage: LocalPrivateStorage,
  jobId: string,
  input: z.infer<typeof GenerationInput>,
  scene: Scene,
  sources: readonly MediaSource[],
  brand?: {
    displayName: string;
    logoAssetId: string | null;
    logoHash?: string | undefined;
  },
  laboratory?: {
    readonly profile: LabProfile;
    readonly purpose: "isolated-quality-lab-v4";
  },
): Promise<OutputEvidence> {
  const started = performance.now();
  invariant(
    !laboratory || laboratory.purpose === "isolated-quality-lab-v4",
    "LAB_PROFILE_NOT_AUTHORIZED",
  );
  const spec = renderProfile(
    input.aspectRatio,
    input.durationSeconds,
    laboratory?.profile,
  );
  const dir = await mkdtemp(join(storage.root, "worker-"));
  try {
    const common = {
      manifestSha256: digest(JSON.stringify(scene)),
      artifactId: jobId,
      actualExternalCostMicroUsd: 0 as const,
      manifestRevision: scene.revision,
      sourceHashes: [
        ...sources.map((s) => s.clean_hash),
        ...(brand?.logoHash ? [brand.logoHash] : []),
      ],
      brandSnapshot: brand
        ? { displayName: brand.displayName, logoSha256: brand.logoHash ?? null }
        : null,
    };
    if (input.mode === "interactive-3d") {
      invariant(
        scene.measuredBy &&
          scene.rooms.length > 0 &&
          scene.rooms.every((r) => r.truth === "E2"),
        "E2_MEASUREMENTS_REQUIRED",
      );
      for (const source of sources)
        invariant(
          digest(
            await storage.read(
              scene.organizationId,
              source.id,
              "source",
              source.kind === "walkthrough" ? "mp4" : "jpg",
            ),
          ) === source.clean_hash,
          "SOURCE_HASH_MISMATCH",
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
          "--python-exit-code",
          "1",
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
            ...isolatedWorkerEnvironment(),
            BLENDER_USER_CONFIG: dir,
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
    const selected = sources
        .filter(
          (source) =>
            source.kind === "photo" ||
            source.kind === "panorama" ||
            source.kind === "walkthrough",
        )
        .slice(0, input.sourceAssetIds ? 12 : 3),
      width = spec.width,
      height = spec.height;
    invariant(selected.length > 0, "CLEAN_IMAGE_REQUIRED");
    const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y"];
    for (const source of selected) {
      const path = storage.path(
        scene.organizationId,
        source.id,
        "source",
        source.kind === "walkthrough" ? "mp4" : "jpg",
      );
      invariant(
        digest(await readFile(path)) === source.clean_hash,
        "SOURCE_HASH_MISMATCH",
      );
      args.push(
        "-threads",
        "1",
        ...(source.kind === "walkthrough"
          ? ["-stream_loop", "-1"]
          : ["-loop", "1"]),
        "-i",
        path,
      );
    }
    const logo =
      input.branding && brand?.logoAssetId ? brand.logoAssetId : null;
    if (logo)
      args.push(
        "-threads",
        "1",
        "-loop",
        "1",
        "-i",
        storage.path(scene.organizationId, logo, "source"),
      );
    const workingWidth = input.aspectRatio === "16:9" ? 1600 : 900;
    const workingHeight = input.aspectRatio === "16:9" ? 900 : 1600;
    const frames = Math.round((spec.durationSeconds * 24) / selected.length);
    // Spread bounded motion over the entire shot; the old fixed step plateaued on long shots.
    const zoomRate =
      (input.mode === "pov" ? 0.04 : input.mode === "cinematic" ? 0.08 : 0.06) /
      Math.max(1, frames - 1);
    const grades = {
      modern: "eq=contrast=1.02:saturation=0.95",
      luxury: "eq=contrast=1.05:saturation=0.88:brightness=-0.005",
      warm: "eq=gamma_r=1.02:gamma_b=0.98",
      hotel: "eq=contrast=1.01:saturation=1.03",
      investment: "eq=saturation=0.9",
    };
    const shotDuration = spec.durationSeconds / selected.length;
    const fade =
      input.mode === "cinematic"
        ? Math.min(0.18, shotDuration / 3)
        : input.mode === "hybrid"
          ? Math.min(0.08, shotDuration / 4)
          : 0;
    // Fade only at the start/end of the assembled reel; never flash to black at internal cuts.
    const tail = (index: number) =>
      "," +
      grades[input.template] +
      (fade && index === 0 ? `,fade=t=in:st=0:d=${fade}` : "") +
      (fade && index === selected.length - 1
        ? `,fade=t=out:st=${shotDuration - fade}:d=${fade}`
        : "");
    const filters = selected.map((source, i) =>
      source.kind === "walkthrough"
        ? `[${i}:v]trim=duration=${spec.durationSeconds / selected.length},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=24,setsar=1,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709${tail(i)}[v${i}]`
        : `[${i}:v]scale=${workingWidth}:${workingHeight}:force_original_aspect_ratio=increase:out_color_matrix=bt709:out_range=tv,crop=${workingWidth}:${workingHeight},zoompan=z='min(1.0+on*${zoomRate},1.08)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${frames}:s=${width}x${height}:fps=24,trim=duration=${spec.durationSeconds / selected.length},setpts=PTS-STARTPTS,setsar=1,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709${tail(i)}[v${i}]`,
    );
    const labels = {
      modern: "Modern Daire",
      luxury: "Lüks Konut",
      warm: "Sıcak Ev",
      hotel: "Otel / Konaklama",
      investment: "Yatırım Sunumu",
    };
    const caption =
      input.captions || input.branding
        ? await renderCaption(
            `YEREL ÖRNEK • ${labels[input.template]}${input.branding && brand ? " • " + brand.displayName : ""}`,
            width,
            height,
          )
        : null;
    if (caption) {
      const captionPath = join(dir, "caption.png");
      await writeFile(captionPath, caption.bitmap, { mode: 0o600 });
      args.push("-threads", "1", "-loop", "1", "-i", captionPath);
    }
    invariant(
      validateCaption(
        caption?.layout,
        width,
        height,
        !!(input.captions || input.branding),
      ),
      "CAPTION_LAYOUT_LIMIT",
    );
    const concat =
      selected.map((_, i) => `[v${i}]`).join("") +
      `concat=n=${selected.length}:v=1:a=0`;
    filters.push(
      concat + (caption ? "[uncaptioned]" : logo ? "[captioned]" : "[out]"),
    );
    if (caption)
      filters.push(
        `[uncaptioned][${selected.length + (logo ? 1 : 0)}:v]overlay=x=${caption.layout.x}:y=${caption.layout.y}${logo ? "[captioned]" : "[out]"}`,
      );
    if (logo) {
      filters.push(
        `[${selected.length}:v]scale=80:80:force_original_aspect_ratio=decrease,format=yuva420p[brandlogo]`,
      );
      filters.push("[captioned][brandlogo]overlay=x=W-w-14:y=14[out]");
    }
    const output = join(dir, "output.mp4");
    const encodeStarted = performance.now();
    await run(
      laboratory ? "prlimit" : "ffmpeg",
      [
        ...(laboratory ? ["--as=1073741824", "--cpu=75", "--", "ffmpeg"] : []),
        ...args,
        "-filter_complex_threads",
        "1",
        "-filter_complex",
        filters.join(";"),
        "-map",
        "[out]",
        "-t",
        String(spec.durationSeconds),
        "-an",
        "-sn",
        "-dn",
        "-map_chapters",
        "-1",
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
        "-x264-params",
        "colorprim=bt709:transfer=bt709:colormatrix=bt709",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-colorspace",
        "bt709",
        "-color_range",
        "tv",
        "-movflags",
        "+faststart+write_colr",
        "-map_metadata",
        "-1",
        "-fs",
        String(spec.maxOutputBytes),
        output,
      ],
      {
        timeout: spec.timeoutMs,
        maxBuffer: 262_144,
        env: isolatedWorkerEnvironment(),
      },
    );
    const ffmpegWallTimeMs = Math.round(performance.now() - encodeStarted);
    const probe = await run(
      "ffprobe",
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", output],
      { timeout: 10_000, maxBuffer: 262_144, env: isolatedWorkerEnvironment() },
    );
    const metadata = JSON.parse(probe.stdout) as {
      streams: {
        codec_type: string;
        codec_name: string;
        width?: number;
        height?: number;
        color_space?: string;
        color_primaries?: string;
        color_transfer?: string;
      }[];
      format: { duration: string };
    };
    const video = metadata.streams.find((x) => x.codec_type === "video");
    const duration = Number(metadata.format.duration);
    invariant(
      video?.codec_name === "h264" &&
        video.width === width &&
        video.height === height &&
        video.color_space === "bt709" &&
        video.color_primaries === "bt709" &&
        video.color_transfer === "bt709" &&
        Math.abs(duration - spec.durationSeconds) < 0.15,
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
      nativeRenderMetrics: { ffmpegExitCode: 0, ffmpegWallTimeMs },
      renderProfile: spec,
      captionLayout: caption?.layout ?? null,
      shotProvenance: selected.map((source, i) => ({
        sourceId: source.id,
        sourceSha256: source.clean_hash,
        startSeconds: i * shotDuration,
        endSeconds: (i + 1) * shotDuration,
        operation:
          source.kind === "walkthrough" ? "footage-loop-cut" : "still-pan-zoom",
      })),
      cameraPlan: scene.rooms.some((r) => r.truth === "E2")
        ? planShots(scene, input.mode, input.durationSeconds)
        : null,
      kind: "image-motion-demo",
      mime: "video/mp4",
      extension: "mp4",
      durationSeconds: duration,
      width,
      height,
      codec: video.codec_name,
      colorSpace: "bt709-sdr",
      bytes: stored.bytes,
      sha256: stored.hash,
      wallTimeMs: Math.round(performance.now() - started),
      qa: {
        integrity: true,
        architecturalFidelity: "HUMAN_REVIEW_REQUIRED",
        disclosure:
          "Gerçek MP4; yerel kaynak-görsel / yüklenen sessiz görüntü hareketi ve kesme demosu. Fotogerçekçi AI POV veya gerçek mekânda kamera yürüyüşü değildir. Müzik/voiceover yok.",
      },
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
