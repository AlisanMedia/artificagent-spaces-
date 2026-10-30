// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateKeyPairSync, sign } from "node:crypto";
import { prepareV01OfflineDemo } from "../../scripts/v01-offline-demo";
import { PlatformRuntime } from "@/server/runtime";
import { FileV01Authority, V01Permit } from "@/server/v01/authorization";
import { V01Service } from "@/server/v01/service";
import { OfflineV01Gateway } from "@/server/v01/offline-fixture";
import { FalV01Gateway } from "@/server/v01/fal-http";
import { queuePath } from "@/server/v01/gateway";
import { digest } from "@/server/crypto";
import { validateV01Video } from "@/server/video-quality";
let root: string,
  rt: PlatformRuntime,
  info: Awaited<ReturnType<typeof prepareV01OfflineDemo>>,
  savedPublicKey: string | undefined;
beforeAll(async () => {
  const parent = join(process.cwd(), ".spaces-local", "v01-integration");
  await mkdir(parent, { recursive: true, mode: 0o700 });
  root = await mkdtemp(join(parent, "run-"));
  info = await prepareV01OfflineDemo(root, 3);
  savedPublicKey = process.env["SPACES_V01_APPROVER_PUBLIC_KEY"];
  process.env["SPACES_V01_APPROVER_PUBLIC_KEY"] = info.publicKey;
  rt = await PlatformRuntime.create(root, false, false);
}, 60_000);
afterAll(async () => {
  await rt?.db.close();
  if (savedPublicKey === undefined)
    delete process.env["SPACES_V01_APPROVER_PUBLIC_KEY"];
  else process.env["SPACES_V01_APPROVER_PUBLIC_KEY"] = savedPublicKey;
});
async function request(key = crypto.randomUUID()) {
  const actor = await rt.db.actor("demo-admin-a", "studio");
  const r = await rt.production.plan(actor, {
    propertyId: info.propertyId,
    revision: info.revision,
    serviceId: "V01",
    sourceAssetIds: [info.assetId],
    options: { durationSeconds: 4, aspectRatio: "16:9" },
    rights: {
      syntheticOnly: true,
      ownedOrLicensed: true,
      conceptAccepted: false,
    },
    idempotencyKey: key,
    maxCostMicroUsd: 0,
  });
  return { actor, request: r };
}
describe("V01 actual application integration with zero-network synthetic transport", () => {
  it("does not reserve a request or create a job when the server transport preflight refuses", async () => {
    const { actor, request: r } = await request();
    const authority = new FileV01Authority(root, () => info.publicKey);
    const { permit } = await authority.load(Date.now());
    const before = await rt.db.pg.query(
      "select count(*) from v01_permit_usage",
    );
    const jobsBefore = (await rt.jobs.list(actor)).length;
    const service = new V01Service(
      rt.db,
      rt.properties,
      rt.production,
      rt.storage,
      authority,
      () => {
        const gateway = new OfflineV01Gateway(root, permit);
        gateway.preflight = async () => {
          throw new Error("V01_SERVER_SECRET_UNAVAILABLE");
        };
        return gateway;
      },
    );
    await expect(service.start(actor, r.id)).rejects.toThrow(
      "V01_SERVER_SECRET_UNAVAILABLE",
    );
    expect((await rt.jobs.list(actor)).length).toBe(jobsBefore);
    expect(
      (await rt.db.pg.query("select count(*) from v01_permit_usage")).rows,
    ).toEqual(before.rows);
  });
  it("persists one provider ID, resumes after database restart, validates1080p bytes, gates independent review and scoped delivery", async () => {
    const { actor, request: r } = await request();
    const [a, b] = await Promise.all([
      rt.v01.start(actor, r.id),
      rt.v01.start(actor, r.id),
    ]);
    expect(a.jobId).toBe(b.jobId);
    const jobId = a.jobId;
    await rt.v01.advance(actor, jobId);
    const accepted = await rt.v01.get(actor, jobId);
    expect(accepted.provider_request_id).toMatch(/^offline-v01-/);
    expect(await rt.jobs.processNext()).toBeNull(); // The old renderer must not consume or downgrade V01.
    await rt.db.close();
    rt = await PlatformRuntime.create(root, false, false);
    expect((await rt.v01.get(actor, jobId)).provider_request_id).toBe(
      accepted.provider_request_id,
    );
    for (let i = 0; i < 3; i++) await rt.v01.advance(actor, jobId);
    const job = await rt.jobs.get(actor, jobId);
    expect(job.state).toBe("awaiting-review");
    expect(job.output).toMatchObject({
      kind: "provider-contract-fixture",
      width: 1920,
      height: 1080,
      codec: "h264",
      actualExternalCostMicroUsd: 0,
    });
    expect(job.output!.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(job.output!.providerVideo!.mode).toBe("offline-fixture");
    expect((await rt.production.get(actor, r.id)).jobId).toBe(jobId);
    await expect(rt.releases.outputGrant(actor, jobId)).rejects.toThrow();
    const checks = {
      decision: "approved",
      rights: true,
      evidence: true,
      continuity: true,
      disclosure: true,
      outputSha256: job.output!.sha256,
    };
    await expect(rt.releases.review(actor, jobId, checks)).rejects.toThrow(
      "INDEPENDENT_REVIEW_REQUIRED",
    );
    const reviewer = await rt.db.actor(
      "demo-reviewer-a",
      "studio",
      "different-reviewer-session",
    );
    await expect(
      rt.releases.review(reviewer, jobId, {
        ...checks,
        outputSha256: "a".repeat(64),
      }),
    ).rejects.toThrow("V01_EXACT_OUTPUT_REVIEW_REQUIRED");
    await rt.db.pg.query(
      "update jobs set output=jsonb_set(output,'{providerVideo,mode}','\"fal-live-test\"'::jsonb) where organization_id=$1 and id=$2",
      [actor.organizationId, jobId],
    );
    await expect(rt.releases.review(reviewer, jobId, checks)).rejects.toThrow(
      "V01_REAL_REVIEWER_PROOF_REQUIRED",
    );
    await rt.db.pg.query(
      "update jobs set output=$3 where organization_id=$1 and id=$2",
      [actor.organizationId, jobId, JSON.stringify(job.output)],
    );
    await rt.releases.review(reviewer, jobId, checks);
    const token = await rt.releases.outputGrant(actor, jobId);
    expect(token.length).toBeGreaterThan(30);
    const bytes = await rt.storage.readVerified(
      actor.organizationId,
      job.output!.artifactId!,
      job.output!.sha256,
      "output",
      "mp4",
    );
    expect(digest(bytes)).toBe(job.output!.sha256);
    await expect(rt.releases.publish(actor, jobId)).rejects.toThrow(
      "V01_PUBLICATION_NOT_AUTHORIZED",
    );
    await rt.v01.cancel(actor, jobId);
    await expect(rt.releases.outputGrant(actor, jobId)).rejects.toThrow();
  }, 60_000);
  it("does not submit again after an ambiguous acceptance; read-only reconciliation restores the same task", async () => {
    const { actor, request: r } = await request();
    const run = await rt.v01.start(actor, r.id);
    let submits = 0;
    const authority = new FileV01Authority(root, () => info.publicKey);
    const { permit } = await authority.load(Date.now());
    const engine = new V01Service(
      rt.db,
      rt.properties,
      rt.production,
      rt.storage,
      authority,
      () => {
        const g = new OfflineV01Gateway(root, permit);
        g.submit = async () => {
          submits++;
          throw new Error("socket closed AFTER acceptance");
        };
        return g;
      },
    );
    await engine.advance(actor, run.jobId);
    await engine.advance(actor, run.jobId);
    expect(submits).toBe(1);
    expect((await rt.jobs.get(actor, run.jobId)).state).toBe(
      "unknown-submission",
    );
    expect((await engine.get(actor, run.jobId)).actual_micro_usd).toBeNull();
    await expect(
      engine.reconcile(actor, run.jobId, "offline-reconciled-same-task"),
    ).rejects.toThrow();
    await info.signReconciliation({
      jobId: run.jobId,
      requestId: r.id,
      organizationId: actor.organizationId,
      sourceSha256: info.sourceSha256,
      providerId: "offline-reconciled-same-task",
    });
    await engine.reconcile(actor, run.jobId, "offline-reconciled-same-task");
    expect((await engine.get(actor, run.jobId)).provider_request_id).toBe(
      "offline-reconciled-same-task",
    );
    expect(submits).toBe(1);
    await rt.v01.cancel(actor, run.jobId);
  });
  it("rejects cross-tenant/role/service/source misuse and conservatively retains request budgets", async () => {
    const { actor, request: r } = await request();
    const other = await rt.db.actor("demo-admin-b", "atelier"),
      viewer = await rt.db.actor("demo-viewer-a", "studio");
    await expect(rt.v01.start(other, r.id)).rejects.toThrow();
    await expect(rt.v01.start(viewer, r.id)).rejects.toThrow("ROLE_DENIED");
    const run = await rt.v01.start(actor, r.id);
    await expect(rt.v01.get(other, run.jobId)).rejects.toThrow();
    await expect(rt.jobs.cancel(actor, run.jobId)).rejects.toThrow(
      "V01_CANCEL_PATH_REQUIRED",
    );
    await rt.v01.cancel(actor, run.jobId);
    await rt.v01.advance(actor, run.jobId);
    expect((await rt.v01.get(actor, run.jobId)).provider_request_id).toBeNull();
    const more = await request();
    await expect(rt.v01.start(actor, more.request.id)).rejects.toThrow(
      "V01_REQUEST_OR_BUDGET_CAP",
    );
    const p = await rt.production.plan(actor, {
      propertyId: info.propertyId,
      revision: info.revision,
      serviceId: "P01",
      sourceAssetIds: [info.assetId],
      options: {},
      rights: { syntheticOnly: true, ownedOrLicensed: true },
      idempotencyKey: crypto.randomUUID(),
      maxCostMicroUsd: 0,
    });
    await expect(rt.v01.start(actor, p.id)).rejects.toThrow(
      "V01_ONLY_SYNTHETIC_RIGHTS_REQUIRED",
    );
    const forged = await rt.db.as(viewer, (tx) =>
      tx.query("select * from v01_runs where organization_id='atelier'"),
    );
    expect(forged.rows).toEqual([]);
    await expect(
      rt.db.as(actor, (tx) => tx.query("update v01_runs set phase='REVIEW'")),
    ).rejects.toThrow();
  });
  it("requires an independently signed exact source permit before secrets/HTTP; no env/key-only enablement", async () => {
    let keyReads = 0;
    const missing = new FileV01Authority(root, () => undefined);
    const gateway = new FalV01Gateway(
      missing,
      "a".repeat(64),
      async () => {
        keyReads++;
        return "never-used-placeholder";
      },
      null,
    );
    await expect(gateway.status("arbitrary-task")).rejects.toThrow(
      "V01_OWNER_TEST_PERMISSION_REQUIRED",
    );
    expect(keyReads).toBe(0);
    const wrong = generateKeyPairSync("ed25519");
    await expect(
      new FileV01Authority(root, () =>
        wrong.publicKey.export({ type: "spki", format: "pem" }).toString(),
      ).load(Date.now()),
    ).rejects.toThrow("V01_PERMIT_SIGNATURE_INVALID");
    const original = await readFile(join(root, "v01-owner-test-permit.json"));
    const bytes = Buffer.from(
      JSON.stringify({ ...info, model: "different-model" }),
    );
    await writeFile(
      join(root, "v01-owner-test-permit.json"),
      JSON.stringify({
        payload: bytes.toString("base64url"),
        signature: sign(null, bytes, wrong.privateKey).toString("hex"),
      }),
    );
    await expect(
      new FileV01Authority(root, () => info.publicKey).load(Date.now()),
    ).rejects.toThrow();
    const offlinePayload = JSON.parse(
      Buffer.from(
        JSON.parse(original.toString()).payload,
        "base64url",
      ).toString(),
    );
    const liveWithoutAttestations = Buffer.from(
      JSON.stringify({
        ...offlinePayload,
        mode: "fal-live-test",
        unitPriceMicroUsdPerSecond: 1,
        perRequestCapMicroUsd: 4,
        totalCapMicroUsd: 4,
        pollIntervalMs: 5000,
      }),
    );
    await writeFile(
      join(root, "v01-owner-test-permit.json"),
      JSON.stringify({
        payload: liveWithoutAttestations.toString("base64url"),
        signature: sign(
          null,
          liveWithoutAttestations,
          wrong.privateKey,
        ).toString("hex"),
      }),
    );
    await expect(
      new FileV01Authority(root, () =>
        wrong.publicKey.export({ type: "spki", format: "pem" }).toString(),
      ).load(Date.now()),
    ).rejects.toThrow("V01_LIVE_ACCOUNT_RIGHTS_AND_BILLING_GATES_REQUIRED");
    await writeFile(join(root, "v01-owner-test-permit.json"), original);
    expect(queuePath("known-task", "status")).toBe(
      "/kling/v4/requests/known-task/status",
    );
    expect(V01Permit.safeParse({ mode: "fal-live-test" }).success).toBe(false);
  });
  it("rejects a genuine360p sample and JSON bytes under the dedicated1080p contract, without local upscale fallback", async () => {
    const dir = await mkdtemp(join(root, "negative-profile-"));
    const expected = {
      durationSeconds: 4 as const,
      aspectRatio: "16:9" as const,
      maxBytes: 8388608,
      sourceId: info.assetId,
      sourceSha256: info.sourceSha256,
      revision: info.revision,
      manifestSha256: "a".repeat(64),
      requestId: "negative-v01",
      mode: "offline-fixture" as const,
    };
    await expect(
      validateV01Video(
        join(process.cwd(), "public/showcase-v55/natural.mp4"),
        join(dir, "forbidden-upscale.mp4"),
        expected,
      ),
    ).rejects.toThrow("V01_1080P_PROFILE_MISMATCH");
    const json = join(dir, "not-video.mp4");
    await writeFile(
      json,
      JSON.stringify({ video: "storyboard is not an MP4" }),
    );
    await expect(
      validateV01Video(json, join(dir, "not-delivered.mp4"), expected),
    ).rejects.toThrow("V01_MP4_BYTES_REQUIRED");
  });
  it("a durable SUBMITTING record after a lost process becomes HOLD_UNKNOWN, never another POST", async () => {
    const actor = await rt.db.actor("demo-admin-a", "studio");
    const rows = await rt.jobs.list(actor);
    const jobId = rows[0]!.id;
    await rt.db.pg.query(
      "update v01_runs set phase='SUBMITTING',lease_until_ms=0 where organization_id=$1 and job_id=$2",
      [actor.organizationId, jobId],
    );
    await rt.db.pg.query(
      "update jobs set state='processing' where organization_id=$1 and id=$2",
      [actor.organizationId, jobId],
    );
    let gatewayCalls = 0;
    const authority = new FileV01Authority(root, () => info.publicKey);
    const service = new V01Service(
      rt.db,
      rt.properties,
      rt.production,
      rt.storage,
      authority,
      () => {
        gatewayCalls++;
        throw new Error("No transport should be created");
      },
    );
    expect((await service.advance(actor, jobId)).phase).toBe("HOLD_UNKNOWN");
    expect(gatewayCalls).toBe(0);
    await rt.v01.cancel(actor, jobId);
  });
  it("a new source revision invalidates the earlier run and never rebinds it to a replacement photo", async () => {
    const actor = await rt.db.actor("demo-admin-a", "studio"),
      job = (await rt.jobs.list(actor))[0]!;
    await rt.properties.upload(
      actor,
      info.propertyId,
      await readFile("public/golden-v5/living.png"),
      "photo",
      {
        syntheticOnly: true,
        ownedOrLicensed: true,
        metadataRemovalAccepted: true,
      },
    );
    await expect(rt.v01.get(actor, job.id)).rejects.toThrow("STALE_REVISION");
    expect((await rt.properties.get(actor, info.propertyId)).revision).toBe(
      info.revision + 1,
    );
  });
});
