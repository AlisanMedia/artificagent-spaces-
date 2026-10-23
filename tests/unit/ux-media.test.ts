// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PlatformRuntime } from "@/server/runtime";
import { UploadSelection, validateMp4Magic } from "@/domain/media-intake";
import { sanitizeVideo } from "@/server/video-ingestion";
import type { Actor } from "@/server/database";
const run = promisify(execFile),
  rights = {
    syntheticOnly: true,
    ownedOrLicensed: true,
    metadataRemovalAccepted: true,
  };
let root: string, rt: PlatformRuntime, actor: Actor, video: Buffer;
async function fixture(
  name: string,
  codec = "libx264",
  seconds = 1,
  size = "320x180",
) {
  const path = join(root, name);
  await run(
    "ffmpeg",
    [
      "-v",
      "error",
      "-nostdin",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `testsrc2=size=${size}:rate=24`,
      "-t",
      String(seconds),
      "-c:v",
      codec,
      "-threads",
      "1",
      "-pix_fmt",
      "yuv420p",
      "-metadata",
      "location=+40.0000+029.0000/",
      "-metadata",
      "comment=synthetic-private-metadata",
      "-movflags",
      "+faststart",
      path,
    ],
    { timeout: 15000 },
  );
  return readFile(path);
}
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "spaces-ux-media-"));
  rt = await PlatformRuntime.create(root, true);
  actor = await rt.db.actor("demo-admin-a", "studio");
  video = await fixture("fixture.mp4");
}, 30000);
afterAll(async () => {
  await rt.db.close();
  await rm(root, { recursive: true, force: true });
});
describe("UX first video intake and immutable media editing", () => {
  it("refuses unsupported formats, deceptive filename/MIME and oversized intake metadata", () => {
    for (const v of [
      { filename: "tour.mov", mime: "video/mp4", byteLength: 100 },
      { filename: "../tour.mp4", mime: "video/mp4", byteLength: 100 },
      { filename: "x.webm", mime: "video/webm", byteLength: 100 },
      { filename: "x.png", mime: "image/png", byteLength: 6_000_000 },
      { filename: "x.mp4", mime: "video/mp4", byteLength: 22_000_000 },
    ])
      expect(UploadSelection.safeParse({ ...v, revision: 1 }).success).toBe(
        false,
      );
    expect(() =>
      validateMp4Magic(Buffer.from("not a media container")),
    ).toThrow();
    expect(
      UploadSelection.safeParse({
        filename: "sentetik.mp4",
        mime: "video/mp4",
        byteLength: video.length,
        revision: 1,
      }).success,
    ).toBe(true);
  });
  it("normalizes real MP4 privately, strips location/comments/audio, and cleans temporary originals", async () => {
    const p = await rt.properties.create(actor, {
      title: "Yalnız sentetik video",
      syntheticOnly: true,
    });
    const asset = await rt.properties.upload(
      actor,
      p.id,
      video,
      "walkthrough",
      rights,
      undefined,
      { revision: 1, mime: "video/mp4" },
    );
    const stored = rt.storage.path(
      actor.organizationId,
      asset.id,
      "source",
      "mp4",
    );
    expect((await stat(stored)).mode & 0o777).toBe(0o600);
    const check = JSON.parse(
      (
        await run("ffprobe", [
          "-v",
          "error",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          stored,
        ])
      ).stdout,
    );
    expect(check.streams).toHaveLength(1);
    expect(check.streams[0].codec_name).toBe("h264");
    expect(JSON.stringify(check)).not.toContain("synthetic-private-metadata");
    expect(check.format.tags).not.toHaveProperty("location");
    expect(check.format.tags).not.toHaveProperty("location-eng");
    expect(check.format.tags).not.toHaveProperty("comment");
    expect(
      (await readdir(rt.storage.root)).some((n) =>
        n.startsWith("video-quarantine-"),
      ),
    ).toBe(false);
    const logo = (await rt.properties.assets(actor, "property-a")).find(
      (a) => a.kind === "photo",
    )!;
    await rt.brands.save(actor, {
      displayName: "Sentetik Yeşil Emlak",
      accent: "#126b4d",
      language: "tr",
      logoAssetId: logo.id,
    });
    const job = await rt.jobs.submit(actor, {
      propertyId: p.id,
      revision: 1,
      mode: "cinematic",
      aspectRatio: "9:16",
      durationSeconds: 4,
      sourceAssetIds: [asset.id],
      idempotencyKey: "ux-real-video-only",
      branding: true,
      captions: false,
    });
    await rt.jobs.processNext();
    const result = await rt.jobs.get(actor, job.id);
    expect(result.state, result.error_code ?? "video render").toBe(
      "awaiting-review",
    );
    expect(result.output).toMatchObject({
      mime: "video/mp4",
      codec: "h264",
      width: 360,
      height: 640,
      actualExternalCostMicroUsd: 0,
    });
    await expect(rt.releases.outputGrant(actor, job.id)).rejects.toMatchObject({
      code: "APPROVED_CURRENT_OUTPUT_REQUIRED",
    });
  }, 30000);
  it("edits order/removal in a new immutable revision and rejects cross-property media/stale edits", async () => {
    const assets = await rt.properties.assets(actor, "property-a");
    const before = await rt.properties.get(actor, "property-a");
    const order = assets.map((a) => a.id).reverse();
    const next = await rt.properties.reorderMedia(
      actor,
      "property-a",
      before.revision,
      order,
    );
    expect(
      (await rt.properties.assets(actor, "property-a")).map((a) => a.id),
    ).toEqual(order);
    const historic = await rt.db.pg.query(
      "select * from property_media_revisions where organization_id='studio' and property_id='property-a' and revision=$1",
      [before.revision],
    );
    expect(historic.rows).toHaveLength(2);
    await expect(
      rt.properties.reorderMedia(actor, "property-a", before.revision, order),
    ).rejects.toMatchObject({ code: "STALE_REVISION" });
    await expect(
      rt.properties.reorderMedia(actor, "property-a", next.revision, [
        "foreign-media",
      ]),
    ).rejects.toMatchObject({ code: "MEDIA_SCOPE_DENIED" });
    await rt.properties.reorderMedia(actor, "property-a", next.revision, [
      order[0]!,
    ]);
    expect(await rt.properties.assets(actor, "property-a")).toHaveLength(1);
    const viewer = await rt.db.actor("demo-viewer-a", "studio");
    await expect(
      rt.properties.reorderMedia(viewer, "property-a", next.revision + 1, []),
    ).rejects.toMatchObject({ code: "ROLE_DENIED" });
  });
  it("atomically replaces media, freezes job sources and forks additions after submission", async () => {
    const p = await rt.properties.create(actor, {
      title: "Sürüm kaynak sınırı",
      syntheticOnly: true,
    });
    const first = await rt.properties.upload(
      actor,
      p.id,
      video,
      "walkthrough",
      rights,
    );
    const replaced = await rt.properties.upload(
      actor,
      p.id,
      video,
      "walkthrough",
      rights,
      undefined,
      { revision: 1, replaceAssetId: first.id },
    );
    expect((await rt.properties.get(actor, p.id)).revision).toBe(2);
    expect((await rt.properties.assets(actor, p.id)).map((a) => a.id)).toEqual([
      replaced.id,
    ]);
    const job = await rt.jobs.submit(actor, {
      propertyId: p.id,
      revision: 2,
      mode: "pov",
      durationSeconds: 4,
      idempotencyKey: "frozen-media-v3",
    });
    await expect(
      rt.db.as(actor, (tx) =>
        tx.query("insert into property_media_revisions values($1,$2,2,$3,1)", [
          actor.organizationId,
          p.id,
          first.id,
        ]),
      ),
    ).rejects.toThrow(/MEDIA_REVISION_FROZEN/);
    await rt.properties.upload(
      actor,
      p.id,
      video,
      "walkthrough",
      rights,
      undefined,
      { revision: 2 },
    );
    expect((await rt.properties.get(actor, p.id)).revision).toBe(3);
    expect(await rt.properties.assets(actor, p.id)).toHaveLength(2);
    expect((await rt.jobs.get(actor, job.id)).source_snapshot).toMatchObject([
      { id: replaced.id },
    ]);
  }, 30000);
  it("rejects real unsupported codecs, excessive duration/dimensions, fake magic, and expired revision", async () => {
    for (const [name, codec, seconds, size, code] of [
      ["mpeg.mp4", "mpeg4", 1, "320x180", "UNSUPPORTED_VIDEO_CODEC"],
      ["long.mp4", "libx264", 31, "64x64", "VIDEO_DURATION_LIMIT"],
      ["wide.mp4", "libx264", 1, "2048x64", "VIDEO_DIMENSION_LIMIT"],
    ] as const) {
      const bytes = await fixture(name, codec, seconds, size);
      await expect(sanitizeVideo(rt.storage.root, bytes)).rejects.toMatchObject(
        { code },
      );
    }
    const qt = Buffer.from(video);
    qt.write("qt  ", 8, "ascii");
    await expect(sanitizeVideo(rt.storage.root, qt)).rejects.toMatchObject({
      code: "UNSUPPORTED_VIDEO_CONTAINER",
    });
    await expect(
      rt.properties.upload(
        actor,
        "property-a",
        video,
        "walkthrough",
        rights,
        undefined,
        { revision: 1, mime: "video/mp4" },
      ),
    ).rejects.toMatchObject({ code: "STALE_REVISION" });
  }, 30000);
  it("cancels decoder work and removes private temporary files without a publishable source", async () => {
    const c = new AbortController();
    const operation = sanitizeVideo(rt.storage.root, video, c.signal);
    setTimeout(() => c.abort(), 10);
    await expect(operation).rejects.toMatchObject({ code: "UPLOAD_CANCELLED" });
    expect(
      (await readdir(rt.storage.root)).some((n) =>
        n.startsWith("video-quarantine-"),
      ),
    ).toBe(false);
  });
});
