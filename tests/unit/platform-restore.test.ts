// @vitest-environment node
import { it, expect } from "vitest";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PlatformRuntime } from "@/server/runtime";
it("restores an offline local database/private-key backup without losing history or changing a grant", async () => {
  const parent = await mkdtemp(join(tmpdir(), "spaces-restore-")),
    source = join(parent, "original"),
    backup = join(parent, "backup");
  let runtime: PlatformRuntime | undefined;
  try {
    runtime = await PlatformRuntime.create(source, false, false);
    const admin = await runtime.db.actor("demo-admin-a", "studio");
    const p = await runtime.properties.create(admin, {
      title: "Restore fixture",
      syntheticOnly: true,
    });
    await runtime.properties.revise(admin, p.id, 1, {
      title: "Preserved immutable revision",
    });
    const token = runtime.secrets.sign({
      purpose: "asset",
      organizationId: "studio",
      propertyId: p.id,
      revision: 2,
      resourceId: "restore-asset",
      sessionId: "session",
      nonce: "nonce",
      expiresAt: Date.now() + 60000,
    });
    await runtime.db.close();
    runtime = undefined;
    await cp(source, backup, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    runtime = await PlatformRuntime.create(backup, false, false);
    const actor = await runtime.db.actor("demo-admin-a", "studio");
    expect((await runtime.properties.get(actor, p.id)).title).toBe(
      "Preserved immutable revision",
    );
    expect(runtime.secrets.verify(token, "asset").revision).toBe(2);
    expect(
      (
        await runtime.db.pg.query<{ n: number }>(
          "select count(*)::int as n from property_revisions where organization_id='studio' and property_id=$1",
          [p.id],
        )
      ).rows[0]!.n,
    ).toBe(2);
    await expect(
      runtime.db.pg.transaction(async (tx) => {
        await tx.exec("create table migration_probe(id int)");
        throw new Error("simulated migration failure");
      }),
    ).rejects.toThrow("simulated migration failure");
    expect(
      (
        await runtime.db.pg.query<{ table: string | null }>(
          "select to_regclass('public.migration_probe') as table",
        )
      ).rows[0]!.table,
    ).toBeNull();
  } finally {
    await runtime?.db.close();
    await rm(parent, { recursive: true, force: true });
  }
}, 60000);
