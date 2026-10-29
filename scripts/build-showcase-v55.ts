/** One-time authored synthetic samples. No visitor inputs, provider SDK, network or paid calls. */
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { PlatformRuntime } from "../src/server/runtime";
const run = promisify(execFile);
const dir = "public/showcase-v55";
await mkdir(dir, { recursive: true });
await mkdir("fixtures/showcase-v55", { recursive: true });
await mkdir(".spaces-local/showcase-v55", { recursive: true, mode: 0o700 });
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
// Original vector architecture study; no actual property, address, competitor or stock asset.
const facade = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576" viewBox="0 0 1024 576"><rect width="1024" height="576" fill="#dce5e5"/><rect y="458" width="1024" height="118" fill="#c7c8b8"/><path d="M0 493L1024 470V576H0Z" fill="#b3b4a6"/><path d="M150 460V102H696V460Z" fill="#f0eadd"/><path d="M696 102L858 172V460H696Z" fill="#c7c0b0"/><path d="M130 100H712V117H130Z" fill="#7e897b"/><rect x="470" y="117" width="52" height="343" fill="#c5b598"/><g fill="#334b4e" stroke="#acb1a4" stroke-width="8"><path d="M199 158H423V259H199Z"/><path d="M563 158H660V259H563Z"/><path d="M199 315H423V415H199Z"/><path d="M563 315H660V458H563Z"/></g><g stroke="#d8dfd2" stroke-width="4"><path d="M309 158V259M199 210H423M310 315V415M199 367H423"/></g><path d="M178 270H449M178 283H449M178 296H449" stroke="#c1b091" stroke-width="5"/><path d="M753 204L819 225V303L753 292Z" fill="#334b4e"/><path d="M753 346L819 358V435H753Z" fill="#334b4e"/><rect x="94" y="451" width="788" height="17" fill="#e4dece"/><g fill="#5f765d"><ellipse cx="93" cy="388" rx="46" ry="76"/><ellipse cx="914" cy="391" rx="45" ry="73"/><ellipse cx="479" cy="452" rx="29" ry="19"/></g><path d="M93 417V477M914 419V477" stroke="#756650" stroke-width="9"/></svg>`;
await writeFile("fixtures/showcase-v55/facade.svg", facade);
await sharp(Buffer.from(facade))
  .png()
  .toFile(dir + "/facade.png");
const living = await readFile("public/golden-v5/living.png");
await sharp(living)
  .webp({ quality: 90 })
  .toFile(dir + "/comparison-before.webp");
// Actual pixel processing in a reproducible image pipeline, no CSS fake or changed framing.
await sharp(living)
  .normalise({ lower: 1, upper: 99 })
  .sharpen({ sigma: 0.8, m1: 0.5, m2: 1 })
  .webp({ quality: 90 })
  .toFile(dir + "/comparison-after.webp");
