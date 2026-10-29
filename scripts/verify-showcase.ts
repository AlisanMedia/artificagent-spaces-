/** Build gate: allowlisted local files, immutable provenance, real decode and privacy checks. */
import { readFile, readdir, lstat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { ShowcaseRegistry } from "../src/domain/showcase";
const run = promisify(execFile),
  hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
export async function verifyShowcase(root = process.cwd()) {
  const registry = ShowcaseRegistry.parse(
    JSON.parse(
      await readFile(join(root, "fixtures/showcase-v55/registry.json"), "utf8"),
    ),
  );
  const files = new Set<string>();
  for (const a of registry.assets) {
    if (a.width && a.height) {
      const [w, h] = a.aspectRatio?.split(":").map(Number) ?? [];
      if (!w || !h || Math.abs(w / h - a.width / a.height) > 0.000001)
        throw Error("SHOWCASE_ASPECT_MISMATCH");
    }
    const path = join(root, "public", a.url),
      stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw Error("SHOWCASE_FILE_ONLY");
    const bytes = await readFile(path);
    if (hash(bytes) !== a.sha256 || bytes.length !== a.bytes)
      throw Error("SHOWCASE_HASH_DRIFT");
    if (a.url.startsWith("/showcase-v55/")) files.add(a.url.split("/").at(-1)!);
    if (["image", "panorama"].includes(a.type)) {
      const m = await sharp(bytes, { limitInputPixels: 4_000_000 }).metadata();
      if (
        m.width !== a.width ||
        m.height !== a.height ||
        m.exif ||
        m.xmp ||
        m.iptc
      )
        throw Error("SHOWCASE_IMAGE_OR_PRIVACY");
    } else if (a.type === "video") {
      const p = JSON.parse(
        (
          await run(
            "ffprobe",
            [
              "-v",
              "error",
              "-show_streams",
              "-show_format",
              "-of",
              "json",
              path,
            ],
            { timeout: 10000, maxBuffer: 262144 },
          )
        ).stdout,
      );
      if (
        p.streams.length !== 1 ||
        p.streams[0].codec_name !== "h264" ||
        p.streams[0].width !== a.width ||
        p.streams[0].height !== a.height ||
        Math.abs(Number(p.format.duration) - a.durationSeconds!) > 0.001 ||
        p.streams[0].pix_fmt !== "yuv420p" ||
        p.format.tags?.location ||
        p.format.tags?.comment ||
        p.format.tags?.title
      )
        throw Error("SHOWCASE_VIDEO_METADATA");
      await run(
        "ffmpeg",
        [
          "-v",
          "error",
          "-nostdin",
          "-threads",
          "1",
          "-xerror",
          "-i",
          path,
          "-an",
          "-f",
          "null",
          "-",
        ],
        { timeout: 15000, maxBuffer: 262144 },
      );
    } else if (bytes.toString("ascii", 0, 4) !== "glTF")
      throw Error("SHOWCASE_MODEL_INVALID");
  }
  const actual = await readdir(join(root, "public/showcase-v55"));
  if (actual.length !== files.size || actual.some((n) => !files.has(n)))
    throw Error("UNREVIEWED_SHOWCASE_FILE");
  // Recompute the genuine image transformation; a CSS recolor, unrelated photo or reframing cannot pass.
  const source = registry.assets.find(
    (a) => a.id === registry.comparison.sourceId,
  )!;
  const after = registry.assets.find(
    (a) => a.id === registry.comparison.afterId,
  )!;
  const expected = await sharp(await readFile(join(root, "public", source.url)))
    .normalise({ lower: 1, upper: 99 })
    .sharpen({ sigma: 0.8, m1: 0.5, m2: 1 })
    .webp({ quality: 90 })
    .toBuffer();
  if (hash(expected) !== after.sha256)
    throw Error("COMPARISON_DERIVATION_DRIFT");
  return {
    registry,
    files: actual.length,
    externalSpendUsd: 0,
    realProviderCalls: 0,
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/verify-showcase.ts")
) {
  const r = await verifyShowcase();
  console.log(
    JSON.stringify({
      result: "PASS",
      assets: r.registry.assets.length,
      decodedVideos: r.registry.samples.length,
      panoramas: 1,
      externalSpendUsd: 0,
    }),
  );
}
