import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";
import { invariant, type GenerationInput, type Scene } from "@/domain/platform";
import { propertyPrompt } from "@/domain/real-estate-prompts";
import type { OutputEvidence } from "@/contracts/platform-ports";
import { buildOutput, runCompositionTool, type MediaSource } from "./media";
import type { LocalPrivateStorage } from "./storage";
import { digest } from "./crypto";

/** Actual local files, never fake vendor media. Private intermediate clips require the same scoped preview/review as their parent job. */
export async function buildPhotoComposition(
  storage: LocalPrivateStorage,
  artifactId: string,
  input: z.infer<typeof GenerationInput>,
  scene: Scene,
  sources: readonly MediaSource[],
  brand?: Parameters<typeof buildOutput>[5],
): Promise<OutputEvidence> {
  const started = performance.now(),
    settings = input.photoComposition;
  invariant(
    settings &&
      sources.length >= 1 &&
      sources.length <= 12 &&
      sources.every((s) => s.kind === "photo") &&
      new Set(sources.map((s) => s.clean_hash)).size === sources.length &&
      input.durationSeconds === sources.length * 5,
    "INVALID_PHOTO_COMPOSITION",
  );
  const prompt = propertyPrompt(settings.styleId);
  const clips: NonNullable<
    OutputEvidence["photoComposition"]
  >["clips"][number][] = [];
  const dir = await mkdtemp(join(storage.root, "composition-"));
  const ownedArtifacts: string[] = [];
  try {
    for (const [order, source] of sources.entries()) {
      invariant(performance.now() - started < 90_000, "COMPOSITION_TIME_LIMIT");
      const clipId = `${artifactId}--c${order}`;
      ownedArtifacts.push(clipId);
      const output = await buildOutput(
        storage,
        clipId,
        { ...input, durationSeconds: 5, sourceAssetIds: [source.id] },
        scene,
        [source],
        brand,
      );
      clips.push({
        order,
        artifactId: clipId,
        sourceAssetId: source.id,
        sourceSha256: source.clean_hash,
        sha256: output.sha256,
        bytes: output.bytes,
        durationSeconds: output.durationSeconds!,
      });
    }
    const width = input.aspectRatio === "16:9" ? 640 : 360,
      height = input.aspectRatio === "16:9" ? 360 : 640;
    const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y"];
    for (const clip of clips) {
      await storage.readVerified(
        scene.organizationId,
        clip.artifactId,
        clip.sha256,
        "output",
        "mp4",
      );
      args.push(
        "-threads",
        "1",
        "-i",
        storage.path(scene.organizationId, clip.artifactId, "output", "mp4"),
      );
    }
    const destination = join(dir, "assembled.mp4"),
      encodeStarted = performance.now();
    const filter =
      clips
        .map((_, i) => `[${i}:v]setsar=1,setpts=PTS-STARTPTS[v${i}]`)
        .join(";") +
      ";" +
      clips.map((_, i) => `[v${i}]`).join("") +
      `concat=n=${clips.length}:v=1:a=0[out]`;
    await runCompositionTool(
      "ffmpeg",
      [
        ...args,
        "-filter_complex_threads",
        "1",
        "-filter_complex",
        filter,
        "-map",
        "[out]",
        "-t",
        String(input.durationSeconds),
        "-an",
        "-sn",
        "-dn",
        "-map_chapters",
        "-1",
        "-map_metadata",
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
        "-fs",
        "26214400",
        destination,
      ],
      storage.root,
      15_000,
    );
    const ffmpegWallTimeMs = Math.round(performance.now() - encodeStarted);
    const probe = await runCompositionTool(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        destination,
      ],
      storage.root,
      10_000,
    );
    const metadata = JSON.parse(probe.stdout) as {
      streams: {
        codec_type: string;
        codec_name: string;
        width: number;
        height: number;
        color_space: string;
      }[];
      format: { duration: string };
    };
    const video = metadata.streams[0],
      duration = Number(metadata.format.duration);
    invariant(
      metadata.streams.length === 1 &&
        video?.codec_name === "h264" &&
        video.codec_type === "video" &&
        video.width === width &&
        video.height === height &&
        video.color_space === "bt709" &&
        Math.abs(duration - input.durationSeconds) <= 1 / 24 + 0.002,
      "COMPOSITION_MEDIA_QA_FAILED",
    );
    await runCompositionTool(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-xerror",
        "-nostdin",
        "-threads",
        "1",
        "-i",
        destination,
        "-map",
        "0:v:0",
        "-f",
        "null",
        "-",
      ],
      storage.root,
      10_000,
    );
    const auxiliaryBytes = clips.reduce((sum, clip) => sum + clip.bytes, 0);
    const bytes = await readFile(destination);
    invariant(
      bytes.length + auxiliaryBytes <= 52_428_800,
      "COMPOSITION_OUTPUT_QUOTA",
    );
    const stored = await storage.finalizeOutput(
      scene.organizationId,
      artifactId,
      destination,
      "mp4",
    );
    return {
      artifactId,
      manifestSha256: digest(JSON.stringify(scene)),
      kind: "image-motion-demo",
      mime: "video/mp4",
      extension: "mp4",
      width,
      height,
      durationSeconds: duration,
      codec: "h264",
      colorSpace: "bt709-sdr",
      bytes: stored.bytes,
      sha256: stored.hash,
      actualExternalCostMicroUsd: 0,
      manifestRevision: scene.revision,
      sourceHashes: [
        ...sources.map((s) => s.clean_hash),
        ...(brand?.logoHash ? [brand.logoHash] : []),
      ],
      wallTimeMs: Math.round(performance.now() - started),
      auxiliaryBytes,
      nativeRenderMetrics: { ffmpegExitCode: 0, ffmpegWallTimeMs },
      renderProfile: {
        id: "local-photo-edit-v54",
        labOnly: false,
        width,
        height,
        durationSeconds: duration,
      },
      photoComposition: {
        version: settings.version,
        styleId: settings.styleId,
        requestedDurationSeconds: settings.requestedDurationSeconds,
        clipSeconds: 5,
        fit: "letterbox",
        actualProvider: "local-ffmpeg",
        plannedProvider: "fal",
        plannedModel: prompt.endpoint,
        clips,
      },
      shotProvenance: sources.map((source, i) => ({
        sourceId: source.id,
        sourceSha256: source.clean_hash,
        startSeconds: i * 5,
        endSeconds: Math.min((i + 1) * 5, duration),
        operation: "still-letterbox-motion",
      })),
      qa: {
        integrity: true,
        architecturalFidelity: "HUMAN_REVIEW_REQUIRED",
        disclosure:
          "Yerel sentetik kurgu: her fotoğraftan ayrı 5 saniyelik kaynak-görsel klibi ve gerçek H.264 MP4 birleştirmesi. Gerçek AI üretimi veya 1080p çıktı değildir. Her sahne ve bütün film bağımsız inceleme bekler.",
      },
    };
  } catch (error) {
    await Promise.all(
      ownedArtifacts.map((id) =>
        rm(storage.path(scene.organizationId, id, "output", "mp4"), {
          force: true,
        }),
      ),
    );
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function discardFencedComposition(
  storage: LocalPrivateStorage,
  organizationId: string,
  output: OutputEvidence,
) {
  if (!output.photoComposition || !output.artifactId) return;
  const prefix = output.artifactId + "--c";
  invariant(
    output.photoComposition.clips.every((c) => c.artifactId.startsWith(prefix)),
    "COMPOSITION_ARTIFACT_SCOPE_DENIED",
    403,
  );
  await Promise.all(
    [
      output.artifactId,
      ...output.photoComposition.clips.map((c) => c.artifactId),
    ].map((id) =>
      rm(storage.path(organizationId, id, "output", "mp4"), { force: true }),
    ),
  );
}