const assets: Record<string, unknown>[] = [];
async function asset(
  id: string,
  path: string,
  type: string,
  extra: Record<string, unknown> = {},
) {
  const b = await readFile(path);
  const meta =
    type === "image" || type === "panorama" ? await sharp(b).metadata() : null;
  const a = {
    id,
    url: "/" + path.replace(/^public\//, ""),
    sha256: hash(b),
    bytes: b.length,
    type,
    width: meta?.width ?? null,
    height: meta?.height ?? null,
    rights: "PROJECT_AUTHORED_SYNTHETIC",
    production: false,
    ...extra,
  };
  const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);
  const d = a.width && a.height ? gcd(Number(a.width), Number(a.height)) : null;
  const complete = {
    ...a,
    aspectRatio: d ? `${Number(a.width) / d}:${Number(a.height) / d}` : null,
  };
  assets.push(complete);
  return complete;
}
await asset("living-source", "public/golden-v5/living.png", "image", {
  propertyId: "golden-v5",
  cameraId: "camera-living",
});
await asset("facade-source", dir + "/facade.png", "image", {
  propertyId: "facade-study-v55",
  cameraId: "facade-fixed",
});
await asset("compare-before", dir + "/comparison-before.webp", "image", {
  propertyId: "golden-v5",
  cameraId: "camera-living",
  sourceHash: hash(living),
});
await asset("compare-after", dir + "/comparison-after.webp", "image", {
  propertyId: "golden-v5",
  cameraId: "camera-living",
  sourceHash: hash(living),
});
const root = await mkdtemp(join(tmpdir(), "spaces-showcase-v55-"));
const rt = await PlatformRuntime.create(root, true, false);
try {
  const author = await rt.db.actor("demo-admin-a", "studio"),
    reviewer = await rt.db.actor("demo-reviewer-a", "studio");
  for (const [style, mode, template] of [
    ["natural", "pov", "modern"],
    ["premium", "cinematic", "luxury"],
    ["explore", "hybrid", "warm"],
    ["exterior", "cinematic", "investment"],
  ] as const) {
    const p = await rt.properties.create(author, {
      title: "Sentetik vitrin " + style,
      syntheticOnly: true,
    });
    const source =
      style === "exterior" ? await readFile(dir + "/facade.png") : living;
    await rt.properties.upload(author, p.id, source, "photo", {
      syntheticOnly: true,
      ownedOrLicensed: true,
      metadataRemovalAccepted: true,
    });
    const j = await rt.jobs.submit(author, {
      propertyId: p.id,
      revision: 1,
      mode,
      template,
      durationSeconds: 4,
      aspectRatio: "16:9",
      captions: false,
      branding: false,
      idempotencyKey: "showcase-v55-" + style,
    });
    await rt.jobs.processNext();
    const done = await rt.jobs.get(author, j.id);
    if (done.state !== "awaiting-review" || !done.output)
      throw Error(done.error_code ?? "SHOWCASE_RENDER_FAILED");
    await rt.releases.review(reviewer, j.id, {
      decision: "approved",
      rights: true,
      evidence: true,
      continuity: true,
      disclosure: true,
    });
    const bytes = await rt.storage.readVerified(
      author.organizationId,
      done.output.artifactId!,
      done.output.sha256,
      "output",
      "mp4",
    );
    const path = dir + "/" + style + ".mp4";
    await writeFile(path, bytes);
    const probe = JSON.parse(
      (
        await run(
          "ffprobe",
          ["-v", "error", "-show_streams", "-show_format", "-of", "json", path],
          { timeout: 10000, maxBuffer: 262144 },
        )
      ).stdout,
    );
    await run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-threads",
        "1",
        "-y",
        "-ss",
        "0.5",
        "-i",
        path,
        "-frames:v",
        "1",
        ".spaces-local/showcase-v55/frame.png",
      ],
      { timeout: 10000 },
    );
    await sharp(".spaces-local/showcase-v55/frame.png")
      .webp({ quality: 90 })
      .toFile(dir + "/" + style + "-poster.webp");
    await sharp(".spaces-local/showcase-v55/frame.png")
      .resize(320, 180)
      .webp({ quality: 85 })
      .toFile(dir + "/" + style + "-thumb.webp");
    const propertyId = style === "exterior" ? "facade-study-v55" : "golden-v5",
      cameraId = style === "exterior" ? "facade-fixed" : "camera-living";
    await asset("video-" + style, path, "video", {
      propertyId,
      cameraId,
      sourceId: style === "exterior" ? "facade-source" : "living-source",
      durationSeconds: Number(probe.format.duration),
      width: probe.streams[0].width,
      height: probe.streams[0].height,
      codec: probe.streams[0].codec_name,
      pixelFormat: probe.streams[0].pix_fmt,
      audioStreams: probe.streams.filter(
        (s: { codec_type: string }) => s.codec_type === "audio",
      ).length,
      externalSpendMicroUsd: 0,
    });
    await asset(
      "poster-" + style,
      dir + "/" + style + "-poster.webp",
      "image",
      { propertyId, cameraId, sourceId: "video-" + style },
    );
    await asset("thumb-" + style, dir + "/" + style + "-thumb.webp", "image", {
      propertyId,
      cameraId,
      sourceId: "video-" + style,
    });
  }
} finally {
  await rt.db.close();
  await rm(root, { recursive: true, force: true });
}
await run(
  "blender",
  [
    "--background",
    "--factory-startup",
    "--disable-autoexec",
    "--python-exit-code",
    "1",
    "--python",
    "scripts/showcase-panorama.py",
  ],
  { timeout: 60000, maxBuffer: 1048576 },
);
await sharp(".spaces-local/showcase-v55/panorama.png")
  .jpeg({ quality: 90 })
  .toFile(dir + "/living-panorama.jpg");
