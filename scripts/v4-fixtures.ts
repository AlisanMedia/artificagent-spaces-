/** Creates ONLY project-authored synthetic golden fixtures; no network or customer media. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { digest } from "../src/server/crypto";
import { isolatedWorkerEnvironment } from "../src/server/media";
const run = promisify(execFile),
  root = join(process.cwd(), "fixtures/video-quality-v4");
try {
  const manifestBytes = await readFile(join(root, "input-manifest.json"));
  if (
    digest(manifestBytes) !==
    "cd7b74363901023f4702fafa35c103478edf5318e74b0af677fd9d725c55f6eb"
  )
    throw new Error("GOLDEN_MANIFEST_CHANGED");
  const existing = JSON.parse(manifestBytes.toString()) as {
    inputs: { file: string; sha256: string; bytes: number }[];
  };
  for (const f of existing.inputs) {
    const b = await readFile(join(root, f.file));
    if (digest(b) !== f.sha256 || b.length !== f.bytes)
      throw new Error("GOLDEN_INPUT_CHANGED");
  }
  console.log(
    "PASS: existing immutable golden inputs verified; nothing overwritten.",
  );
  process.exit(0);
} catch (e) {
  if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
}
await mkdir(root, { recursive: true });
const svg = await readFile("public/spaces-examples/interior.svg");
for (const [name, bytes] of [
  [
    "photo-a.jpg",
    await sharp(svg)
      .resize(1600, 900, { fit: "cover" })
      .jpeg({ quality: 95 })
      .toBuffer(),
  ],
  [
    "photo-b.webp",
    await sharp(svg)
      .resize(1200, 1600, { fit: "cover" })
      .webp({ quality: 95 })
      .toBuffer(),
  ],
  [
    "unsupported.heic",
    Buffer.from("SYNTHETIC INVALID HEIC SENTINEL; NOT A CUSTOMER FILE"),
  ],
] as const)
  await writeFile(join(root, name), bytes, { flag: "wx" });
await run(
  "ffmpeg",
  [
    "-v",
    "error",
    "-nostdin",
    "-loop",
    "1",
    "-i",
    join(root, "photo-a.jpg"),
    "-t",
    "2",
    "-vf",
    "scale=1600:900,zoompan=z='1+on*0.0015':d=48:s=1280x720:fps=24,format=yuv420p",
    "-an",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    "-preset",
    "fast",
    "-crf",
    "22",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-map_metadata",
    "-1",
    "-movflags",
    "+faststart",
    join(root, "footage.mp4"),
  ],
  { timeout: 30000, maxBuffer: 65536, env: isolatedWorkerEnvironment() },
);
await run(
  "ffmpeg",
  [
    "-v",
    "error",
    "-nostdin",
    "-f",
    "lavfi",
    "-i",
    "color=black:size=640x360:rate=24",
    "-t",
    "4",
    "-an",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    "-pix_fmt",
    "yuv420p",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-map_metadata",
    "-1",
    join(root, "blank-negative.mp4"),
  ],
  { timeout: 15000, maxBuffer: 65536, env: isolatedWorkerEnvironment() },
);
const inputs = [];
for (const name of [
  "photo-a.jpg",
  "photo-b.webp",
  "footage.mp4",
  "unsupported.heic",
  "blank-negative.mp4",
]) {
  const b = await readFile(join(root, name));
  inputs.push({
    file: name,
    sha256: digest(b),
    bytes: b.length,
    rights:
      "Project-authored synthetic illustration/derived FFmpeg footage; no real property; no new legal license grant",
  });
}
await writeFile(
  join(root, "input-manifest.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      version: "golden-v4.1",
      syntheticOnly: true,
      sourceSvgSha256: digest(svg),
      sourceSvg: "public/spaces-examples/interior.svg",
      photoreal: false,
      measuredGeometry: false,
      inputs,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log(JSON.stringify({ created: inputs, externalSpendMicroUsd: 0 }));
