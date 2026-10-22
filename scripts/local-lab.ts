import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PlatformRuntime } from "../src/server/runtime";
import { newId } from "../src/server/crypto";

const command = process.argv[2] ?? "demo";
const root = resolve(process.env["SPACES_LOCAL_DATA_DIR"] ?? ".spaces-local");
if (command !== "demo")
  throw new Error(
    "Use npm run demo:local; a running app owns its single-process PGlite database.",
  );
const runtime = await PlatformRuntime.create(root);
try {
  {
    const started = performance.now(),
      initial = await runtime.db.actor("demo-admin-a", "studio");
    const organization = await runtime.identity.createOrganization(
      initial,
      "Yerel uçtan uca laboratuvar " + newId().slice(0, 8),
    );
    const owner = await runtime.db.actor(initial.userId, organization.id);
    const invitation = await runtime.identity.invite(
      owner,
      "demo-reviewer-a",
      "reviewer",
    );
    await runtime.identity.acceptInvitation(
      await runtime.db.actor("demo-reviewer-a", "studio"),
      organization.id,
      invitation.id,
    );
    const reviewer = await runtime.db.actor("demo-reviewer-a", organization.id);
    const created = await runtime.properties.create(owner, {
      title: "Atrium • Yeni organizasyon / yeni sentetik mülk",
      syntheticOnly: true,
    });
    const property = await runtime.properties.applySyntheticPlan(
      owner,
      created.id,
    );
    const outputRoot = join(root, "demo-evidence");
    await mkdir(outputRoot, { recursive: true, mode: 0o700 });
    const outputs = [],
      links = [];
    for (const [mode, aspectRatio] of [
      ["pov", "16:9"],
      ["cinematic", "9:16"],
      ["hybrid", "16:9"],
      ["interactive-3d", "16:9"],
    ] as const) {
      const queued = await runtime.jobs.submit(owner, {
        propertyId: property.id,
        revision: property.revision,
        mode,
        aspectRatio,
        durationSeconds: 4,
        idempotencyKey: newId(),
      });
      while ((await runtime.jobs.get(owner, queued.id)).state === "queued")
        await runtime.jobs.processNext();
      const job = await runtime.jobs.get(owner, queued.id);
      if (!job.output || job.state !== "awaiting-review")
        throw new Error(job.error_code ?? "LOCAL_DEMO_FAILED");
      await runtime.releases.review(reviewer, job.id, {
        decision: "approved",
        rights: true,
        evidence: true,
        continuity: true,
        disclosure: true,
      });
      const pub = await runtime.releases.publish(owner, job.id),
        filename = `${mode}.${job.output.extension}`;
      await copyFile(
        runtime.storage.path(
          owner.organizationId,
          job.output.artifactId ?? job.id,
          "output",
          job.output.extension,
        ),
        join(outputRoot, filename),
      );
      outputs.push({
        mode,
        filename,
        ...job.output,
        reviewedBySeparateSyntheticIdentity: true,
      });
      links.push({
        mode,
        url: "http://127.0.0.1:3000/tour/" + pub.token,
        expiresAt: pub.expiresAt,
      });
      if (mode === "interactive-3d") {
        const visitor = await runtime.analytics.createVisitor(pub.token, {
          analytics: true,
          voice: true,
          contact: true,
          recording: false,
          version: "spaces-consent-v1",
        });
        const voice = await runtime.voice.start(pub.token, visitor.token);
        await runtime.voice.speak(pub.token, visitor.token, voice.token, {
          sequence: 1,
          question: "Salon kaç metrekare?",
          currentRoom: "living",
        });
        await runtime.voice.stop(pub.token, visitor.token, voice.token);
        await runtime.analytics.ingest(
          pub.token,
          visitor.token,
          [
            "listing_viewed",
            "tour_3d_started",
            "voice_session_started",
            "voice_session_ended",
          ].map((name) => ({
            eventId: newId(),
            name,
            timestamp: new Date().toISOString(),
          })),
        );
      }
    }
    const evidence = {
      schemaVersion: 1,
      syntheticOnly: true,
      actualExternalCostMicroUsd: 0,
      wallTimeMs: Math.round(performance.now() - started),
      outputs,
      realProviderMinutes: null,
      realBrowserFps: "MEASURE_IN_BROWSER",
      review:
        "Two local test identities; not a substitute for GitHub independent review",
    };
    await writeFile(
      join(outputRoot, "measured-results.json"),
      JSON.stringify(evidence, null, 2),
      { mode: 0o600 },
    );
    await writeFile(
      join(outputRoot, "session-links.json"),
      JSON.stringify(links, null, 2),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify(
        {
          result: "PASS",
          actualFiles: outputs.map((o) => o.filename),
          evidencePath: join(outputRoot, "measured-results.json"),
          privateLocalLinksPath: join(outputRoot, "session-links.json"),
          wallTimeMs: evidence.wallTimeMs,
          externalSpendUsd: 0,
        },
        null,
        2,
      ),
    );
  }
} finally {
  await runtime.db.close();
}
