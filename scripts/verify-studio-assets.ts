/** Reviewed static data only: no decoder/plugin install, network, customer input or arbitrary file paths. */
import { readFile, readdir, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import sharp from "sharp";
import { z } from "zod";
const hex = z.string().regex(/^[a-f0-9]{64}$/);
const File = z
  .object({
    file: z.string().regex(/^[a-z0-9-]+\.(woff2|txt|webp)$/),
    sha256: hex,
    bytes: z.number().int().positive().max(200000),
    kind: z.enum(["FONT", "LICENSE", "VIDEO_POSTER"]),
    license: z.literal("OFL-1.1").optional(),
    sourcePackage: z.string().optional(),
    version: z.literal("5.3.0").optional(),
    sourceIntegrity: z.string().optional(),
    sourceUrl: z.string().optional(),
    subset: z.enum(["latin", "latin-ext"]).optional(),
    rights: z.literal("PROJECT_AUTHORED_SYNTHETIC").optional(),
    sourceVideo: z.string().optional(),
    sourceSha256: hex.optional(),
    frameSeconds: z.number().finite().nonnegative().max(4).optional(),
    decodedFrameSha256: hex.optional(),
    width: z.number().int().positive().max(640).optional(),
    height: z.number().int().positive().max(640).optional(),
    resizeOrGenerativeEnhancement: z.literal(false).optional(),
  })
  .strict();
const Manifest = z
  .object({
    schemaVersion: z.literal(1),
    createdAt: z.string(),
    baseSourceSha: z.literal("2213b37c0b68813ebc6dcdb1d2cc4d1f671eaaa8"),
    externalSpendMicroUsd: z.literal(0),
    remoteRuntimeDependencies: z.literal(false),
    fonts: z
      .array(
        z
          .object({
            family: z.enum(["Manrope", "Newsreader"]),
            style: z.enum(["normal", "italic"]),
            weightRange: z.tuple([z.literal(200), z.literal(800)]),
            files: z.array(z.string()).length(2),
            turkishCharacters: z.literal("şğçıİöüçŞĞÇÖÜ"),
            coverageVerified: z.literal(true),
            method: z.literal(
              "local fc-query / FreeType actual WOFF2 cmap, union latin+latin-ext",
            ),
            glyphCodepoints: z
              .array(z.number().int().nonnegative().max(0x10ffff))
              .max(4096),
          })
          .strict(),
      )
      .length(2),
    files: z.array(File).length(15),
  })
  .strict();
const approved = [
  ...[
    "manrope-latin-wght-normal.woff2",
    "manrope-latin-ext-wght-normal.woff2",
    "newsreader-latin-wght-italic.woff2",
    "newsreader-latin-ext-wght-italic.woff2",
    "ofl-manrope.txt",
    "ofl-newsreader.txt",
  ],
  ...["pov", "cinematic", "hybrid"].flatMap((m) => [
    `${m}-portrait.webp`,
    `${m}-landscape.webp`,
    `style-${m}.webp`,
  ]),
];
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
export async function verifyStudioAssets(
  root = process.cwd(),
  folder = join(root, "public/studio-assets-v52"),
) {
  if ((await lstat(folder)).isSymbolicLink())
    throw Error("VISUAL_ASSET_SYMLINK");
  const manifest = Manifest.parse(
    JSON.parse(await readFile(join(folder, "manifest.json"), "utf8")),
  );
  const actual = await readdir(folder),
    expected = [...approved, "manifest.json"];
  if (
    actual.length !== expected.length ||
    actual.some((n) => !expected.includes(n)) ||
    new Set(manifest.files.map((f) => f.file)).size !== 15 ||
    manifest.files.some((f) => !approved.includes(f.file))
  )
    throw Error("UNREVIEWED_VISUAL_ASSET");
  for (const f of manifest.files) {
    const path = join(folder, f.file);
    if (!(await lstat(path)).isFile()) throw Error("VISUAL_ASSET_FILE_ONLY");
    const b = await readFile(path);
    if (hash(b) !== f.sha256 || b.length !== f.bytes)
      throw Error("VISUAL_ASSET_HASH_DRIFT");
    if (f.kind === "FONT") {
      if (
        !f.file.endsWith(".woff2") ||
        f.license !== "OFL-1.1" ||
        b.toString("ascii", 0, 4) !== "wOF2" ||
        b.readUInt32BE(8) !== b.length ||
        !f.sourceUrl?.startsWith(
          "https://registry.npmjs.org/@fontsource-variable/",
        ) ||
        !f.sourceIntegrity?.startsWith("sha512-")
      )
        throw Error("UNVERIFIED_FONT");
    } else if (f.kind === "LICENSE") {
      if (
        !f.file.endsWith(".txt") ||
        !b.toString().includes("SIL OPEN FONT LICENSE")
      )
        throw Error("FONT_LICENSE_MISSING");
    } else {
      if (
        !f.sourceVideo ||
        f.rights !== "PROJECT_AUTHORED_SYNTHETIC" ||
        !/^public\/(?:golden-v5\/(?:pov|cinematic|hybrid)-(?:landscape|portrait)|spaces-examples\/(?:natural|cinematic|hybrid))\.mp4$/.test(
          f.sourceVideo,
        ) ||
        f.resizeOrGenerativeEnhancement !== false
      )
        throw Error("POSTER_SOURCE_NOT_APPROVED");
      if (hash(await readFile(join(root, f.sourceVideo))) !== f.sourceSha256)
        throw Error("POSTER_SOURCE_DRIFT");
      const m = await sharp(b, { limitInputPixels: 1000000 }).metadata();
      if (
        m.format !== "webp" ||
        m.width !== f.width ||
        m.height !== f.height ||
        m.exif ||
        m.xmp
      )
        throw Error("POSTER_FORMAT_OR_METADATA");
    }
  }
  const fontBytes = manifest.files
    .filter((f) => f.kind === "FONT")
    .reduce((n, f) => n + f.bytes, 0);
  if (
    fontBytes > 163840 ||
    manifest.files.reduce((n, f) => n + f.bytes, 0) > 524288
  )
    throw Error("VISUAL_ASSET_BUDGET");
  for (const font of manifest.fonts)
    if (
      !Array.from(font.turkishCharacters).every((c) =>
        font.glyphCodepoints.includes(c.codePointAt(0)!),
      )
    )
      throw Error("TURKISH_GLYPH_MISSING");
  return {
    manifest,
    fontBytes,
    posters: manifest.files.filter((f) => f.kind === "VIDEO_POSTER").length,
  };
}
if (process.argv[1]?.endsWith("/verify-studio-assets.ts")) {
  const v = await verifyStudioAssets();
  console.log(
    JSON.stringify({
      result: "PASS",
      files: v.manifest.files.length,
      fontBytes: v.fontBytes,
      posters: v.posters,
      externalSpendMicroUsd: 0,
    }),
  );
}
