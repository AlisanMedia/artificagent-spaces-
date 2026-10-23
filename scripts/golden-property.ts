/** Fixed local-only CAD → Blender → real media; no provider or hosted service. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  validateGoldenSource,
  goldenFidelity,
  cameraSeesWindow,
} from "../src/domain/golden-property";
import { REVIEW_DIMENSIONS } from "../src/domain/video-quality";
import { PlatformRuntime } from "../src/server/runtime";
import { isolatedWorkerEnvironment } from "../src/server/media";
const run = promisify(execFile),
  sha = (b: Uint8Array | string) =>
    createHash("sha256").update(b).digest("hex");
const bytes = await readFile("fixtures/golden-v5/source.json");
if (
  sha(bytes) !==
  "ff04bf1b34623655d6c7161c616ee63abb632fe4db90279b50d67ce0a9364731"
)
  throw Error("GOLDEN_SOURCE_DRIFT");
const source = validateGoldenSource(JSON.parse(bytes.toString())),
  out = join(process.cwd(), "public/golden-v5");
async function verifyExisting() {
  const record = JSON.parse(
    await readFile(join(out, "evidence.json"), "utf8"),
  ) as {
    sourceSha256: string;
    generatorSha256: string;
    files: { file: string; sha256: string; bytes: number }[];
  };
  if (record.sourceSha256 !== sha(bytes)) throw Error("GOLDEN_SOURCE_DRIFT");
  if (
    record.generatorSha256 !== sha(await readFile("scripts/golden-property.py"))
  )
    throw Error("GOLDEN_GENERATOR_DRIFT");
  for (const f of record.files) {
    if (!/^[a-z0-9-]+\.(glb|png|svg|json|mp4)$/.test(f.file))
      throw Error("GOLDEN_FILE_PATH");
    const b = await readFile(join(out, f.file));
    if (sha(b) !== f.sha256 || b.length !== f.bytes)
      throw Error("GOLDEN_FILE_DRIFT");
  }
  console.log(
    JSON.stringify({
      result: "PASS",
      files: record.files.length,
      sourceSha256: record.sourceSha256,
      externalSpendMicroUsd: 0,
    }),
  );
}
if (process.argv.includes("--verify")) {
  await verifyExisting();
  process.exit(0);
}
try {
  await readFile(join(out, "evidence.json"));
  await verifyExisting();
  process.exit(0);
} catch (e) {
  if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
}
await mkdir(out, { recursive: true });
const privateRoot = await mkdtemp(join(tmpdir(), "spaces-golden-v5-"));
const native = join(privateRoot, "native");
await mkdir(native);
const started = performance.now();
await run(
  "prlimit",
  [
    "--as=4294967296",
    "--cpu=175",
    "--",
    "blender",
    "--background",
    "--factory-startup",
    "--disable-autoexec",
    "--python-exit-code",
    "1",
    "--python",
    "scripts/golden-property.py",
    "--",
    "--source",
    "fixtures/golden-v5/source.json",
    "--output",
    native,
  ],
  { timeout: 200000, maxBuffer: 2_000_000, env: isolatedWorkerEnvironment() },
);
const files: { file: string; sha256: string; bytes: number }[] = [];
async function publish(name: string, b: Uint8Array | string) {
  const data = typeof b === "string" ? Buffer.from(b) : b;
  await writeFile(join(out, name), data, { flag: "wx" });
  files.push({ file: name, sha256: sha(data), bytes: data.length });
}
const rawRenderHashes: Record<string, string> = {};
for (const n of [
  "property.glb",
  ...source.scene.rooms.map((r) => r.id + ".png"),
  "blender-observations.json",
]) {
  const b = await readFile(join(native, n));
  if (n.endsWith(".png")) {
    rawRenderHashes[n] = sha(b);
    await publish(
      n,
      await sharp(b, { limitInputPixels: 240000 }).png().toBuffer(),
    );
  } else await publish(n, b);
}
const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const roomSvg = source.scene.rooms
  .map(
    (r) =>
      `<g><rect x="${r.x}" y="${r.z}" width="${r.width}" height="${r.depth}" fill="#d5d0c4" stroke="#202b24" stroke-width=".07"/><text x="${r.x + r.width / 2}" y="${r.z + r.depth / 2 - 0.12}" text-anchor="middle" font-size=".27">${esc(r.label)}</text><text x="${r.x + r.width / 2}" y="${r.z + r.depth / 2 + 0.25}" text-anchor="middle" font-size=".23">${r.width} × ${r.depth} m</text></g>`,
  )
  .join("");
const apertures = [
  ...source.scene.doors.map((d) => ({ ...d, color: "#126b4d" })),
  ...source.windows.map((w) => ({ ...w, color: "#2078a0" })),
]
  .map(
    (d) =>
      `<line x1="${d.axis === "x" ? d.at : d.center - d.width / 2}" y1="${d.axis === "x" ? d.center - d.width / 2 : d.at}" x2="${d.axis === "x" ? d.at : d.center + d.width / 2}" y2="${d.axis === "x" ? d.center + d.width / 2 : d.at}" stroke="${d.color}" stroke-width=".13"/>`,
  )
  .join("");
await publish(
  "floor-plan.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.6 -.5 12.2 9.3" role="img" aria-label="Golden V5 sentetik metrik plan; yeşil kapı, mavi pencere"><rect x="-1.6" y="-.5" width="12.2" height="9.3" fill="#f4f2ed"/><g font-family="sans-serif" fill="#101214">${roomSvg}${apertures}<text x="-.9" y="8.5" font-size=".22">Sentetik tasarım · 1 birim = 1 m · tavan yüksekliği 2.8 m</text></g></svg>`,
);
const rt = await PlatformRuntime.create(join(privateRoot, "data"), true, false);
const clips: unknown[] = [];
try {
  const actor = await rt.db.actor("demo-admin-a", "studio");
  const property = await rt.properties.create(
    actor,
    { title: "Golden V5 • Sentetik mimari örnek", syntheticOnly: true },
    "golden-v5",
  );
  const revised = await rt.properties.revise(
    actor,
    property.id,
    property.revision,
    { manifest: source.scene },
  );
  const assets = [];
  for (const id of ["entrance", "living", "kitchen", "bedroom"]) {
    const a = await rt.properties.upload(
      actor,
      property.id,
      await readFile(join(out, id + ".png")),
      "photo",
      {
        syntheticOnly: true,
        ownedOrLicensed: true,
        metadataRemovalAccepted: true,
      },
    );
    assets.push({
      roomId: id,
      id: a.id,
      normalizedSha256: a.cleanHash,
      renderSha256: files.find((f) => f.file === id + ".png")!.sha256,
    });
  }
  for (const mode of ["pov", "cinematic", "hybrid"] as const)
    for (const aspect of ["16:9", "9:16"] as const) {
      const job = await rt.jobs.submit(actor, {
        propertyId: property.id,
        revision: revised.revision,
        mode,
        aspectRatio: aspect,
        durationSeconds: 4,
        idempotencyKey: `golden-${mode}-${aspect}`,
        captions: true,
        sourceAssetIds: assets.map((a) => a.id),
      });
      await rt.jobs.processNext();
      const done = await rt.jobs.get(actor, job.id);
      if (done.state !== "awaiting-review" || !done.output)
        throw Error(done.error_code ?? "GOLDEN_MEDIA_FAILED");
      const n = `${mode}-${aspect === "16:9" ? "landscape" : "portrait"}.mp4`;
      await publish(
        n,
        await rt.storage.readVerified(
          actor.organizationId,
          done.output.artifactId!,
          done.output.sha256,
          "output",
          "mp4",
        ),
      );
      const probe = await run(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration:stream=codec_name,width,height,pix_fmt,color_space,codec_type",
          "-of",
          "json",
          join(out, n),
        ],
        { timeout: 10000, env: isolatedWorkerEnvironment() },
      );
      await run(
        "ffmpeg",
        [
          "-v",
          "error",
          "-xerror",
          "-threads",
          "1",
          "-i",
          join(out, n),
          "-f",
          "null",
          "-",
        ],
        { timeout: 15000, env: isolatedWorkerEnvironment() },
      );
      clips.push({
        file: n,
        mode,
        aspect,
        sourceSha256: sha(bytes),
        manifestRevision: revised.revision,
        sourceImages: assets,
        output: done.output,
        ffprobe: JSON.parse(probe.stdout),
        fullDecodeExit: 0,
        release: "AWAITING_DIFFERENT_HUMAN_REVIEW",
        publicUse:
          "OWNER_AUTHORIZED_SYNTHETIC_FIXTURE_NOT_A_TENANT_PUBLICATION",
      });
    }
} finally {
  await rt.db.close();
  await rm(privateRoot, { recursive: true, force: true });
}
await publish(
  "scene-manifest.json",
  JSON.stringify(source.scene, null, 2) + "\n",
);
const evidence = {
  version: 1,
  sourceSha256: sha(bytes),
  generatorSha256: sha(await readFile("scripts/golden-property.py")),
  rawRenderHashes,
  sourceClass: "AUTHORED_SYNTHETIC_CAD_NOT_REAL_RECONSTRUCTION",
  files,
  clips,
  geometricFidelity: goldenFidelity(source, source.scene, source.windows, []),
  cameraVisibility: source.cameras.flatMap((c) =>
    source.windows.map((w) => ({
      cameraId: c.id,
      windowId: w.id,
      visibleWithinSameRoomFov: cameraSeesWindow(source, c.id, w.id),
    })),
  ),
  wallTimeMs: Math.round(performance.now() - started),
  actualExternalSpendMicroUsd: 0,
  humanAccepted: 0,
  photographicRealism: "NOT_VERIFIED",
};
await writeFile(
  join(out, "evidence.json"),
  JSON.stringify(evidence, null, 2) + "\n",
  { flag: "wx" },
);
await mkdir("artifacts/golden-v5", { recursive: true });
const shuffled = [...files.filter((f) => f.file.endsWith(".mp4"))].sort(
  (a, b) => sha("51" + a.sha256).localeCompare(sha("51" + b.sha256)),
);
await writeFile(
  "artifacts/golden-v5/coordinator-map.json",
  JSON.stringify(
    shuffled.map((f, i) => ({
      blindId: `sample-${String(i + 1).padStart(2, "0")}`,
      file: f.file,
      sha256: f.sha256,
    })),
    null,
    2,
  ) + "\n",
);
await writeFile(
  "artifacts/golden-v5/blind-scorecards.json",
  JSON.stringify(
    {
      version: 1,
      sourceSha256: sha(bytes),
      modelInferenceExecuted: false,
      coordinatorMappingSuppliedToReviewers: false,
      outputs: shuffled.map((f, i) => ({
        blindId: `sample-${String(i + 1).padStart(2, "0")}`,
        artifactSha256: f.sha256,
        reviewers: [0, 1].map(() => ({
          reviewer: null,
          scores: Object.fromEntries(REVIEW_DIMENSIONS.map((k) => [k, null])),
          criticalFabricatedArchitecture: null,
        })),
        decision: "AWAITING_INDEPENDENT_HUMAN_REVIEW",
      })),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    result: "CREATED",
    files: files.length,
    clips: clips.length,
    rooms: source.scene.rooms.length,
    wallTimeMs: evidence.wallTimeMs,
    externalSpendMicroUsd: 0,
    humanAccepted: 0,
  }),
);
