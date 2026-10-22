import { randomBytes } from "node:crypto";
import { invariant, Id } from "@/domain/platform";
import type { Actor, Database } from "./database";
import { digest, newId } from "./crypto";
import { DEMO_IDENTITIES } from "./seed";
import { authorize, audit } from "./properties";

/** Loopback synthetic identities, NOT customer authentication. Supabase production adapter stays disabled. */
export class IdentityService {
  constructor(readonly db: Database) {}
  async login(id: string) {
    const selected = DEMO_IDENTITIES.find((x) => x.id === id);
    invariant(selected, "UNKNOWN_DEMO_IDENTITY", 401);
    const token = randomBytes(32).toString("base64url"),
      expiresAt = Date.now() + 3_600_000;
    await this.db.pg.query(
      "insert into spaces_private.sessions values($1,$2,$3,$4,false)",
      [
        digest(token),
        selected.id,
        selected.organizationId,
        new Date(expiresAt).toISOString(),
      ],
    );
    return {
      token,
      expiresAt,
      user: { id: selected.id, label: selected.label },
      organizationId: selected.organizationId,
      mode: "LOCAL_SYNTHETIC_IDENTITY" as const,
    };
  }
  async resolve(token: string | undefined): Promise<Actor> {
    invariant(token && token.length <= 100, "AUTH_REQUIRED", 401);
    const row = (
      await this.db.pg.query<{
        user_id: string;
        organization_id: string;
        expires_at: Date;
        revoked: boolean;
      }>("select * from spaces_private.sessions where id=$1", [digest(token)])
    ).rows[0];
    invariant(
      row && !row.revoked && new Date(row.expires_at).getTime() > Date.now(),
      "SESSION_EXPIRED_OR_REVOKED",
      401,
    );
    return this.db.actor(row.user_id, row.organization_id, digest(token));
  }
  async logout(token: string) {
    await this.db.pg.query(
      "update spaces_private.sessions set revoked=true where id=$1",
      [digest(token)],
    );
  }
  async organizations(actor: Actor) {
    return (
      await this.db.as(actor, (tx) =>
        tx.query<{ id: string; name: string; role: string }>(
          "select o.id,o.name,m.role from organizations o join memberships m on m.organization_id=o.id where m.user_id=$1",
          [actor.userId],
        ),
      )
    ).rows;
  }
  async switchOrganization(actor: Actor, organizationId: string) {
    const scope = await this.db.actor(
      actor.userId,
      Id.parse(organizationId),
      actor.sessionId,
    );
    await this.db.pg.query(
      "update spaces_private.sessions set organization_id=$2 where id=$1 and user_id=$3 and not revoked",
      [actor.sessionId, scope.organizationId, actor.userId],
    );
    return scope;
  }
  async createOrganization(actor: Actor, name: string) {
    invariant(
      name.length > 0 &&
        name.length <= 100 &&
        !/[<>]/.test(name) &&
        !Array.from(name).some((c) => c.charCodeAt(0) < 32),
      "INVALID_ORGANIZATION_NAME",
    );
    const id = newId();
    await this.db.pg.transaction(async (tx) => {
      await tx.query(
        "insert into organizations(id,name,created_by) values($1,$2,$3)",
        [id, name, actor.userId],
      );
      await tx.query("insert into memberships values($1,$2,'admin')", [
        id,
        actor.userId,
      ]);
      await tx.query(
        "insert into credit_accounts values($1,10000000,0,'SIMULATED_MICRO_USD')",
        [id],
      );
    });
    return { id, name };
  }
  async invite(actor: Actor, syntheticUserId: string, role: string) {
    await authorize(this.db, actor, "admin");
    invariant(
      DEMO_IDENTITIES.some((x) => x.id === syntheticUserId) &&
        ["editor", "reviewer", "viewer"].includes(role),
      "LOCAL_INVITATION_ONLY",
    );
    const id = newId();
    await this.db.pg.transaction(async (tx) => {
      await tx.query(
        "insert into invitations(organization_id,id,body) values($1,$2,$3)",
        [
          actor.organizationId,
          id,
          JSON.stringify({
            syntheticUserId,
            role,
            status: "PENDING_LOCAL_ACCEPTANCE",
            expiresAt: Date.now() + 3_600_000,
          }),
        ],
      );
      await audit(tx, actor, "invitation.local_created", id);
    });
    return { id, status: "PENDING_LOCAL_ACCEPTANCE", emailSent: false };
  }
  async acceptInvitation(actor: Actor, organizationId: string, id: string) {
    await this.db.pg.transaction(async (tx) => {
      const row = (
        await tx.query<{
          body: {
            syntheticUserId: string;
            role: string;
            expiresAt: number;
            status: string;
          };
        }>(
          "select body from invitations where organization_id=$1 and id=$2 for update",
          [Id.parse(organizationId), Id.parse(id)],
        )
      ).rows[0];
      invariant(
        row &&
          row.body.syntheticUserId === actor.userId &&
          row.body.status === "PENDING_LOCAL_ACCEPTANCE" &&
          row.body.expiresAt > Date.now(),
        "INVALID_INVITATION",
        403,
      );
      await tx.query(
        "insert into memberships values($1,$2,$3) on conflict do nothing",
        [organizationId, actor.userId, row.body.role],
      );
      await tx.query(
        "update invitations set body=jsonb_set(body,'{status}','\"ACCEPTED\"') where organization_id=$1 and id=$2",
        [organizationId, id],
      );
    });
    return { accepted: true };
  }
}
