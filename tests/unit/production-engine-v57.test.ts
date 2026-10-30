// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import sharp from "sharp";
import { PlatformRuntime } from "@/server/runtime";
import type { Actor } from "@/server/database";
let rt: PlatformRuntime,
  admin: Actor,
  reviewer: Actor,
  other: Actor,
  viewer: Actor;
const rights = {
  syntheticOnly: true,
  ownedOrLicensed: true,
  metadataRemovalAccepted: true,
};
let image: Buffer;
beforeAll(async () => {
  const p = join(process.cwd(), ".spaces-local", "production-v57-tests");
  await mkdir(p, { recursive: true, mode: 0o700 });
  rt = await PlatformRuntime.create(
    await mkdtemp(join(p, "run-")),
    true,
    false,
  );
  admin = await rt.db.actor("demo-admin-a", "studio", "session-admin");
  reviewer = await rt.db.actor("demo-reviewer-a", "studio", "session-reviewer");
  other = await rt.db.actor("demo-admin-b", "atelier", "session-other");
  viewer = await rt.db.actor("demo-viewer-a", "studio", "session-viewer");
  image = await sharp(
    Buffer.from(
      '<svg width="640" height="480"><rect width="640" height="480" fill="#bfc6bc"/><path d="M60 420V40H560V420M60 100H560M330 40V420" stroke="#203a29" stroke-width="8" fill="none"/></svg>',
    ),
  )
    .png()
    .toBuffer();
}, 30000);
afterAll(async () => {
  await rt?.db.close();
});
async function fresh(serviceId = "P01") {
  const p = await rt.properties.create(admin, {
    title: "Owned synthetic production fixture",
    syntheticOnly: true,
  });
  await rt.properties.upload(admin, p.id, image, "photo", rights);
  const property = await rt.properties.get(admin, p.id),
    assets = await rt.properties.assets(admin, p.id);
  const input = {
    propertyId: p.id,
    revision: property.revision,
    serviceId,
    sourceAssetIds: [assets[0]!.id],
    options: {},
    rights: {
      syntheticOnly: true,
      ownedOrLicensed: true,
      conceptAccepted: false,
    },
    idempotencyKey: crypto.randomUUID(),
    maxCostMicroUsd: 0,
  };
  return { property, assets, input };
}
describe("durable tenant-safe blocked production requests", () => {
  it("saves one real request with exact source/profile without any debit or invented price", async () => {
    const f = await fresh();
    const before = await rt.db.pg.query(
      "select * from credit_accounts order by organization_id",
    );
    const [a, b] = await Promise.all([
      rt.production.plan(admin, f.input),
      rt.production.plan(admin, f.input),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.state).toBe("awaiting-provider-approval");
    expect(a.futurePriceMicroUsd).toBeNull();
    expect(a.downloadAllowed).toBe(false);
    expect(
      (
        await rt.production.list(
          admin,
          f.property.id,
          f.property.revision,
          "P01",
        )
      )[0]?.id,
    ).toBe(a.id);
    expect(
      await rt.production.list(
        reviewer,
        f.property.id,
        f.property.revision,
        "P01",
      ),
    ).toEqual([]);
    expect(JSON.stringify(a)).not.toMatch(
      /kling|pedra|prompt|fal-ai|nano-banana/,
    );
    expect(
      (
        await rt.db.pg.query(
          "select * from credit_accounts order by organization_id",
        )
      ).rows,
    ).toEqual(before.rows);
    const r = (
      await rt.db.pg.query<{
        profile: { version: string; promptSha256: null };
      }>("select profile from production_requests where id=$1", [a.id])
    ).rows[0]!;
    expect(r.profile.version).toBe("photo.enhance.hifi.v1");
    expect(r.profile.promptSha256).toBeNull();
    await expect(
      rt.production.plan(admin, { ...f.input, serviceId: "P02" }),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("denies forged source, wrong tenant, viewer, stale revision and unauthorized concept", async () => {
    const f = await fresh();
    const r = await rt.production.plan(admin, f.input);
    await expect(rt.production.get(other, r.id)).rejects.toThrow();
    await expect(rt.production.plan(viewer, f.input)).rejects.toThrow(
      "ROLE_DENIED",
    );
    await expect(
      rt.production.plan(admin, {
        ...f.input,
        sourceAssetIds: ["missing-photo"],
      }),
    ).rejects.toThrow();
    await expect(
      rt.production.plan(admin, { ...f.input, revision: 999 }),
    ).rejects.toThrow("STALE_REVISION");
    await expect(
      rt.production.plan(admin, { ...f.input, serviceId: "P07" }),
    ).rejects.toThrow("CONCEPT_PERMISSION_REQUIRED");
    expect(
      (
        await rt.db.as(
          { userId: admin.userId, organizationId: other.organizationId },
          (tx) => tx.query("select id from production_requests"),
        )
      ).rows,
    ).toEqual([]);
  });
  it("rejects direct RLS insert escalation and immutable source update", async () => {
    const f = await fresh();
    const r = await rt.production.plan(admin, f.input);
    await expect(
      rt.db.as(viewer, (tx) =>
        tx.query("insert into production_sources values($1,$2,$3,$4,$5,$6,1)", [
          admin.organizationId,
          r.id,
          f.property.id,
          f.property.revision,
          f.assets[0]!.id,
          "a".repeat(64),
        ]),
      ),
    ).rejects.toThrow();
    await expect(
      rt.db.as(admin, (tx) =>
        tx.query(
          "update production_requests set state='approved' where id=$1",
          [r.id],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      rt.db.pg.query(
        "update production_sources set source_sha256=$2 where request_id=$1",
        [r.id, "b".repeat(64)],
      ),
    ).rejects.toThrow();
  });
  it("freezes input revisions, invalidates changed source snapshots and safely cancels", async () => {
    const f = await fresh();
    const r = await rt.production.plan(admin, f.input);
    await rt.properties.upload(
      admin,
      f.property.id,
      await sharp(image).flop().png().toBuffer(),
      "photo",
      rights,
    );
    expect((await rt.properties.get(admin, f.property.id)).revision).toBe(
      f.property.revision + 1,
    );
    await expect(rt.production.get(admin, r.id)).rejects.toThrow(
      "STALE_REVISION",
    );
    const g = await fresh(),
      x = await rt.production.plan(admin, g.input);
    expect((await rt.production.cancel(admin, x.id)).state).toBe("cancelled");
    await expect(rt.productionDelivery.grant(admin, x.id)).rejects.toThrow();
  });
  it("records authenticated callback hash once, refuses invalid/replayed proof and never releases", async () => {
    const f = await fresh("V01"),
      r = await rt.production.plan(admin, f.input);
    await rt.db.pg.query(
      "update production_requests set state='processing',provider_request_id='offline-provider-request' where id=$1",
      [r.id],
    );
    const keys = generateKeyPairSync("ed25519"),
      body = Buffer.from(
        JSON.stringify({
          request_id: "offline-provider-request",
          status: "OK",
          payload: { video: { url: "https://evil.invalid/untrusted" } },
        }),
      );
    const now = Date.now(),
      timestamp = String(Math.floor(now / 1000)),
      bodyHash = createHash("sha256").update(body).digest("hex");
    const signature = sign(
      null,
      Buffer.from(
        [
          "offline-provider-request",
          "offline-account",
          timestamp,
          bodyHash,
        ].join("\n"),
      ),
      keys.privateKey,
    ).toString("hex");
    const headers = new Headers({
      "x-fal-webhook-request-id": "offline-provider-request",
      "x-fal-webhook-user-id": "offline-account",
      "x-fal-webhook-timestamp": timestamp,
      "x-fal-webhook-signature": signature,
    });
    const trusted = {
      providerUserId: "offline-account",
      fetchedAtMs: now,
      keys: [keys.publicKey.export({ format: "jwk" })],
    };
    expect(
      (await rt.production.recordFalCallback(body, headers, trusted, now))
        .duplicate,
    ).toBe(false);
    expect(
      (await rt.production.recordFalCallback(body, headers, trusted, now))
        .duplicate,
    ).toBe(true);
    expect((await rt.production.get(admin, r.id)).state).toBe("qa-held");
    await expect(
      rt.production.recordFalCallback(
        Buffer.from("tampered"),
        headers,
        trusted,
        now,
      ),
    ).rejects.toThrow();
    await expect(
      rt.production.recordFalCallback(body, headers, trusted, now + 301000),
    ).rejects.toThrow();
    expect(
      (
        await rt.db.pg.query(
          "select * from provider_callback_inbox where request_id=$1",
          [r.id],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      JSON.stringify(
        (await rt.db.pg.query("select * from provider_callback_inbox")).rows,
      ),
    ).not.toContain("evil.invalid");
    expect(
      (
        await rt.db.as(viewer, (tx) =>
          tx.query("select * from provider_callback_inbox"),
        )
      ).rows,
    ).toHaveLength(0);
  });
});
describe("actual private file and independent release, offline fixtures only", () => {
  async function candidate() {
    const f = await fresh(),
      r = await rt.production.plan(admin, f.input);
    await rt.db.pg.query(
      "update production_requests set state='processing' where id=$1",
      [r.id],
    );
    const b = await rt.storage.read(
      admin.organizationId,
      f.assets[0]!.id,
      "source",
    );
    return { f, r, b };
  }
  it("runs real decode/QA/private file/reviewer/grant/download/revoke without claiming vendor inference", async () => {
    const { r, b } = await candidate();
    const result = await rt.productionDelivery.ingestOfflineFixture(
      admin,
      r.id,
      b,
      { expectedFence: 0 },
    );
    expect(result.origin).toBe("OFFLINE_CONTRACT_FIXTURE");
    expect(result.qa.state).toBe("AWAITING_INDEPENDENT_REVIEW");
    await expect(rt.productionDelivery.grant(admin, r.id)).rejects.toThrow(
      "APPROVED_OUTPUT_REQUIRED",
    );
    const review = {
      outputSha256: result.sha256,
      checks: {
        rights: true,
        sourceFidelity: true,
        privacy: true,
        disclosure: true,
      },
    };
    await expect(
      rt.productionDelivery.review(admin, r.id, review),
    ).rejects.toThrow("INDEPENDENT_REVIEW_REQUIRED");
    await expect(
      rt.productionDelivery.review(viewer, r.id, review),
    ).rejects.toThrow("ROLE_DENIED");
    await expect(
      rt.productionDelivery.review(reviewer, r.id, {
        ...review,
        outputSha256: "a".repeat(64),
      }),
    ).rejects.toThrow();
    expect(
      (await rt.productionDelivery.review(reviewer, r.id, review))
        .realIndependentHumanAcceptance,
    ).toBe(false);
    const token = await rt.productionDelivery.grant(admin, r.id),
      output = await rt.productionDelivery.download(admin, r.id, token);
    expect(output.sha256).toBe(result.sha256);
    expect((await sharp(output.bytes).metadata()).format).toBe("png");
    const record = (
      await rt.db.pg.query<{ artifact_id: string }>(
        "select artifact_id from production_artifacts where request_id=$1",
        [r.id],
      )
    ).rows[0]!;
    const path = rt.storage.path(
      admin.organizationId,
      record.artifact_id,
      "output",
      "png",
    );
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(await readFile(path)).toEqual(output.bytes);
    await expect(
      rt.productionDelivery.download(reviewer, r.id, token),
    ).rejects.toThrow();
    await expect(
      rt.productionDelivery.download(other, r.id, token),
    ).rejects.toThrow();
    await rt.productionDelivery.revoke(admin, r.id);
    await expect(
      rt.productionDelivery.download(admin, r.id, token),
    ).rejects.toThrow();
  });
  it("rejects stale/expired/forged grants and source revisions", async () => {
    const { r, b, f } = await candidate(),
      result = await rt.productionDelivery.ingestOfflineFixture(
        admin,
        r.id,
        b,
        { expectedFence: 0 },
      );
    await rt.productionDelivery.review(reviewer, r.id, {
      outputSha256: result.sha256,
      checks: {
        rights: true,
        sourceFidelity: true,
        privacy: true,
        disclosure: true,
      },
    });
    const token = await rt.productionDelivery.grant(admin, r.id),
      g = rt.secrets.verify(token, "output");
    await expect(
      rt.productionDelivery.download(
        admin,
        r.id,
        rt.secrets.sign({ ...g, expiresAt: Date.now() - 1 }),
      ),
    ).rejects.toThrow();
    await expect(
      rt.productionDelivery.download(admin, r.id, token + "tamper"),
    ).rejects.toThrow();
    await rt.properties.revise(admin, f.property.id, f.property.revision, {
      title: "New synthetic revision",
    });
    await expect(
      rt.productionDelivery.download(admin, r.id, token),
    ).rejects.toThrow("STALE_REVISION");
  });
  it("holds critical architectural findings and late cancelled worker results", async () => {
    const { r, b } = await candidate(),
      x = await rt.productionDelivery.ingestOfflineFixture(admin, r.id, b, {
        expectedFence: 0,
        criticalFindings: ["invented_door"],
      });
    expect((await rt.production.get(admin, r.id)).state).toBe("rejected");
    await expect(
      rt.productionDelivery.review(reviewer, r.id, {
        outputSha256: x.sha256,
        checks: {
          rights: true,
          sourceFidelity: true,
          privacy: true,
          disclosure: true,
        },
      }),
    ).rejects.toThrow();
    const next = await candidate();
    await rt.production.cancel(admin, next.r.id);
    await expect(
      rt.productionDelivery.ingestOfflineFixture(admin, next.r.id, next.b, {
        expectedFence: 0,
      }),
    ).rejects.toThrow("WORKER_FENCE_DENIED");
  });
});
