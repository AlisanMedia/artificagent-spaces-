// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  mkdir,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { PlatformRuntime } from "@/server/runtime";
import { prepareStudioPlan } from "@/server/studio-planner";
import { discardFencedComposition } from "@/server/video-composition";
import type { Actor } from "@/server/database";
import type { OutputEvidence } from "@/contracts/platform-ports";
import { runCompositionTool } from "@/server/media";

const run = promisify(execFile),
  rights = {
    syntheticOnly: true,
    ownedOrLicensed: true,
    metadataRemovalAccepted: true,
  };
let root: string,
  rt: PlatformRuntime,
  actor: Actor,
  reviewer: Actor,
  propertyId: string,
  sourceIds: string[],
  output: OutputEvidence,
  jobId: string;
const approve = {
  decision: "approved",
  rights: true,
  evidence: true,
  continuity: true,
  disclosure: true,
};
async function photoProperty(title: string) {
  const p = await rt.properties.create(actor, { title, syntheticOnly: true });
  const a = await rt.properties.upload(
    actor,
    p.id,
    await readFile("fixtures/video-quality-v4/photo-a.jpg"),
    "photo",
    rights,
    undefined,
    { revision: 1, mime: "image/jpeg" },
  );
  const b = await rt.properties.upload(
    actor,
    p.id,
    await readFile("fixtures/video-quality-v4/photo-b.webp"),
    "photo",
    rights,
    undefined,
    { revision: 1, mime: "image/webp" },
  );
  return { id: p.id, ids: [a.id, b.id] };
}
const command = (id: string, ids: string[], key: string) => ({
  propertyId: id,
  revision: 1,
  mode: "cinematic",
  aspectRatio: "16:9",
  durationSeconds: 10,
  sourceAssetIds: ids,
  idempotencyKey: key,
  photoComposition: {
    version: "property-video-v1",
    styleId: "premium",
    requestedDurationSeconds: 30,
  },
});
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "spaces-v54-"));
  rt = await PlatformRuntime.create(root, true, false);
  actor = await rt.db.actor("demo-admin-a", "studio");
  reviewer = await rt.db.actor("demo-reviewer-a", "studio");
  const p = await photoProperty("V5.4 synthetic two-photo property");
  propertyId = p.id;
  sourceIds = p.ids;
}, 30000);
afterAll(async () => {
  await rt.db.close();
  await rm(root, { recursive: true, force: true });
});

