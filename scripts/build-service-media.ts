/** Offline authoring of public, source-bound service examples. No provider/network transport. */
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { buildOutput, isolatedWorkerEnvironment } from "../src/server/media";
import { LocalPrivateStorage } from "../src/server/storage";
import { GenerationInput, validateScene } from "../src/domain/platform";
import { ShowcaseRegistry } from "../src/domain/showcase";
const run = promisify(execFile),
  hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const inputs = ".spaces-local/service-media-inputs",
  dir = "public/showcase-v55";
await mkdir(inputs, { recursive: true, mode: 0o700 });
const origins = {
  room: {
    propertyId: "polyhaven-brown04",
    cameraId: "panorama-perspective-center",
    title: "Brown Photostudio 04",
    author: "Sergej Majboroda",
    sourcePage: "https://polyhaven.com/a/brown_photostudio_04",
    upstreamSha256:
      "d59e82aeffbd44dd7d779b983350fc515faa70b194cb6966f35e08b1b40a3a2c",
    yaw: 0,
  },
  exterior: {
    propertyId: "polyhaven-modern-buildings-2",
    cameraId: "panorama-perspective-center",
    title: "Modern Buildings 2",
    author: "Alexander Scholten",
    sourcePage: "https://polyhaven.com/a/modern_buildings_2",
    upstreamSha256:
      "e025caabb1e925541f9095325e9e091c9dac9bb240393e1d8a2092ac1479e231",
    yaw: 0,
  },
} as const;
const license = (origin: (typeof origins)[keyof typeof origins]) => ({
  id: "CC0-1.0" as const,
  licenseUrl: "https://polyhaven.com/license" as const,
  sourcePage: origin.sourcePage,
  author: origin.author,
  retrievedOn: "2026-10-29",
  upstreamSha256: origin.upstreamSha256,
});
const registry = JSON.parse(
  await readFile("fixtures/showcase-v55/registry.json", "utf8"),
);
const assets: Record<string, unknown>[] = registry.assets.filter(
  (a: { id: string }) => !a.id.startsWith("cc0-") && a.id !== "model-cover",
);
async function add(
  id: string,
  path: string,
  type: string,
  extra: Record<string, unknown>,
) {
  const b = await readFile(path),
    meta =
      type === "image" || type === "panorama"
        ? await sharp(b).metadata()
        : null;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const width = meta?.width ?? Number(extra["width"]),
    height = meta?.height ?? Number(extra["height"]),
    g = gcd(width, height);
  const item = {
    id,
    url: "/" + path.replace(/^public\//, ""),
    sha256: hash(b),
    bytes: b.length,
    type,
    width,
    height,
    aspectRatio: `${width / g}:${height / g}`,
    production: false,
    ...extra,
  };
  assets.push(item);
  return item;
}
const temp = await mkdtemp(join(tmpdir(), "spaces-public-service-examples-"));
const storage = new LocalPrivateStorage(temp),
  organizationId = "public-licensed-examples";
const photos: Record<
  string,
  {
    id: string;
    cleanHash: string;
    origin: (typeof origins)[keyof typeof origins];
  }
> = {};
try {
  for (const [kind, origin] of Object.entries(origins)) {
    const raw = await readFile(join(inputs, kind + ".jpg"));
    if (raw.length > 48_000_000 || hash(raw) !== origin.upstreamSha256)
      throw Error("UNVERIFIED_PUBLIC_SOURCE");
    const image = sharp(raw, {
        limitInputPixels: 200_000_000,
        failOn: "warning",
      }),
      m = await image.metadata();
    if (m.width !== 2 * m.height!) throw Error("REFERENCE_PANORAMA_REQUIRED");
    await image
      .resize(8192, 4096, { withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toFile(join(inputs, kind + "-bounded.jpg"));
    await run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-threads",
        "1",
        "-i",
        join(inputs, kind + "-bounded.jpg"),
        "-vf",
        `v360=input=equirect:output=flat:h_fov=95:v_fov=60:yaw=${origin.yaw}:w=1280:h=720`,
        "-frames:v",
        "1",
        join(inputs, kind + "-perspective.png"),
      ],
      { timeout: 20000, maxBuffer: 262144, env: isolatedWorkerEnvironment() },
    );
    const jpg = await sharp(join(inputs, kind + "-perspective.png"))
        .jpeg({ quality: 92 })
        .toBuffer(),
      id = "cc0-" + kind + "-source";
    const clean = await storage.ingest(organizationId, id, jpg);
    const path = `${dir}/${id}.jpg`;
    await writeFile(path, await storage.read(organizationId, id, "source"));
    await add(id, path, "image", {
      propertyId: origin.propertyId,
      cameraId: origin.cameraId,
      rights: "VERIFIED_CC0_REFERENCE",
      license: license(origin),
    });
    photos[kind] = { id, cleanHash: clean.cleanHash, origin };
  }
  const samples = [];
  for (const [style, mode, template] of [
    ["natural", "pov", "modern"],
    ["premium", "cinematic", "luxury"],
    ["explore", "hybrid", "warm"],
    ["exterior", "cinematic", "investment"],
  ] as const) {
    const photo = photos[style === "exterior" ? "exterior" : "room"]!;
    // Empty authored planning context: no dimensions/rooms are inferred from public photographs.
    const scene = validateScene({
      schemaVersion: 1,
      organizationId,
      propertyId: photo.origin.propertyId,
      revision: 1,
      source: "synthetic",
      measuredBy: null,
      evidenceIds: [photo.id],
      rooms: [],
      doors: [],
      facts: [],
      pois: [],
      unknownRegions: [
        "No measured geometry; licensed public reference photography only",
      ],
      dayparts: [],
      calibratedLighting: false,
    });
    const input = GenerationInput.parse({
      propertyId: scene.propertyId,
      revision: 1,
      mode,
      template,
      durationSeconds: 5,
      aspectRatio: "16:9",
      idempotencyKey: "public-service-" + style,
      sourceAssetIds: [photo.id],
      captions: false,
      branding: false,
      photoComposition: {
        version: "property-video-v1",
        styleId: style,
        requestedDurationSeconds: 30,
      },
    });
    const jobId = "service-example-" + style;
    const result = await buildOutput(storage, jobId, input, scene, [
      {
        id: photo.id,
        clean_hash: photo.cleanHash,
        kind: "photo",
        mime: "image/jpeg",
      },
    ]);
    const path = `${dir}/cc0-${style}.mp4`;
    await writeFile(
      path,
      await storage.read(organizationId, jobId, "output", "mp4"),
    );
    await run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-threads",
        "1",
        "-ss",
        "0.5",
        "-i",
        path,
        "-frames:v",
        "1",
        join(inputs, style + "-frame.png"),
      ],
      { timeout: 10000, maxBuffer: 262144, env: isolatedWorkerEnvironment() },
    );
    const common = {
      propertyId: scene.propertyId,
      cameraId: photo.origin.cameraId,
      rights: "VERIFIED_CC0_REFERENCE",
      license: license(photo.origin),
    };
    await add("cc0-video-" + style, path, "video", {
      ...common,
      sourceId: photo.id,
      width: result.width,
      height: result.height,
      durationSeconds: result.durationSeconds,
      codec: "h264",
      pixelFormat: "yuv420p",
      audioStreams: 0,
      externalSpendMicroUsd: 0,
    });
    for (const [name, width] of [
      ["poster", 1280],
      ["thumb", 320],
    ] as const) {
      const imagePath = `${dir}/cc0-${style}-${name}.webp`;
      // Posters are decoded output frames; no unrelated or higher-detail promise.
      await sharp(join(inputs, style + "-frame.png"))
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 90 })
        .toFile(imagePath);
      await add(`cc0-${name}-${style}`, imagePath, "image", {
        ...common,
        sourceId: "cc0-video-" + style,
      });
    }
    samples.push({
      id: "sample-" + style,
      product: "video",
      style,
      sourceId: photo.id,
      outputId: "cc0-video-" + style,
      posterId: "cc0-poster-" + style,
      thumbnailId: "cc0-thumb-" + style,
      alt:
        style === "exterior"
          ? "CC0 lisanslı modern yapı fotoğrafından gerçek yerel video örneği"
          : "CC0 lisanslı aydınlık iç mekân fotoğrafından gerçek yerel video örneği",
      disclosure:
        "CC0 lisanslı fotoğraftan mevcut yerel kurgu hattıyla hazırlanmış gerçek MP4. Canlı AI kamera hareketi değildir. Seçtiğin dosyadan oluşturulmadı.",
    });
  }
  await run(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-threads",
      "1",
      "-i",
      join(inputs, "room-bounded.jpg"),
      "-vf",
      `v360=input=equirect:output=equirect:yaw=${origins.room.yaw}:w=2048:h=1024`,
      "-frames:v",
      "1",
      join(inputs, "panorama.png"),
    ],
    { timeout: 20000, maxBuffer: 262144, env: isolatedWorkerEnvironment() },
  );
  await sharp(join(inputs, "panorama.png"))
    .jpeg({ quality: 90 })
    .toFile(`${dir}/cc0-room-panorama.jpg`);
  const common = {
    propertyId: origins.room.propertyId,
    cameraId: origins.room.cameraId,
    rights: "VERIFIED_CC0_REFERENCE",
    license: license(origins.room),
  };
  await add("cc0-room-panorama", `${dir}/cc0-room-panorama.jpg`, "panorama", {
    ...common,
    projection: "equirectangular",
    capture: "LICENSED_CC0_PHOTOGRAPHY",
    roomLabel: "Lisanslı iç mekân örneği",
  });
  await sharp(`${dir}/cc0-room-source.jpg`)
    .webp({ quality: 90 })
    .toFile(`${dir}/cc0-panorama-poster.webp`);
  await add("cc0-panorama-poster", `${dir}/cc0-panorama-poster.webp`, "image", {
    ...common,
    sourceId: "cc0-room-panorama",
  });
  await sharp(join(inputs, "model-cover.png"))
    .webp({ quality: 90 })
    .toFile(`${dir}/model-cover.webp`);
  await add("model-cover", `${dir}/model-cover.webp`, "image", {
    propertyId: "golden-v5",
    cameraId: "isometric-service-cover",
    sourceId: "golden-model",
    rights: "PROJECT_AUTHORED_SYNTHETIC",
  });
  const updated = {
    ...registry,
    rights: "MIXED_AUTHORED_AND_VERIFIED_CC0",
    assets,
    samples,
    panoramaId: "cc0-room-panorama",
    modelPosterId: "model-cover",
    panoramaPosterId: "cc0-panorama-poster",
    spatialSamples: [
      registry.spatialSamples.find(
        (s: { product: string }) => s.product === "ai-3d",
      ),
      {
        id: "spatial-panorama",
        product: "tour-360",
        style: "licensed-reference",
        sourceId: "cc0-room-source",
        outputId: "cc0-room-panorama",
        sourceRelationship: "LICENSED_PANORAMA_AND_PERSPECTIVE_FRAME",
        disclosure:
          "Poly Haven CC0 fotoğraf panoraması. Gerçek oda fotoğrafıdır; AI veya Pedra çıktısı değildir.",
        alt: "Lisanslı aydınlık iç mekân içinde gerçek 360 derece bakış",
      },
    ],
  };
  ShowcaseRegistry.parse(updated);
  await writeFile(
    "fixtures/showcase-v55/registry.json",
    JSON.stringify(updated, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      result: "PUBLIC_SERVICE_EXAMPLES_AUTHORED",
      assets: assets.length,
      videos: samples.length,
      providerCalls: 0,
      externalSpendUsd: 0,
      oldAssetBytesPreserved: true,
    }),
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
