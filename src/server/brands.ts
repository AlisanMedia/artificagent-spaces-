import { z } from "zod";
import {
  Brand,
  invariant,
  accentText,
  type BrandTheme,
} from "@/domain/platform";
import type { Actor, Database } from "./database";
import { authorize, audit } from "./properties";
import { newId } from "./crypto";
import { DEMO_IDENTITIES } from "./seed";

const DEFAULT = Brand.parse({
  displayName: "ArtificAgent Spaces",
  accent: "#f4f0e8",
  language: "tr",
});
export class BrandService {
  constructor(readonly db: Database) {}
  async provisionChild(actor: Actor, input: unknown) {
    await authorize(this.db, actor, "admin");
    const value = z
      .object({
        displayName: Brand.shape.displayName,
        ownerSyntheticUserId: z.enum(["demo-admin-a", "demo-admin-b"]),
        syntheticOnly: z.literal(true),
      })
      .strict()
      .parse(input);
    const partner = (
      await this.db.as(actor, (tx) =>
        tx.query(
          "select id from partner_workspaces where organization_id=$1 and body->>'active'='true'",
          [actor.organizationId],
        ),
      )
    ).rows[0];
    invariant(
      partner &&
        DEMO_IDENTITIES.some((d) => d.id === value.ownerSyntheticUserId),
      "AUTHORIZED_PARTNER_REQUIRED",
      403,
    );
    const id = newId();
    await this.db.pg.transaction(async (tx) => {
      await tx.query(
        "insert into organizations(id,name,created_by) values($1,$2,$3)",
        [id, value.displayName, value.ownerSyntheticUserId],
      );
      await tx.query("insert into memberships values($1,$2,'admin')", [
        id,
        value.ownerSyntheticUserId,
      ]);
      await tx.query(
        "insert into credit_accounts(organization_id,available) values($1,10000000)",
        [id],
      );
      await tx.query("insert into partner_assignments values($1,$2,false)", [
        actor.organizationId,
        id,
      ]);
      await tx.query(
        "insert into white_label_brands(organization_id,id,body) values($1,'default',$2)",
        [
          id,
          JSON.stringify(
            Brand.parse({
              displayName: value.displayName,
              accent: "#f4f0e8",
              language: "tr",
            }),
          ),
        ],
      );
      await audit(tx, actor, "partner.local_child_created", id);
    });
    return {
      childOrganizationId: id,
      ownerSyntheticUserId: value.ownerSyntheticUserId,
      parentMembershipGranted: false,
      aggregateReporting: "PENDING_CHILD_OWNER_PERMISSION",
      externalResourcesCreated: false,
    };
  }
  async setChildReporting(
    childOwner: Actor,
    parentId: string,
    allowed: boolean,
  ) {
    await authorize(this.db, childOwner, "admin");
    const changed = await this.db.pg.transaction(async (tx) => {
      const result = await tx.query(
        "update partner_assignments set aggregate_allowed=$3 where organization_id=$1 and child_organization_id=$2 returning child_organization_id",
        [parentId, childOwner.organizationId, allowed],
      );
      invariant(result.rows.length === 1, "PARTNER_ASSIGNMENT_NOT_FOUND", 404);
      await audit(
        tx,
        childOwner,
        "partner.reporting_permission_changed",
        parentId,
      );
      return result.rows.length;
    });
    return { changed, aggregateAllowed: allowed, rawMediaAccess: false };
  }
  async get(actor: Actor) {
    await authorize(this.db, actor, "read");
    return this.publicBrand(actor.organizationId);
  }
  async publicBrand(organizationId: string) {
    const r = (
      await this.db.pg.query<{ body: BrandTheme }>(
        "select body from white_label_brands where organization_id=$1 and id='default'",
        [organizationId],
      )
    ).rows[0];
    const theme = Brand.parse(r?.body ?? DEFAULT);
    return {
      ...theme,
      accentText: accentText(theme.accent),
      domainStatus: theme.domain ? "LOCAL_FIXTURE_ONLY" : "NOT_CONFIGURED",
      externalDomainVerified: false as const,
    };
  }
  async save(actor: Actor, input: unknown) {
    await authorize(this.db, actor, "admin");
    const theme = Brand.parse(input);
    if (theme.logoAssetId) {
      const asset = (
        await this.db.as(actor, (tx) =>
          tx.query(
            "select id from assets where organization_id=$1 and id=$2 and status='clean' and mime='image/jpeg'",
            [actor.organizationId, theme.logoAssetId],
          ),
        )
      ).rows[0];
      invariant(asset, "BRAND_ASSET_SCOPE_DENIED", 403);
    }
    await this.db.pg.transaction(async (tx) => {
      await tx.query(
        "insert into white_label_brands(organization_id,id,body) values($1,'default',$2) on conflict(organization_id,id) do update set body=excluded.body",
        [actor.organizationId, JSON.stringify(theme)],
      );
      if (theme.domain)
        await tx.query(
          "insert into verified_domains(organization_id,id,body) values($1,$2,$3) on conflict do nothing",
          [
            actor.organizationId,
            theme.domain,
            JSON.stringify({
              domain: theme.domain,
              status: "LOCAL_FIXTURE_ONLY",
              dnsExecuted: false,
            }),
          ],
        );
      await audit(tx, actor, "brand.updated", "default");
    });
    return this.get(actor);
  }
  async partnerSummary(actor: Actor) {
    await authorize(this.db, actor, "admin");
    const children = (
      await this.db.as(actor, (tx) =>
        tx.query<{ child_organization_id: string; aggregate_allowed: boolean }>(
          "select child_organization_id,aggregate_allowed from partner_assignments where organization_id=$1",
          [actor.organizationId],
        ),
      )
    ).rows;
    const rows = [];
    for (const child of children.filter((x) => x.aggregate_allowed)) {
      const counts = (
        await this.db.pg.query<{
          properties: number;
          jobs: number;
          events: number;
          sessions: number;
        }>(
          "select (select count(*)::int from properties where organization_id=$1 and not archived) as properties,(select count(*)::int from jobs where organization_id=$1) as jobs,(select count(*)::int from analytics_events where organization_id=$1 and expires_at>now()) as events,(select count(distinct session_id)::int from analytics_events where organization_id=$1 and expires_at>now()) as sessions",
          [child.child_organization_id],
        )
      ).rows[0]!;
      rows.push({
        childOrganizationId: child.child_organization_id,
        properties: counts.properties,
        jobs: counts.jobs,
        engagementEvents: counts.sessions >= 5 ? counts.events : null,
        suppressedForLowDenominator: counts.sessions < 5,
        rawMediaAccess: false,
        privateLeadsAccess: false,
        resellerCommission: "NOT_CONTRACTED",
      });
    }
    return {
      assignedChildren: rows,
      disclosure:
        "Yalnız atanmış child workspace aggregate'leri. Ham medya/lead veya başka partner verisi verilmez.",
    };
  }
  async supportGrant(actor: Actor, input: unknown) {
    await authorize(this.db, actor, "admin");
    const value = z
      .object({
        userId: z.string().min(1).max(80),
        reason: z.string().min(5).max(200),
        ttlSeconds: z.number().int().min(60).max(3600),
      })
      .strict()
      .parse(input);
    const id = newId();
    await this.db.pg.transaction(async (tx) => {
      await tx.query(
        "insert into support_grants(organization_id,id,body) values($1,$2,$3)",
        [
          actor.organizationId,
          id,
          JSON.stringify({
            ...value,
            expiresAt: Date.now() + value.ttlSeconds * 1000,
            status: "PENDING_EXPLICIT_ROLE_BINDING",
            effectiveAccess: false,
          }),
        ],
      );
      await audit(tx, actor, "support.pending_grant", id);
    });
    return {
      id,
      effectiveAccess: false,
      status: "PENDING_EXPLICIT_ROLE_BINDING",
    };
  }
}
