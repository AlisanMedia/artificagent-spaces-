// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Database } from "@/server/database";
import { seedIdentity, emptyManifest } from "@/server/seed";

describe("real local PostgreSQL RLS (PGlite)", () => {
  let db: Database;
  beforeAll(async () => {
    db = await new Database().ready();
    await seedIdentity(db);
    for (const [org, id, user] of [
      ["studio", "property-a", "demo-admin-a"],
      ["atelier", "property-b", "demo-admin-b"],
    ]) {
      await db.pg.query(
        "insert into properties(organization_id,id,title,synthetic_only,created_by) values($1,$2,$2,true,$3)",
        [org, id, user],
      );
      await db.pg.query(
        "insert into property_revisions values($1,$2,1,$3,$4,now())",
        [org, id, JSON.stringify(emptyManifest(org!, id!, 1)), user],
      );
    }
  }, 30_000);
  afterAll(async () => {
    await db?.close();
  });
  it("enables and forces RLS on every product table", async () => {
    const rows = await db.pg.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      "select relname,relrowsecurity,relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    );
    expect(rows.rows.length).toBeGreaterThan(30);
    expect(
      rows.rows.every((r) => r.relrowsecurity && r.relforcerowsecurity),
    ).toBe(true);
  });
  it("reads only the authorized organization", async () => {
    const a = await db.actor("demo-admin-a", "studio");
    const r = await db.as(a, (tx) =>
      tx.query<{ id: string }>("select id from properties"),
    );
    expect(r.rows.map((x) => x.id)).toEqual(["property-a"]);
  });
  it("denies forged organization membership", async () => {
    await expect(db.actor("demo-admin-a", "atelier")).rejects.toMatchObject({
      code: "TENANT_ACCESS_DENIED",
    });
  });
  it("denies cross-tenant direct SQL read even with forged actor scope", async () => {
    const r = await db.as(
      { userId: "demo-admin-a", organizationId: "atelier" },
      (tx) => tx.query("select * from properties"),
    );
    expect(r.rows).toEqual([]);
  });
  it("denies cross-tenant insert", async () => {
    const a = await db.actor("demo-admin-a", "studio");
    await expect(
      db.as(a, (tx) =>
        tx.query(
          "insert into properties(organization_id,id,title,synthetic_only,created_by) values('atelier','intruder','no',true,'demo-admin-a')",
        ),
      ),
    ).rejects.toThrow(/row.level security/i);
  });
  it("denies cross-tenant update", async () => {
    const a = await db.actor("demo-admin-a", "studio");
    const r = await db.as(a, (tx) =>
      tx.query(
        "update properties set title='attack' where organization_id='atelier' returning id",
      ),
    );
    expect(r.rows).toEqual([]);
  });
  it("viewer can read but cannot write", async () => {
    const a = await db.actor("demo-viewer-a", "studio");
    expect(
      (await db.as(a, (tx) => tx.query("select * from properties"))).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.as(a, (tx) =>
          tx.query("update properties set title='attack' returning id"),
        )
      ).rows,
    ).toEqual([]);
  });
  it("reviewer cannot edit geometry", async () => {
    const a = await db.actor("demo-reviewer-a", "studio");
    expect(
      (
        await db.as(a, (tx) =>
          tx.query("update properties set title='attack' returning id"),
        )
      ).rows,
    ).toEqual([]);
  });
  it("prevents private sessions and ledger writes", async () => {
    const a = await db.actor("demo-admin-a", "studio");
    await expect(
      db.as(a, (tx) => tx.query("select * from spaces_private.sessions")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(a, (tx) =>
        tx.query(
          "insert into cost_ledger values('studio','x','x','credit',1,'{}',now())",
        ),
      ),
    ).rejects.toThrow(/row.level security/i);
  });
  it("composite foreign keys prevent linking a foreign property", async () => {
    await expect(
      db.pg.query(
        "insert into property_revisions values('studio','property-b',2,'{}','demo-admin-a',now())",
      ),
    ).rejects.toThrow(/foreign key/i);
  });
  it("revision and audit history are immutable", async () => {
    await expect(
      db.pg.query("update property_revisions set created_by='other'"),
    ).rejects.toThrow("IMMUTABLE_RECORD");
  });
});
