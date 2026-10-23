import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  copyFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { PlatformRuntime } from "../src/server/runtime";
import type { PropertyRecord, AssetRecord } from "../src/server/properties";
import { GenerationInput, invariant } from "../src/domain/platform";
import {
  SCORE_RUBRIC_TR,
  REVIEW_DIMENSIONS,
  type LabProfile,
  renderProfile,
} from "../src/domain/video-quality";
import { buildOutput, isolatedWorkerEnvironment } from "../src/server/media";
import {
  inspectVideo,
  extractInspectionFrames,
  type QualityExpectation,
} from "../src/server/video-quality";
import { digest } from "../src/server/crypto";
const run = promisify(execFile),
  started = performance.now(),
  root = await mkdtemp(join(tmpdir(), "spaces-quality-v4-"));
const argument = process.argv.indexOf("--output"),
  out = resolve(
    argument >= 0
      ? process.argv[argument + 1]!
      : ".spaces-local/video-quality-v4",
  );
invariant(
  [".spaces-local/", "artifacts/"].some((p) =>
    out.startsWith(resolve(p) + sep),
  ),
  "SAFE_LAB_OUTPUT_REQUIRED",
);
await mkdir(out, { recursive: true, mode: 0o700 });
const rt = await PlatformRuntime.create(root, true, false);
try {
  const manifestBytes = await readFile(
      "fixtures/video-quality-v4/input-manifest.json",
    ),
    manifest = JSON.parse(manifestBytes.toString()) as {
      inputs: { file: string; sha256: string; bytes: number }[];
    };
  invariant(
    digest(manifestBytes) ===
      "cd7b74363901023f4702fafa35c103478edf5318e74b0af677fd9d725c55f6eb",
    "GOLDEN_MANIFEST_CHANGED",
  );
  for (const f of manifest.inputs) {
    const b = await readFile(join("fixtures/video-quality-v4", f.file));
    invariant(
      digest(b) === f.sha256 && b.length === f.bytes,
      "GOLDEN_INPUT_CHANGED",
    );
  }
  const actor = await rt.db.actor("demo-admin-a", "studio"),
    sets = new Map<
      string,
      { property: PropertyRecord; assets: AssetRecord[] }
    >();
  const rights = {
    syntheticOnly: true,
    ownedOrLicensed: true,
    metadataRemovalAccepted: true,
  };
  for (const [kind, names] of [
    ["photo", ["photo-a.jpg", "photo-b.webp"]],
    ["footage", ["footage.mp4"]],
    ["mixed", ["photo-a.jpg", "footage.mp4"]],
  ] as const) {
    const property = await rt.properties.create(
      actor,
      { title: `V4 sentetik ${kind}`, syntheticOnly: true },
      `quality-${kind}`,
    );
    for (const [i, name] of names.entries())
      await rt.properties.upload(
        actor,
        property.id,
        await readFile(join("fixtures/video-quality-v4", name)),
        name.endsWith("mp4") ? "walkthrough" : "photo",
        rights,
        `quality-${kind}-${i}`,
        {
          revision: 1,
          mime: name.endsWith("mp4")
            ? "video/mp4"
            : name.endsWith("webp")
              ? "image/webp"
              : "image/jpeg",
        },
      );
    sets.set(kind, {
      property: await rt.properties.get(actor, property.id),
      assets: await rt.properties.assets(actor, property.id),
    });
  }
  const cases = [
    {
      id: "photo-pov-horizontal-4",
      set: "photo",
      mode: "pov",
      aspect: "16:9",
      seconds: 4,
    },
    {
      id: "footage-pov-vertical-8",
      set: "footage",
      mode: "pov",
      aspect: "9:16",
      seconds: 8,
    },
    {
      id: "mixed-cinematic-horizontal-16",
      set: "mixed",
      mode: "cinematic",
      aspect: "16:9",
      seconds: 16,
    },
    {
      id: "photo-cinematic-vertical-4",
      set: "photo",
      mode: "cinematic",
      aspect: "9:16",
      seconds: 4,
    },
    {
      id: "footage-hybrid-horizontal-8",
      set: "footage",
      mode: "hybrid",
      aspect: "16:9",
      seconds: 8,
    },
    {
      id: "mixed-hybrid-vertical-16",
      set: "mixed",
      mode: "hybrid",
      aspect: "9:16",
      seconds: 16,
    },
    {
      id: "candidate-720p-15",
      set: "mixed",
      mode: "cinematic",
      aspect: "9:16",
      seconds: 16,
      profile: "lab-720p-15s",
    },
    {
      id: "candidate-1080p-30",
      set: "photo",
      mode: "hybrid",
      aspect: "16:9",
      seconds: 16,
      profile: "lab-1080p-30s",
    },
  ] as const;
  const outputs = [];
  for (const c of cases) {
    const fixture = sets.get(c.set)!;
    const command = GenerationInput.parse({
      propertyId: fixture.property.id,
      revision: 1,
      mode: c.mode,
      aspectRatio: c.aspect,
      durationSeconds: c.seconds,
      idempotencyKey: c.id,
      sourceAssetIds: fixture.assets.map((s: { id: string }) => s.id),
      captions: true,
      branding: true,
      template: "modern",
    });
    const profile = "profile" in c ? c.profile : undefined;
    const caseStarted = performance.now();
    try {
      let evidence;
      if (profile)
        evidence = await buildOutput(
          rt.storage,
          c.id,
          command,
          fixture.property.manifest,
          fixture.assets,
          {
            displayName: "Sentetik Emlak • uzun başlık yerleşim kontrolü",
            logoAssetId: null,
          },
          {
            profile: profile as LabProfile,
            purpose: "isolated-quality-lab-v4",
          },
        );
      else {
        const job = await rt.jobs.submit(actor, command);
        await rt.jobs.processNext();
        const done = await rt.jobs.get(actor, job.id);
        invariant(
          done.state === "awaiting-review" && done.output,
          done.error_code ?? "LAB_JOB_FAILED",
        );
        evidence = done.output;
      }
      const path = rt.storage.path(
        actor.organizationId,
        evidence.artifactId!,
        "output",
        "mp4",
      );
      const expected: QualityExpectation = {
        width: renderProfile(c.aspect, c.seconds, profile).width,
        height: renderProfile(c.aspect, c.seconds, profile).height,
        durationSeconds:
          profile === "lab-720p-15s" ? 15 : profile ? 30 : c.seconds,
        revision: 1,
        manifestSha256: digest(JSON.stringify(fixture.property.manifest)),
        sourceHashes: fixture.assets.map((a) => a.clean_hash),
        sourceIds: fixture.assets.map((a) => a.id),
        captionsRequired: true,
        evidence,
      };
      const quality = await inspectVideo(path, expected);
      await writeFile(
        join(out, c.id + ".quality.json"),
        JSON.stringify(quality, null, 2) + "\n",
      );
      if (quality.status !== "PASS")
        console.error(JSON.stringify({ case: c.id, quality }));
      const frames = join(out, c.id + "-frames");
      await extractInspectionFrames(path, frames, evidence.durationSeconds!);
      const tiles = await Promise.all(
        [1, 2, 3].map(async (n) => {
          const file = await sharp(join(frames, n + ".png"))
            .resize(320, 320, { fit: "contain", background: "#151515" })
            .png()
            .toBuffer();
          return { input: file, left: (n - 1) * 320, top: 0 };
        }),
      );
      await sharp({
        create: { width: 960, height: 320, channels: 3, background: "#151515" },
      })
        .composite(tiles)
        .png()
        .toFile(join(out, c.id + "-contact.png"));
      // Public-safe derivatives only; no grants, sessions, original filenames or credentials.
      await copyFile(path, join(out, c.id + ".mp4"));
      outputs.push({
        id: c.id,
        inputSet: c.set,
        mode: c.mode,
        aspect: c.aspect,
        profile: profile ?? "local-preview-v3",
        userSelectable: !profile,
        requestedSeconds: expected.durationSeconds,
        encodeWallTimeMs:
          evidence.nativeRenderMetrics?.ffmpegWallTimeMs ?? null,
        rendererWallTimeMs: evidence.wallTimeMs,
        measurementWallTimeMs: Math.round(performance.now() - caseStarted),
        encoderExit: 0,
        quality,
        provenance: {
          manifestSha256: evidence.manifestSha256,
          manifestRevision: evidence.manifestRevision,
          sourceHashes: evidence.sourceHashes,
          shots: evidence.shotProvenance,
          captionLayout: evidence.captionLayout,
        },
        cpuSeconds: null,
        peakRssBytes: null,
        resourceObservation:
          "Per-encoder CPU/RSS UNKNOWN; isolated candidates use CPU/address-space/time/output caps; wall time measured",
        nativeDetailClaim: false,
        release: "AWAITING_DIFFERENT_HUMAN_REVIEW",
        actualExternalCostMicroUsd: 0,
      });
      if (!profile)
        invariant(quality.status === "PASS", "BASELINE_OBJECTIVE_QA_FAILED");
    } catch (e) {
      if (!profile) throw e;
      outputs.push({
        id: c.id,
        profile,
        requestedSeconds: profile === "lab-720p-15s" ? 15 : 30,
        userSelectable: false,
        status: "NOT_IMPLEMENTED",
        reason: "BOUNDED_CANDIDATE_FAILED",
        encoderExit:
          e &&
          typeof e === "object" &&
          "code" in e &&
          typeof e.code === "number"
            ? e.code
            : null,
        failureCategory:
          e instanceof Error && /memory|malloc|allocate/i.test(e.message)
            ? "MEMORY_OR_ENCODER_LIMIT"
            : "ENCODER_OR_TIME_LIMIT",
        enforcedLimits: {
          addressSpaceBytes: 1073741824,
          cpuSeconds: 75,
          wallMilliseconds: 90000,
          outputBytes: 52428800,
        },
        wallTimeMs: Math.round(performance.now() - caseStarted),
        actualExternalCostMicroUsd: 0,
      });
    }
  }
  const reference = outputs[0]!;
  invariant(
    "quality" in reference && reference.quality.metadata,
    "LAB_REFERENCE_REQUIRED",
  );
  const photoSet = sets.get("photo")!;
  const referenceEvidence = {
    ...(await rt.jobs.list(actor)).find(
      (j) => j.command.idempotencyKey === cases[0].id,
    )!.output!,
  };
  const expectation: QualityExpectation = {
    width: 640,
    height: 360,
    durationSeconds: 4,
    revision: 1,
    manifestSha256: digest(JSON.stringify(photoSet.property.manifest)),
    sourceHashes: referenceEvidence.sourceHashes,
    sourceIds: photoSet.assets.map((a) => a.id),
    captionsRequired: false,
    evidence: referenceEvidence,
  };
  const negativePath = join("fixtures/video-quality-v4", "blank-negative.mp4"),
    negativeBytes = await readFile(negativePath);
  const blank = await inspectVideo(negativePath, {
    ...expectation,
    evidence: {
      ...referenceEvidence,
      sha256: digest(negativeBytes),
      bytes: negativeBytes.length,
      captionLayout: null,
    },
  });
  invariant(
    blank.status === "FAIL" && !blank.checks["sampledBlankFrames"],
    "NEGATIVE_BLANK_NOT_REJECTED",
  );
  const validPath = join(out, cases[0].id + ".mp4");
  const stale = await inspectVideo(validPath, {
    ...expectation,
    captionsRequired: true,
    revision: 2,
  });
  const missing = await inspectVideo(validPath, {
    ...expectation,
    captionsRequired: true,
    evidence: { ...referenceEvidence, sourceHashes: [], shotProvenance: [] },
  });
  const corruptPath = join(root, "corrupt.mp4");
  await writeFile(
    corruptPath,
    Buffer.from("deliberately corrupt synthetic output"),
  );
  const corrupt = await inspectVideo(corruptPath, expectation);
  const mismatch = await inspectVideo(validPath, {
    ...expectation,
    captionsRequired: true,
    evidence: { ...referenceEvidence, sha256: "0".repeat(64) },
  });
  invariant(
    [stale, missing, corrupt, mismatch].every((q) => q.status === "FAIL"),
    "NEGATIVE_QA_NOT_REJECTED",
  );
  const ffmpeg = (
    await run("ffmpeg", ["-version"], {
      timeout: 5000,
      maxBuffer: 65536,
      env: isolatedWorkerEnvironment(),
    })
  ).stdout.split("\n")[0];
  const result = {
    schemaVersion: 1,
    syntheticOnly: true,
    externalInferenceCalls: 0,
    actualExternalSpendMicroUsd: 0,
    goldenManifestSha256: digest(manifestBytes),
    ffmpeg,
    totalWallTimeMs: Math.round(performance.now() - started),
    humanAcceptedExports: 0,
    automatedObjectivePasses: outputs.filter(
      (o) => "quality" in o && o.quality.status === "PASS",
    ).length,
    subjectiveCommercialAcceptance: "NOT_VERIFIED",
    higherTierPolicy:
      "ISOLATED_LAB_ONLY_NOT_USER_SELECTABLE; 1080p involves upscaling normalized <=1600px sources; never native1080 or generative",
    outputs,
    negativeCases: {
      blank: blank.status,
      frozen:
        blank.checks["sampledFrozenFrames"] === false
          ? "FAIL_EXPECTED"
          : "NOT_REJECTED",
      stale: stale.status,
      missingProvenance: missing.status,
      corrupt: corrupt.status,
      mismatchedMedia: mismatch.status,
    },
  };
  invariant(
    result.negativeCases.frozen === "FAIL_EXPECTED",
    "FROZEN_NEGATIVE_NOT_REJECTED",
  );
  await writeFile(
    join(out, "measurements.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  await writeFile(
    join(out, "review-scorecard.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        scale: SCORE_RUBRIC_TR,
        reviewer: null,
        blind: false,
        independentHumanApproval: false,
        outputs: outputs.map((o) => ({
          id: o.id,
          scores: Object.fromEntries(REVIEW_DIMENSIONS.map((d) => [d, null])),
          notes: [],
          status: "NOT_REVIEWED",
        })),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      baselineOutputs: 6,
      candidates: 2,
      objectivePasses: result.automatedObjectivePasses,
      negativeCases: result.negativeCases,
      wallTimeMs: result.totalWallTimeMs,
      externalSpendMicroUsd: 0,
      report: join(out, "measurements.json"),
    }),
  );
} finally {
  await rt.db.close();
  await rm(root, { recursive: true, force: true });
}
