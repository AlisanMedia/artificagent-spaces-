// @vitest-environment node
import { it, expect } from "vitest";
import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { prepareV01OfflineDemo } from "../../scripts/v01-offline-demo";
import { PlatformRuntime } from "@/server/runtime";
import { FileV01Authority } from "@/server/v01/authorization";
import { OfflineV01Gateway } from "@/server/v01/offline-fixture";
import { V01Service } from "@/server/v01/service";

it("persists a known accepted ID even when the receipt routes are unsafe, including after restart; never submits twice", async () => {
  const p = join(process.cwd(), ".spaces-local", "v01-receipt-test");
  await mkdir(p, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(join(p, "run-")),
    fixture = await prepareV01OfflineDemo(root, 1),
    previous = process.env["SPACES_V01_APPROVER_PUBLIC_KEY"];
  process.env["SPACES_V01_APPROVER_PUBLIC_KEY"] = fixture.publicKey;
  let rt = await PlatformRuntime.create(root, false, false);
  try {
    const actor = await rt.db.actor("demo-admin-a", "studio");
    const r = await rt.production.plan(actor, {
      propertyId: fixture.propertyId,
      revision: fixture.revision,
      serviceId: "V01",
      sourceAssetIds: [fixture.assetId],
      options: { durationSeconds: 4, aspectRatio: "16:9" },
      rights: { syntheticOnly: true, ownedOrLicensed: true },
      maxCostMicroUsd: 0,
      idempotencyKey: crypto.randomUUID(),
    });
    const run = await rt.v01.start(actor, r.id),
      authority = new FileV01Authority(root, () => fixture.publicKey),
      { permit } = await authority.load(Date.now());
    let submits = 0;
    const service = new V01Service(
      rt.db,
      rt.properties,
      rt.production,
      rt.storage,
      authority,
      () => {
        const g = new OfflineV01Gateway(root, permit);
        g.submit = async () => {
          submits++;
          return {
            request_id: "known-accepted-offline-task",
            status_url: "https://untrusted.invalid/status",
            response_url: "https://untrusted.invalid/result",
          };
        };
        return g;
      },
    );
    expect((await service.advance(actor, run.jobId)).phase).toBe(
      "HOLD_UNKNOWN",
    );
    expect((await service.get(actor, run.jobId)).provider_request_id).toBe(
      "known-accepted-offline-task",
    );
    await service.advance(actor, run.jobId);
    expect(submits).toBe(1);
    await rt.db.close();
    rt = await PlatformRuntime.create(root, false, false);
    expect((await rt.v01.get(actor, run.jobId)).provider_request_id).toBe(
      "known-accepted-offline-task",
    );
    expect((await rt.jobs.get(actor, run.jobId)).state).toBe(
      "unknown-submission",
    );
    expect((await rt.v01.get(actor, run.jobId)).actual_micro_usd).toBeNull();
  } finally {
    await rt.db.close();
    if (previous === undefined)
      delete process.env["SPACES_V01_APPROVER_PUBLIC_KEY"];
    else process.env["SPACES_V01_APPROVER_PUBLIC_KEY"] = previous;
  }
}, 60_000);
