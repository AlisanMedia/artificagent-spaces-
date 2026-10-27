// @vitest-environment node
import { beforeAll, afterAll, it, expect } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { PlatformRuntime } from "@/server/runtime";
import type { Actor } from "@/server/database";
let rt: PlatformRuntime, root: string, actor: Actor, propertyId: string;
const sources: string[] = [];
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "spaces-v54-long-"));
  rt = await PlatformRuntime.create(root, true, false);
  actor = await rt.db.actor("demo-admin-a", "studio");
  const p = await rt.properties.create(actor, {
    title: "Twelve independently authored synthetic frame fixtures",
    syntheticOnly: true,
  });
  propertyId = p.id;
  for (let i = 0; i < 12; i++) {
    const x = 45 + i * 11;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#e8e3d9"/><path d="M0 310L320 230L640 310V400H0Z" fill="#adb5a6"/><rect x="${x}" y="45" width="170" height="155" fill="#5b806c" stroke="#192622" stroke-width="7"/><path d="M${x + 85} 45V200M${x} 122H${x + 170}" stroke="#d7e1d6" stroke-width="5"/><rect x="330" y="${210 + i * 2}" width="${200 - i * 5}" height="75" fill="#776b5a"/><text x="30" y="365" font-size="22" fill="#192622">SYNTHETIC SOURCE ${i + 1} - NOT A REAL HOME</text></svg>`;
    const bytes = await sharp(Buffer.from(svg)).jpeg().toBuffer();
    const a = await rt.properties.upload(
      actor,
      p.id,
      bytes,
      "photo",
      {
        syntheticOnly: true,
        ownedOrLicensed: true,
        metadataRemovalAccepted: true,
      },
      undefined,
      { mime: "image/jpeg", revision: 1 },
    );
    sources.push(a.id);
  }
}, 30000);
afterAll(async () => {
  await rt.db.close();
  await rm(root, { recursive: true, force: true });
});
it.each([30, 45, 60])(
  "validates a nominal %is multi-photo local export with bounded actual files, not a single AI request",
  async (seconds) => {
    const selected = sources.slice(0, seconds / 5);
    const job = await rt.jobs.submit(actor, {
      propertyId,
      revision: 1,
      mode: "pov",
      aspectRatio: seconds === 45 ? "9:16" : "16:9",
      durationSeconds: seconds,
      sourceAssetIds: selected,
      idempotencyKey: `v54-local-long-${seconds}`,
      photoComposition: {
        version: "property-video-v1",
        styleId: "natural",
        requestedDurationSeconds: seconds,
      },
    });
    await rt.jobs.processNext();
    const result = await rt.jobs.get(actor, job.id);
    expect(result.state, result.error_code ?? "composition result").toBe(
      "awaiting-review",
    );
    const output = result.output!;
    expect(output.photoComposition!.clips).toHaveLength(seconds / 5);
    expect(Math.abs(output.durationSeconds! - seconds)).toBeLessThanOrEqual(
      1 / 24 + 0.002,
    );
    expect(output.codec).toBe("h264");
    expect(output.actualExternalCostMicroUsd).toBe(0);
    expect(output.width).toBe(seconds === 45 ? 360 : 640);
    expect(output.height).toBe(seconds === 45 ? 640 : 360);
    expect(output.bytes + output.auxiliaryBytes!).toBeLessThanOrEqual(
      52_428_800,
    );
    await expect(rt.releases.outputGrant(actor, job.id)).rejects.toMatchObject({
      code: "APPROVED_CURRENT_OUTPUT_REQUIRED",
    });
    const dir = ".spaces-local/v54/verified-composition";
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await copyFile(
      rt.storage.path("studio", output.artifactId!, "output", "mp4"),
      join(dir, `synthetic-${seconds}s.mp4`),
    );
    await writeFile(
      join(dir, `synthetic-${seconds}s-measurements.json`),
      JSON.stringify(
        {
          syntheticOnly: true,
          qaHeldNotCustomerRelease: true,
          actualProvider: "local-ffmpeg",
          native1080p: false,
          requestedSeconds: seconds,
          actualSeconds: output.durationSeconds,
          width: output.width,
          height: output.height,
          sha256: output.sha256,
          bytes: output.bytes,
          auxiliaryBytes: output.auxiliaryBytes,
          wallTimeMs: output.wallTimeMs,
          clips: output.photoComposition!.clips.map((c) => ({
            order: c.order,
            sha256: c.sha256,
            sourceSha256: c.sourceSha256,
            durationSeconds: c.durationSeconds,
            bytes: c.bytes,
          })),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  },
  120000,
);