describe("actual source-scoped V5.4 MP4 composition and release", () => {
  it("keeps subprocess paths/filters/protocols inside the reviewed CPU worker boundary", () => {
    expect(() =>
      runCompositionTool(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          "/etc/passwd",
        ],
        root,
        1000,
      ),
    ).toThrow("COMPOSITION_FILE_SCOPE_DENIED");
    expect(() =>
      runCompositionTool(
        "ffmpeg",
        ["-i", "https://evil.example/x", "-f", "null", "-"],
        root,
        1000,
      ),
    ).toThrow("COMPOSITION_PROCESS_DENIED");
    expect(() =>
      runCompositionTool(
        "ffmpeg",
        [
          "-i",
          join(root, "file.mp4"),
          "-filter_complex",
          "movie=/etc/passwd",
          join(root, "output.mp4"),
        ],
        root,
        1000,
      ),
    ).toThrow("COMPOSITION_FILTER_DENIED");
    expect(() =>
      runCompositionTool(
        "ffmpeg",
        ["-i", join(root, "file.mp4"), "-filter_script", "/etc/passwd", "-"],
        root,
        1000,
      ),
    ).toThrow("COMPOSITION_PROCESS_DENIED");
  });
  it("plans without reservations and denies viewer, foreign source/property and stale revision", async () => {
    const input = {
      propertyId,
      revision: 1,
      product: "video",
      styleId: "premium",
      requestedDurationSeconds: 30,
      aspectRatio: "16:9",
      sourceAssetIds: sourceIds,
    };
    const before = await rt.db.pg.query("select * from credit_accounts");
    const plan = await prepareStudioPlan(rt.db, rt.properties, actor, input);
    expect(plan).toMatchObject({
      suggestedDurationSeconds: 10,
      sufficientSources: false,
      futurePriceMicroUsd: null,
      liveEnabled: false,
      actualExternalCostMicroUsd: 0,
    });
    expect(JSON.stringify(plan)).not.toContain("bytedance/");
    expect(JSON.stringify(plan)).not.toContain("kling/");
    expect(plan).not.toHaveProperty("provider");
    expect(plan).not.toHaveProperty("prompt");
    expect(
      (await rt.db.pg.query("select * from credit_accounts")).rows,
    ).toEqual(before.rows);
    await expect(
      prepareStudioPlan(
        rt.db,
        rt.properties,
        await rt.db.actor("demo-viewer-a", "studio"),
        input,
      ),
    ).rejects.toMatchObject({ code: "ROLE_DENIED" });
    await expect(
      prepareStudioPlan(
        rt.db,
        rt.properties,
        await rt.db.actor("demo-admin-b", "atelier"),
        input,
      ),
    ).rejects.toMatchObject({ code: "PROPERTY_NOT_FOUND" });
    await expect(
      prepareStudioPlan(rt.db, rt.properties, actor, {
        ...input,
        revision: 99,
      }),
    ).rejects.toMatchObject({ code: "STALE_REVISION" });
    await expect(
      prepareStudioPlan(rt.db, rt.properties, actor, {
        ...input,
        sourceAssetIds: ["foreign-source"],
      }),
    ).rejects.toMatchObject({ code: "MEDIA_SCOPE_DENIED" });
    await expect(
      prepareStudioPlan(rt.db, rt.properties, actor, {
        ...input,
        product: "tour-360",
      }),
    ).rejects.toMatchObject({ code: "PANORAMA_2_TO_1_REQUIRED" });
  });
  it("renders two separate real 5s private clips and one decoded 10s H264 file with exact order/provenance and idempotent reservation", async () => {
    const input = command(propertyId, sourceIds, "v54-real-file-compose");
    const first = await rt.jobs.submit(actor, input),
      same = await rt.jobs.submit(actor, input);
    jobId = first.id;
    expect(same.id).toBe(first.id);
    expect(
      (
        await rt.db.pg.query(
          "select * from credit_reservations where job_id=$1",
          [jobId],
        )
      ).rows,
    ).toHaveLength(1);
    await rt.jobs.processNext();
    const j = await rt.jobs.get(actor, jobId);
    expect(j.state, j.error_code ?? "render failed").toBe("awaiting-review");
    output = j.output!;
    expect(output.qa.disclosure).not.toMatch(
      /\b(?:fal|Kling|Seedance|Marble)\b/i,
    );
    expect(output).toMatchObject({
      codec: "h264",
      width: 640,
      height: 360,
      actualExternalCostMicroUsd: 0,
      photoComposition: {
        version: "property-video-v1",
        actualProvider: "local-ffmpeg",
        plannedProvider: "fal",
        plannedModel: "bytedance/seedance-2.5/us/image-to-video",
        fit: "letterbox",
      },
    });
    // H.264 container duration is quantized to frames; demand at most one 24-fps frame, not the legacy 150ms tolerance.
    expect(Math.abs(output.durationSeconds! - 10)).toBeLessThanOrEqual(
      1 / 24 + 0.002,
    );
    const clips = output.photoComposition!.clips;
    expect(clips).toHaveLength(2);
    expect(clips.map((c) => c.sourceAssetId)).toEqual(sourceIds);
    const measurements = [];
    for (const c of clips) {
      expect(
        (await stat(rt.storage.path("studio", c.artifactId, "output", "mp4")))
          .mode & 0o777,
      ).toBe(0o600);
      await rt.storage.readVerified(
        "studio",
        c.artifactId,
        c.sha256,
        "output",
        "mp4",
      );
      const result = JSON.parse(
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
              rt.storage.path("studio", c.artifactId, "output", "mp4"),
            ],
            { timeout: 10000 },
          )
        ).stdout,
      );
      expect(result.streams).toHaveLength(1);
      expect(result.streams[0].codec_name).toBe("h264");
      expect(Number(result.format.duration)).toBeCloseTo(5, 1);
      for (const key of ["location", "location-eng", "comment", "title"])
        expect(result.format.tags ?? {}).not.toHaveProperty(key);
      measurements.push({
        order: c.order,
        sha256: c.sha256,
        sourceSha256: c.sourceSha256,
        durationSeconds: Number(result.format.duration),
        width: result.streams[0].width,
        height: result.streams[0].height,
        codec: result.streams[0].codec_name,
        bytes: c.bytes,
      });
    }
    const path = rt.storage.path("studio", output.artifactId!, "output", "mp4");
    await run(
      "ffmpeg",
      ["-v", "error", "-xerror", "-nostdin", "-i", path, "-f", "null", "-"],
      { timeout: 15000 },
    );
    const dir = ".spaces-local/v54/verified-composition";
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await copyFile(path, join(dir, "synthetic-10s.mp4"));
    await writeFile(
      join(dir, "measurements.json"),
      JSON.stringify(
        {
          syntheticOnly: true,
          actualProvider: "local-ffmpeg",
          paidInferenceCalls: 0,
          width: output.width,
          height: output.height,
          durationSeconds: output.durationSeconds,
          sha256: output.sha256,
          bytes: output.bytes,
          wallTimeMs: output.wallTimeMs,
          clips: measurements,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  }, 60000);
  it("requires an independent reviewer and exact per-clip source/artifact approvals before download", async () => {
    await expect(rt.releases.outputGrant(actor, jobId)).rejects.toMatchObject({
      code: "APPROVED_CURRENT_OUTPUT_REQUIRED",
    });
    await expect(
      rt.releases.review(actor, jobId, approve),
    ).rejects.toMatchObject({ code: "INDEPENDENT_REVIEW_REQUIRED" });
    await expect(
      rt.releases.review(reviewer, jobId, approve),
    ).rejects.toMatchObject({ code: "ALL_CLIP_REVIEWS_REQUIRED" });
    const approvals = output.photoComposition!.clips.map((c) => ({
      artifactId: c.artifactId,
      sha256: c.sha256,
      sourceSha256: c.sourceSha256,
      decision: "approved",
    }));
    await expect(
      rt.releases.review(reviewer, jobId, {
        ...approve,
        clipApprovals: approvals.slice(0, 1),
      }),
    ).rejects.toMatchObject({ code: "ALL_CLIP_REVIEWS_REQUIRED" });
    await expect(
      rt.releases.review(reviewer, jobId, {
        ...approve,
        clipApprovals: approvals.map((c) => ({
          ...c,
          sourceSha256: "f".repeat(64),
        })),
      }),
    ).rejects.toMatchObject({ code: "ALL_CLIP_REVIEWS_REQUIRED" });
    await rt.releases.review(reviewer, jobId, {
      ...approve,
      clipApprovals: approvals,
    });
    expect((await rt.jobs.get(actor, jobId)).state).toBe("approved");
    expect(await rt.releases.outputGrant(actor, jobId)).toBeTruthy();
    const r = await rt.db.pg.query<{ checks: { clipApprovals: unknown[] } }>(
      "select checks from reviews where job_id=$1",
      [jobId],
    );
    expect(r.rows[0]!.checks.clipApprovals).toHaveLength(2);
    await rt.properties.reorderMedia(
      actor,
      propertyId,
      1,
      [...sourceIds].reverse(),
    );
    await expect(rt.releases.outputGrant(actor, jobId)).rejects.toMatchObject({
      code: "APPROVED_CURRENT_OUTPUT_REQUIRED",
    });
  });
  it("accepts a synthetic equirectangular calibration image only on the distinct 360 plan", async () => {
    const p = await rt.properties.create(actor, {
      title: "Synthetic panorama calibration",
      syntheticOnly: true,
    });
    const bytes = await sharp({
      create: { width: 1600, height: 800, channels: 3, background: "#d9e2dc" },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="1600" height="800"><path d="M0 400H1600M400 0V800M800 0V800M1200 0V800" stroke="#192622" stroke-width="4"/></svg>',
          ),
        },
      ])
      .jpeg()
      .toBuffer();
    const a = await rt.properties.upload(
      actor,
      p.id,
      bytes,
      "panorama",
      rights,
      undefined,
      { mime: "image/jpeg", revision: 1 },
    );
    const input = {
      propertyId: p.id,
      revision: 1,
      product: "tour-360",
      sourceAssetIds: [a.id],
      panoramaConfirmed: true,
    };
    expect(
      await prepareStudioPlan(rt.db, rt.properties, actor, input),
    ).toMatchObject({
      product: "tour-360",
      liveEnabled: false,
      blockers: ["BLOCKED_EXTERNAL_APPROVAL", "BLOCKED_PUBLIC_TOUR_APPROVAL"],
    });
    await expect(
      rt.jobs.submit(actor, {
        ...command(p.id, [a.id], "deny-panorama-video"),
        durationSeconds: 5,
      }),
    ).rejects.toMatchObject({ code: "DISTINCT_PHOTOS_REQUIRED" });
  });
  it("cancels before rendering without output, fences cleanup and rejects invalid clip sources", async () => {
    const p = await photoProperty("Synthetic cancelled composition"),
      input = command(p.id, p.ids, "v54-cancelled-composition");
    const job = await rt.jobs.submit(actor, input);
    await rt.jobs.cancel(actor, job.id);
    expect((await rt.jobs.get(actor, job.id)).state).toBe("cancelled");
    await expect(rt.releases.outputGrant(actor, job.id)).rejects.toBeDefined();
    const snapshot = {
      ...output,
      artifactId: "foreign",
      photoComposition: {
        ...output.photoComposition!,
        clips: output.photoComposition!.clips,
      },
    };
    await expect(
      discardFencedComposition(rt.storage, "studio", snapshot),
    ).rejects.toMatchObject({ code: "COMPOSITION_ARTIFACT_SCOPE_DENIED" });
    const { photoComposition, ...legacy } = output;
    void photoComposition;
    await discardFencedComposition(rt.storage, "studio", legacy);
  });
  it("detects stale source bytes and removes partial private clips on a failed composition", async () => {
    const p = await photoProperty("Synthetic source integrity failure");
    await writeFile(
      rt.storage.path("studio", p.ids[1]!, "source"),
      Buffer.from("tampered synthetic bytes"),
    );
    const job = await rt.jobs.submit(
      actor,
      command(p.id, p.ids, "v54-tampered-source"),
    );
    await rt.jobs.processNext();
    const failed = await rt.jobs.get(actor, job.id);
    expect(failed.state).toBe("failed");
    expect(failed.output).toBeNull();
    await expect(
      stat(
        rt.storage.path(
          "studio",
          `${failed.id}--${failed.fence}--c0`,
          "output",
          "mp4",
        ),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  }, 60000);
});
