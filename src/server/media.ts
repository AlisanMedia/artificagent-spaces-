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
): Promise<OutputEvidence> {
  const started = performance.now();
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
      width = input.aspectRatio === "16:9" ? 640 : 360,
      height = input.aspectRatio === "16:9" ? 360 : 640;
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
        "-loop",
        "1",
        "-i",
        storage.path(scene.organizationId, logo, "source"),
      );
    const frames = Math.round((input.durationSeconds * 24) / selected.length);
    const zoomRate =
      input.mode === "pov"
        ? 0.0005
        : input.mode === "cinematic"
          ? 0.0012
          : 0.0008;
    const grades = {
      modern: "eq=contrast=1.02:saturation=0.95",
      luxury: "eq=contrast=1.05:saturation=0.88:brightness=-0.005",
      warm: "eq=gamma_r=1.02:gamma_b=0.98",
      hotel: "eq=contrast=1.01:saturation=1.03",
      investment: "eq=saturation=0.9",
    };
    const shotDuration = input.durationSeconds / selected.length;
    const fade =
      input.mode === "cinematic"
        ? Math.min(0.18, shotDuration / 3)
        : input.mode === "hybrid"
          ? Math.min(0.08, shotDuration / 4)
          : 0;
    const tail =
      "," +
      grades[input.template] +
      (fade
        ? `,fade=t=in:st=0:d=${fade},fade=t=out:st=${shotDuration - fade}:d=${fade}`
        : "");
    const filters = selected.map((source, i) =>
      source.kind === "walkthrough"
        ? `[${i}:v]trim=duration=${input.durationSeconds / selected.length},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=24,setsar=1,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709${tail}[v${i}]`
        : `[${i}:v]scale=1600:1600:force_original_aspect_ratio=increase:out_color_matrix=bt709:out_range=tv,crop=1600:1600,zoompan=z='min(1.0+on*${zoomRate},1.08)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${frames}:s=${width}x${height}:fps=24,trim=duration=${input.durationSeconds / selected.length},setpts=PTS-STARTPTS,setsar=1,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709${tail}[v${i}]`,
    );
    const caption = join(dir, "caption.txt");
    const labels = {
      modern: "Modern Daire",
      luxury: "Lüks Konut",
      warm: "Sıcak Ev",
      hotel: "Otel / Konaklama",
      investment: "Yatırım Sunumu",
    };
    await writeFile(
      caption,
      `YEREL ÖRNEK • ${labels[input.template]}${input.branding && brand ? " • " + brand.displayName : ""}`,
      { mode: 0o600 },
    );
    const concat =
      selected.map((_, i) => `[v${i}]`).join("") +
      `concat=n=${selected.length}:v=1:a=0`;
    filters.push(
      concat +
        (input.captions || input.branding
          ? `,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${caption}:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:x=16:y=h-th-18${logo ? "[captioned]" : "[out]"}`
          : logo
            ? "[captioned]"
            : "[out]"),
    );
    if (logo) {
      filters.push(
        `[${selected.length}:v]scale=80:80:force_original_aspect_ratio=decrease,format=yuva420p[brandlogo]`,
      );
      filters.push("[captioned][brandlogo]overlay=x=W-w-14:y=14[out]");
    }
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
        output,
      ],
      { timeout: 90_000, maxBuffer: 262_144, env: isolatedWorkerEnvironment() },
    );
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