await asset("living-panorama", dir + "/living-panorama.jpg", "panorama", {
  propertyId: "golden-v5",
  cameraId: "camera-living",
  projection: "equirectangular",
  capture: "BLENDER_CYCLES_SYNTHETIC",
  roomLabel: "Salon",
});
await asset("golden-model", "public/golden-v5/property.glb", "model", {
  propertyId: "golden-v5",
  cameraId: null,
});
const samples = ["natural", "premium", "explore", "exterior"].map((style) => ({
  id: "sample-" + style,
  product: "video",
  style,
  sourceId: style === "exterior" ? "facade-source" : "living-source",
  outputId: "video-" + style,
  posterId: "poster-" + style,
  thumbnailId: "thumb-" + style,
  alt:
    style === "exterior"
      ? "Özgün sentetik bina cephesi üzerinde yerel video kurgu örneği"
      : "Örnek mülkün aynı salon karesinden yerel video kurgu örneği",
  disclosure:
    "Hazır sentetik yerel kurgu; gerçek AI video üretimi değildir. Seçtiğin dosyadan oluşturulmadı.",
}));
const registry = {
  version: "showcase-v55",
  rights: "PROJECT_AUTHORED_SYNTHETIC",
  production: false,
  assets,
  samples,
  spatialSamples: [
    {
      id: "spatial-mesh",
      product: "ai-3d",
      style: "authored-synthetic",
      sourceId: "living-source",
      outputId: "golden-model",
      sourceRelationship: "SAME_AUTHORED_CAD_NOT_PHOTO_RECONSTRUCTION",
      disclosure:
        "Bağımsız sentetik CAD ve kaynak görünüm. Marble üretimi veya gerçek ev rekonstrüksiyonu değil.",
      alt: "Örnek mülk içinde serbest dolaşılan gerçek GLB tasarımı",
    },
    {
      id: "spatial-panorama",
      product: "tour-360",
      style: "authored-synthetic",
      sourceId: "living-source",
      outputId: "living-panorama",
      sourceRelationship: "SAME_AUTHORED_CAD_NOT_PHOTO_RECONSTRUCTION",
      disclosure:
        "Aynı sentetik CAD kamerasından küresel Blender render; Pedra üretimi değil.",
      alt: "Örnek salonun 2:1 equirectangular panoraması",
    },
  ],
  comparison: {
    beforeId: "compare-before",
    afterId: "compare-after",
    sourceId: "living-source",
    method:
      "Sharp normalise(1,99) + sharpen(0.8); identical pixels/framing geometry, no crop",
    disclosure:
      "Yerel fotoğraf düzenleme örneği; AI üretimi veya sanal mobilya ekleme değildir.",
  },
  modelId: "golden-model",
  panoramaId: "living-panorama",
  humanReviewers: null,
  externalProviderCalls: 0,
};
await writeFile(
  "fixtures/showcase-v55/registry.json",
  JSON.stringify(registry, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    assets: assets.length,
    videos: 4,
    syntheticPanoramas: 1,
    externalSpendUsd: 0,
    independentHumanAcceptance: null,
  }),
);
