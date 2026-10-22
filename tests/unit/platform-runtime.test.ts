// @vitest-environment node
import { describe, beforeAll, afterAll, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { PlatformRuntime } from "@/server/runtime";
import type { Actor } from "@/server/database";

describe("persistent property, file and identity boundary", () => {
  let runtime: PlatformRuntime, root: string, a: Actor, b: Actor;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "spaces-runtime-test-"));
    runtime = await PlatformRuntime.create(root, true);
    a = await runtime.db.actor("demo-admin-a", "studio");
    b = await runtime.db.actor("demo-admin-b", "atelier");
  }, 30000);
  afterAll(async () => {
    await runtime.db.close();
    await rm(root, { recursive: true, force: true });
  });
  it("creates separate properties with actual clean private plan/photo assets", async () => {
    const p = await runtime.properties.get(a, "property-a");
    expect(p.manifest.rooms).toHaveLength(3);
    expect(p.manifest.measuredBy).toBe(a.userId);
    const assets = await runtime.properties.assets(a, p.id);
    expect(assets).toHaveLength(2);
    for (const asset of assets) {
      const bytes = await runtime.storage.read(
        a.organizationId,
        asset.id,
        "source",
      );
      expect((await sharp(bytes).metadata()).format).toBe("jpeg");
    }
  });
  it("rejects property selectors from another tenant", async () => {
    await expect(runtime.properties.get(a, "property-b")).rejects.toMatchObject(
      { code: "PROPERTY_NOT_FOUND" },
    );
    expect(
      (await runtime.properties.get(b, "property-b")).organization_id,
    ).toBe("atelier");
  });
  it("persists creation and immutable revision history with optimistic concurrency", async () => {
    const p = await runtime.properties.create(a, {
      title: "Yeni sentetik mülk",
      syntheticOnly: true,
    });
    expect(p.manifest.rooms).toEqual([]);
    await runtime.properties.revise(a, p.id, 1, { title: "Revize mülk" });
    await expect(
      runtime.properties.revise(a, p.id, 1, { title: "stale" }),
    ).rejects.toMatchObject({ code: "STALE_REVISION" });
    expect((await runtime.properties.get(a, p.id)).revision).toBe(2);
  });
  it("rechecks current membership instead of trusting actor.role", async () => {
    const viewer = await runtime.db.actor("demo-viewer-a", "studio");
    await expect(
      runtime.properties.create(
        { ...viewer, role: "admin" },
        { title: "x", syntheticOnly: true },
      ),
    ).rejects.toMatchObject({ code: "ROLE_DENIED" });
  });
  it("requires explicit synthetic rights and rejects SVG/polyglot executable uploads", async () => {
    await expect(
      runtime.properties.upload(
        a,
        "property-a",
        Buffer.from('<svg onload="attack"/>'),
        "photo",
        {
          syntheticOnly: true,
          ownedOrLicensed: true,
          metadataRemovalAccepted: true,
        },
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MAGIC_BYTES" });
    await expect(
      runtime.properties.upload(
        a,
        "property-a",
        Buffer.from("bad"),
        "photo",
        {},
      ),
    ).rejects.toThrow();
  });
  it("strips EXIF rather than trusting upload metadata", async () => {
    const bytes = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#abc" },
    })
      .withExif({ IFD0: { Artist: "synthetic-metadata-sentinel" } })
      .jpeg()
      .toBuffer();
    const asset = await runtime.properties.upload(
      a,
      "property-a",
      bytes,
      "photo",
      {
        syntheticOnly: true,
        ownedOrLicensed: true,
        metadataRemovalAccepted: true,
      },
    );
    const meta = await sharp(
      await runtime.storage.read(a.organizationId, asset.id, "source"),
    ).metadata();
    expect(meta.exif).toBeUndefined();
  });
  it("checks byte limits before decoder and blocks EICAR", async () => {
    await expect(
      runtime.storage.ingest("studio", "big", new Uint8Array(5242881)),
    ).rejects.toMatchObject({ code: "UPLOAD_SIZE_LIMIT" });
    await expect(
      runtime.storage.ingest(
        "studio",
        "eicar",
        Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"),
      ),
    ).rejects.toMatchObject({ code: "QUARANTINED_SIGNATURE" });
  });
  it("forbids path traversal", () => {
    expect(() => runtime.storage.path("../atelier", "x", "source")).toThrow();
  });
  it("issues revocable server-side synthetic sessions and rejects arbitrary login", async () => {
    await expect(
      runtime.identity.login("arbitrary-admin"),
    ).rejects.toMatchObject({ code: "UNKNOWN_DEMO_IDENTITY" });
    const login = await runtime.identity.login("demo-admin-a");
    const actor = await runtime.identity.resolve(login.token);
    expect(actor.role).toBe("admin");
    await expect(
      runtime.identity.switchOrganization(actor, "atelier"),
    ).rejects.toMatchObject({ code: "TENANT_ACCESS_DENIED" });
    await runtime.identity.logout(login.token);
    await expect(runtime.identity.resolve(login.token)).rejects.toMatchObject({
      code: "SESSION_EXPIRED_OR_REVOKED",
    });
  });
});
