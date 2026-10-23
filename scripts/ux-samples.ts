/** Rights-cleared deterministic previews. No vendor, external credential or customer input. */
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { PlatformRuntime } from "../src/server/runtime";
const root = await mkdtemp(join(tmpdir(), "spaces-ux-previews-"));
const rt = await PlatformRuntime.create(root, true, false);
try {
  const out = join(process.cwd(), ".spaces-local/ux-demo");
  await mkdir(out, { recursive: true, mode: 0o700 });
  const admin = await rt.db.actor("demo-admin-a", "studio"),
    reviewer = await rt.db.actor("demo-reviewer-a", "studio");
  const p = await rt.properties.create(admin, {
    title: "V3 özgün sentetik örnek",
    syntheticOnly: true,
  });
  const bytes = await sharp(
    await readFile("public/spaces-examples/interior.svg"),
  )
    .png()
    .toBuffer();
  await rt.properties.upload(admin, p.id, bytes, "photo", {
    syntheticOnly: true,
    ownedOrLicensed: true,
    metadataRemovalAccepted: true,
  });
  const results = [];
  for (const [mode, name, template] of [
    ["pov", "natural", "modern"],
    ["cinematic", "cinematic", "luxury"],
    ["hybrid", "hybrid", "warm"],
  ] as const) {
    const job = await rt.jobs.submit(admin, {
      propertyId: p.id,
      revision: 1,
      mode,
      template,
      durationSeconds: 4,
      aspectRatio: "16:9",
      idempotencyKey: "ux-preview-" + mode,
    });
    await rt.jobs.processNext();
    const done = await rt.jobs.get(admin, job.id);
    if (done.state !== "awaiting-review" || !done.output)
      throw new Error(done.error_code ?? "PREVIEW_FAILED");
    await rt.releases.review(reviewer, job.id, {
      decision: "approved",
      rights: true,
      evidence: true,
      continuity: true,
      disclosure: true,
    });
    const video = await rt.storage.readVerified(
      admin.organizationId,
      done.output.artifactId!,
      done.output.sha256,
      "output",
      "mp4",
    );
    await writeFile(join(out, name + ".mp4"), video, { mode: 0o600 });
    results.push({
      filename: name + ".mp4",
      mode,
      template,
      sha256: done.output.sha256,
      width: done.output.width,
      height: done.output.height,
      durationSeconds: done.output.durationSeconds,
      codec: done.output.codec,
      wallTimeMs: done.output.wallTimeMs,
      bytes: done.output.bytes,
      externalCostMicroUsd: 0,
    });
  }
  await writeFile(
    join(out, "measurements.json"),
    JSON.stringify(
      {
        syntheticOnly: true,
        actualProviderCalls: 0,
        review:
          "Second local synthetic identity; not a real human or GitHub review",
        outputs: results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ outputs: results, externalSpendUsd: 0 }));
} finally {
  await rt.db.close();
  await rm(root, { recursive: true, force: true });
}
