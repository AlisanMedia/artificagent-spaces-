import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { invariant, type PlatformRole } from "@/domain/platform";

export interface Actor {
  readonly userId: string;
  readonly organizationId: string;
  readonly role: PlatformRole;
  readonly sessionId: string;
}
export class Database {
  readonly pg: PGlite;
  private initialized: Promise<void>;
  constructor(path?: string) {
    this.pg = new PGlite(path);
    this.initialized = this.migrate();
  }
  private async migrate() {
    await this.pg.waitReady;
    await this.pg.exec(
      "create schema if not exists spaces_private; revoke all on schema spaces_private from public; create table if not exists spaces_private.migrations(name text primary key)",
    );
    const dir = join(process.cwd(), "supabase/migrations");
    for (const name of (await readdir(dir))
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      const existing = await this.pg.query(
        "select name from spaces_private.migrations where name=$1",
        [name],
      );
      if (!existing.rows.length)
        await this.pg.transaction(async (tx) => {
          await tx.exec(await readFile(join(dir, name), "utf8"));
          await tx.query("insert into spaces_private.migrations values ($1)", [
            name,
          ]);
        });
    }
  }
  async ready() {
    await this.initialized;
    return this;
  }
  async close() {
    await this.initialized;
    await this.pg.close();
  }
  async as<T>(
    actor: Pick<Actor, "userId"> & Partial<Pick<Actor, "organizationId">>,
    fn: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    await this.initialized;
    return this.pg.transaction(async (tx) => {
      await tx.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.organization_id',$2,true)",
        [actor.userId, actor.organizationId ?? ""],
      );
      await tx.exec("set local role spaces_app");
      return fn(tx);
    });
  }
  async actor(
    userId: string,
    organizationId: string,
    sessionId = "test-session",
  ): Promise<Actor> {
    const rows = await this.as({ userId }, (tx) =>
      tx.query<{ role: PlatformRole }>(
        "select role from memberships where user_id=$1 and organization_id=$2",
        [userId, organizationId],
      ),
    );
    invariant(rows.rows[0], "TENANT_ACCESS_DENIED", 403);
    return { userId, organizationId, sessionId, role: rows.rows[0].role };
  }
}
export async function openLocalDatabase(dataRoot: string) {
  await mkdir(dataRoot, { recursive: true, mode: 0o700 });
  return new Database(join(dataRoot, "postgres")).ready();
}
