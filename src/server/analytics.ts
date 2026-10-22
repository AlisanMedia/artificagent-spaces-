import type { Transaction } from "@electric-sql/pglite";
import { z } from "zod";
import {
  EventInput,
  Id,
  csvCell,
  invariant,
  type EngagementEvent,
} from "@/domain/platform";
import type { Actor, Database } from "./database";
import type { Secrets } from "./crypto";
import { newId, digest } from "./crypto";
import type { PublishedScope, ReleaseService } from "./releases";
import { authorize, audit } from "./properties";

export const Consent = z
  .object({
    analytics: z.boolean(),
    voice: z.boolean(),
    recording: z.literal(false),
    contact: z.boolean(),
    version: z.literal("spaces-consent-v1"),
  })
  .strict();
export type ConsentState = z.infer<typeof Consent>;
interface VisitorBody {
  publicationId: string;
  nonce: string;
  consent: ConsentState;
  optedOut: boolean;
}
export interface VisitorScope {
  id: string;
  publicationId: string;
  organizationId: string;
  propertyId: string;
  revision: number;
  consent: ConsentState;
  nonce: string;
}
export class AnalyticsService {
  constructor(
    readonly db: Database,
    readonly releases: ReleaseService,
    readonly secrets: Secrets,
  ) {}
  private async lockedConsent(tx: Transaction, visitor: VisitorScope) {
    const row = (
      await tx.query<{ body: VisitorBody; expires_at: Date }>(
        "select body,expires_at from anonymous_sessions where organization_id=$1 and id=$2 and property_id=$3 and revision=$4 for update",
        [
          visitor.organizationId,
          visitor.id,
          visitor.propertyId,
          visitor.revision,
        ],
      )
    ).rows[0];
    invariant(
      row &&
        row.body.nonce === visitor.nonce &&
        row.body.publicationId === visitor.publicationId &&
        new Date(row.expires_at).getTime() > Date.now(),
      "VISITOR_REVOKED",
      403,
    );
    return Consent.parse(row.body.consent);
  }
  async createVisitor(publicationToken: string, input: unknown) {
    const scope = await this.releases.resolve(publicationToken),
      consent = Consent.parse(input),
      id = newId(),
      nonce = newId();
    const body: VisitorBody = {
      publicationId: scope.publication.id,
      nonce,
      consent,
      optedOut: !consent.analytics,
    };
    await this.db.pg.transaction(async (tx) => {
      await tx.query(
        "insert into anonymous_sessions(organization_id,id,property_id,revision,session_id,body) values($1,$2,$3,$4,$2,$5)",
        [
          scope.publication.organization_id,
          id,
          scope.publication.property_id,
          scope.publication.revision,
          JSON.stringify(body),
        ],
      );
      await tx.query(
        "insert into analytics_consents(organization_id,id,property_id,revision,session_id,body) values($1,$2,$3,$4,$5,$6)",
        [
          scope.publication.organization_id,
          newId(),
          scope.publication.property_id,
          scope.publication.revision,
          id,
          JSON.stringify(consent),
        ],
      );
    });
    const expiresAt = Math.min(
      new Date(scope.publication.expires_at).getTime(),
      Date.now() + 3_600_000,
    );
    return {
      id,
      token: this.secrets.sign({
        purpose: "visitor",
        organizationId: scope.publication.organization_id,
        propertyId: scope.publication.property_id,
        revision: scope.publication.revision,
        resourceId: scope.publication.id,
        sessionId: id,
        nonce,
        expiresAt,
      }),
      expiresAt,
    };
  }
  async resolveVisitor(
    visitorToken: string,
    publication: PublishedScope,
  ): Promise<VisitorScope> {
    const grant = this.secrets.verify(visitorToken, "visitor");
    invariant(
      grant.organizationId === publication.publication.organization_id &&
        grant.propertyId === publication.publication.property_id &&
        grant.revision === publication.publication.revision &&
        grant.resourceId === publication.publication.id,
      "VISITOR_SCOPE_MISMATCH",
      403,
    );
    const row = (
      await this.db.pg.query<{
        id: string;
        body: VisitorBody;
        expires_at: Date;
      }>(
        "select id,body,expires_at from anonymous_sessions where organization_id=$1 and id=$2 and property_id=$3 and revision=$4",
        [
          grant.organizationId,
          grant.sessionId,
          grant.propertyId,
          grant.revision,
        ],
      )
    ).rows[0];
    invariant(
      row &&
        row.body.nonce === grant.nonce &&
        row.body.publicationId === grant.resourceId &&
        new Date(row.expires_at).getTime() > Date.now(),
      "VISITOR_REVOKED",
      403,
    );
    return {
      id: row.id,
      publicationId: grant.resourceId,
      organizationId: grant.organizationId,
      propertyId: grant.propertyId,
      revision: grant.revision,
      consent: row.body.consent,
      nonce: grant.nonce,
    };
  }
  async scope(publicationToken: string, visitorToken: string) {
    const publication = await this.releases.resolve(publicationToken);
    return {
      publication,
      visitor: await this.resolveVisitor(visitorToken, publication),
    };
  }
  async ingest(
    publicationToken: string,
    visitorToken: string,
    input: unknown,
    bot = false,
  ) {
    const { publication, visitor } = await this.scope(
      publicationToken,
      visitorToken,
    );
    const items = z.array(EventInput).max(32).parse(input);
    if (!visitor.consent.analytics || bot)
      return {
        accepted: 0,
        dropped: items.length,
        reason: bot ? "BOT_POLICY" : "NO_ANALYTICS_CONSENT",
      };
    const now = Date.now();
    for (const event of items) {
      invariant(
        Math.abs(Date.parse(event.timestamp) - now) < 300_000,
        "EVENT_TIME_OUT_OF_RANGE",
      );
      if (event.roomId)
        invariant(
          publication.scene.rooms.some(
            (r) => r.id === event.roomId && r.truth === "E2",
          ),
          "UNKNOWN_EVENT_ROOM",
        );
      if (event.poiId)
        invariant(
          publication.scene.pois.some((p) => p.id === event.poiId),
          "UNKNOWN_EVENT_POI",
        );
    }
    return this.db.pg.transaction(async (tx) => {
      if (!(await this.lockedConsent(tx, visitor)).analytics)
        return {
          accepted: 0,
          dropped: items.length,
          reason: "NO_ANALYTICS_CONSENT",
        };
      const count = (
        await tx.query<{ count: number }>(
          "select count(*)::int as count from analytics_events where organization_id=$1 and session_id=$2 and created_at>now()-interval '1 minute'",
          [visitor.organizationId, visitor.id],
        )
      ).rows[0]!.count;
      invariant(count + items.length <= 60, "ANALYTICS_RATE_LIMIT", 429);
      let accepted = 0;
      for (const item of items) {
        const r = await tx.query(
          "insert into analytics_events(organization_id,id,property_id,revision,session_id,body) values($1,$2,$3,$4,$5,$6) on conflict do nothing returning id",
          [
            visitor.organizationId,
            item.eventId,
            visitor.propertyId,
            visitor.revision,
            visitor.id,
            JSON.stringify(item),
          ],
        );
        accepted += r.rows.length;
      }
      return { accepted, dropped: items.length - accepted };
    });
  }
  async withdraw(publicationToken: string, visitorToken: string) {
    const { visitor } = await this.scope(publicationToken, visitorToken);
    await this.db.pg.transaction(async (tx) => {
      await this.lockedConsent(tx, visitor);
      await tx.query(
        "delete from analytics_events where organization_id=$1 and session_id=$2",
        [visitor.organizationId, visitor.id],
      );
      await tx.query(
        "update anonymous_sessions set body=jsonb_set(jsonb_set(body,'{consent,analytics}','false'),'{optedOut}','true') where organization_id=$1 and id=$2",
        [visitor.organizationId, visitor.id],
      );
      await tx.query(
        "insert into analytics_consents(organization_id,id,property_id,revision,session_id,body) values($1,$2,$3,$4,$5,$6)",
        [
          visitor.organizationId,
          newId(),
          visitor.propertyId,
          visitor.revision,
          visitor.id,
          JSON.stringify({
            ...visitor.consent,
            analytics: false,
            withdrawn: true,
          }),
        ],
      );
    });
    return { erasedAnalytics: true, analyticsConsent: false };
  }
  async erase(publicationToken: string, visitorToken: string) {
    const { visitor } = await this.scope(publicationToken, visitorToken);
    await this.db.pg.transaction(async (tx) => {
      await this.lockedConsent(tx, visitor);
      for (const table of [
        "analytics_events",
        "leads",
        "viewing_requests",
        "campaign_attribution",
      ])
        await tx.query(
          `delete from ${table} where organization_id=$1 and session_id=$2`,
          [visitor.organizationId, visitor.id],
        );
      await tx.query(
        "update anonymous_sessions set body=jsonb_set(jsonb_set(jsonb_set(body,'{consent,analytics}','false'),'{consent,contact}','false'),'{consent,voice}','false') where organization_id=$1 and id=$2",
        [visitor.organizationId, visitor.id],
      );
    });
    return {
      erased: true,
      retained:
        "İletişim bilgisi içermeyen maliyet/audit kayıtları; raw transcript veya audio tutulmadı.",
    };
  }
  async lead(publicationToken: string, visitorToken: string, input: unknown) {
    const { visitor } = await this.scope(publicationToken, visitorToken);
    const value = z
      .object({
        name: z.string().trim().min(1).max(80),
        contactMethod: z.enum(["email", "phone"]),
        contact: z.string().trim().min(3).max(120),
        message: z.string().max(500).default(""),
        explicitConsent: z.literal(true),
        consentVersion: z.literal("spaces-consent-v1"),
        viewingRequested: z.boolean().default(false),
        idempotencyKey: Id,
      })
      .strict()
      .parse(input);
    invariant(visitor.consent.contact, "CONTACT_CONSENT_REQUIRED", 403);
    invariant(
      value.contactMethod === "email"
        ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contact)
        : /^[+()0-9 -]{5,25}$/.test(value.contact),
      "INVALID_CONTACT",
    );
    const id = value.idempotencyKey;
    const body = {
      requestHash: digest(JSON.stringify(value)),
      encryptedContact: this.secrets.tenant(visitor.organizationId).encrypt(
        JSON.stringify({
          name: value.name,
          contactMethod: value.contactMethod,
          contact: value.contact,
          message: value.message,
        }),
      ),
      status: "PENDING_INTEREST",
      consentVersion: value.consentVersion,
      consentAt: new Date().toISOString(),
      ownerOrganizationId: visitor.organizationId,
      simulated: true,
    };
    await this.db.pg.transaction(async (tx) => {
      invariant(
        (await this.lockedConsent(tx, visitor)).contact,
        "CONTACT_CONSENT_REQUIRED",
        403,
      );
      const old = (
        await tx.query<{ session_id: string; body: { requestHash: string } }>(
          "select session_id,body from leads where organization_id=$1 and id=$2",
          [visitor.organizationId, id],
        )
      ).rows[0];
      invariant(
        !old ||
          (old.session_id === visitor.id &&
            old.body.requestHash === body.requestHash),
        "LEAD_IDEMPOTENCY_CONFLICT",
        409,
      );
      await tx.query(
        "insert into leads(organization_id,id,property_id,revision,session_id,body) values($1,$2,$3,$4,$5,$6) on conflict do nothing",
        [
          visitor.organizationId,
          id,
          visitor.propertyId,
          visitor.revision,
          visitor.id,
          JSON.stringify(body),
        ],
      );
      if (value.viewingRequested)
        await tx.query(
          "insert into viewing_requests(organization_id,id,property_id,revision,session_id,body) values($1,$2,$3,$4,$5,$6) on conflict do nothing",
          [
            visitor.organizationId,
            id,
            visitor.propertyId,
            visitor.revision,
            visitor.id,
            JSON.stringify({
              status: "PENDING",
              leadId: id,
              confirmationSource: null,
              simulated: true,
            }),
          ],
        );
    });
    return {
      id,
      status: "PENDING_INTEREST",
      bookingConfirmed: false,
      simulated: true,
    };
  }
  async confirmViewing(bodyText: string, signature: string) {
    const value = z
      .object({
        providerEventId: Id,
        viewingRequestId: Id,
        organizationId: Id,
        status: z.literal("confirmed"),
        mode: z.literal("simulated-crm"),
      })
      .strict()
      .parse(JSON.parse(bodyText));
    this.secrets
      .tenant(value.organizationId)
      .verifyWebhook(bodyText, signature);
    return this.db.pg.transaction(async (tx) => {
      const viewing = (
        await tx.query<{
          property_id: string;
          revision: number;
          session_id: string;
          body: { status: string };
        }>(
          "select * from viewing_requests where organization_id=$1 and id=$2 for update",
          [value.organizationId, value.viewingRequestId],
        )
      ).rows[0];
      invariant(viewing, "UNKNOWN_VIEWING_REQUEST", 404);
      const duplicate = await tx.query(
        "select id from campaign_attribution where organization_id=$1 and id=$2",
        [value.organizationId, value.providerEventId],
      );
      if (duplicate.rows.length) return { deduplicated: true };
      await tx.query(
        "insert into campaign_attribution(organization_id,id,property_id,revision,session_id,body) values($1,$2,$3,$4,$5,$6)",
        [
          value.organizationId,
          value.providerEventId,
          viewing.property_id,
          viewing.revision,
          viewing.session_id,
          JSON.stringify({
            viewingRequestId: value.viewingRequestId,
            verified: true,
            simulated: true,
            source: "authenticated-simulated-crm",
          }),
        ],
      );
      await tx.query(
        "update viewing_requests set body=jsonb_set(jsonb_set(body,'{status}','\"CONFIRMED_SIMULATED\"'),'{confirmationSource}','\"authenticated-simulated-crm\"') where organization_id=$1 and id=$2",
        [value.organizationId, value.viewingRequestId],
      );
      return { status: "CONFIRMED_SIMULATED", realBooking: false };
    });
  }
  async rollup(
    actor: Actor,
    propertyId: string | null,
    from: string,
    to: string,
    campaign: string | null = null,
  ) {
    const current = await authorize(this.db, actor, "read");
    invariant(
      current.role === "admin" || current.role === "editor",
      "ANALYTICS_ROLE_DENIED",
      403,
    );
    if (propertyId) Id.parse(propertyId);
    if (campaign)
      z.string()
        .regex(/^[A-Za-z0-9_-]{1,64}$/)
        .parse(campaign);
    const start = z.iso.datetime({ offset: true }).parse(from),
      end = z.iso.datetime({ offset: true }).parse(to);
    invariant(
      Date.parse(start) < Date.parse(end) &&
        Date.parse(end) - Date.parse(start) <= 366 * 86_400_000,
      "INVALID_ANALYTICS_WINDOW",
    );
    const events = (
      await this.db.as(actor, (tx) =>
        tx.query<{
          session_id: string;
          property_id: string;
          body: EngagementEvent;
        }>(
          "select session_id,property_id,body from analytics_events where organization_id=$1 and ($2::text is null or property_id=$2) and (body->>'timestamp')::timestamptz >= $3::timestamptz and (body->>'timestamp')::timestamptz < $4::timestamptz and expires_at>now() and ($5::text is null or body->>'campaign'=$5) order by (body->>'timestamp')::timestamptz",
          [actor.organizationId, propertyId, start, end, campaign],
        ),
      )
    ).rows;
    const sessions = new Set(events.map((e) => e.session_id));
    const rawCount = (name: EngagementEvent["name"]) =>
      events.filter((e) => e.body.name === name).length;
    const uniqueCount = (name: EngagementEvent["name"]) =>
      new Set(
        events.filter((e) => e.body.name === name).map((e) => e.session_id),
      ).size;
    const scoped = [actor.organizationId, propertyId, start, end];
    const leads = (
      await this.db.as(actor, (tx) =>
        tx.query<{ session_id: string }>(
          "select session_id from leads where organization_id=$1 and ($2::text is null or property_id=$2) and created_at >= $3::timestamptz and created_at < $4::timestamptz and expires_at>now()",
          scoped,
        ),
      )
    ).rows;
    const viewings = (
      await this.db.as(actor, (tx) =>
        tx.query<{ session_id: string }>(
          "select session_id from viewing_requests where organization_id=$1 and ($2::text is null or property_id=$2) and body->>'status'='CONFIRMED_SIMULATED' and created_at >= $3::timestamptz and created_at < $4::timestamptz and expires_at>now()",
          scoped,
        ),
      )
    ).rows;
    const uniqueConsented = (rows: { session_id: string }[]) =>
      new Set(
        rows
          .filter((row) => sessions.has(row.session_id))
          .map((row) => row.session_id),
      ).size;
    const confirmed = uniqueConsented(viewings),
      dwell: Record<string, number> = {},
      engaged = new Set<string>();
    for (const visitorId of sessions) {
      const roomEvents = events.filter(
        (e) => e.session_id === visitorId && e.body.name === "room_entered",
      );
      if (new Set(roomEvents.map((e) => e.body.roomId)).size >= 2)
        engaged.add(visitorId);
      for (let i = 0; i < roomEvents.length; i++) {
        const e = roomEvents[i]!,
          next = roomEvents[i + 1];
        if (e.body.roomId && next)
          dwell[e.body.roomId] =
            (dwell[e.body.roomId] ?? 0) +
            Math.min(
              1800,
              Math.max(
                0,
                (Date.parse(next.body.timestamp) -
                  Date.parse(e.body.timestamp)) /
                  1000,
              ),
            );
      }
    }
    const topics: Record<string, number> = {};
    for (const e of events)
      if (e.body.name === "voice_question_category" && e.body.category)
        topics[e.body.category] = (topics[e.body.category] ?? 0) + 1;
    const channels: Record<string, number> = {};
    for (const e of events.filter((e) => e.body.name === "listing_viewed"))
      channels[e.body.campaign || "direct-local"] =
        (channels[e.body.campaign || "direct-local"] ?? 0) + 1;
    const steps = [
      { key: "visitors", label: "Onaylı oturumlar", count: sessions.size },
      {
        key: "tours",
        label: "3D başlatan oturumlar",
        count: uniqueCount("tour_3d_started"),
      },
      {
        key: "engaged",
        label: "En az iki oda gezen oturumlar",
        count: engaged.size,
      },
      {
        key: "details",
        label: "Detay inceleyen oturumlar",
        count: uniqueCount("inspection_detail_opened"),
      },
      {
        key: "intent",
        label: "İletişim ilgisi olan oturumlar",
        count: uniqueCount("contact_clicked"),
      },
      {
        key: "leads",
        label: "İlgi talebi bırakan oturumlar",
        count: uniqueConsented(leads),
      },
      {
        key: "viewings",
        label: "Simüle gösterimi doğrulanan oturumlar",
        count: confirmed,
      },
    ];
    return {
      organizationId: actor.organizationId,
      from: start,
      to: end,
      campaign,
      totalEvents: events.length,
      consentedSessions: sessions.size,
      uniquePeople: "UNKNOWN",
      lowSample: sessions.size < 5,
      conversionRate: sessions.size ? confirmed / sessions.size : null,
      steps,
      dwellSeconds: dwell,
      voiceStarts: rawCount("voice_session_started"),
      voiceEnds: rawCount("voice_session_ended"),
      topics,
      channels,
      rawLeadRecords: leads.length,
      rawSimulatedConfirmations: viewings.length,
      attribution:
        "Betimsel; adımlar bağımsız benzersiz oturum sayısıdır. Satış artışı/gerçek satış kanıtı değildir.",
      realSalesClosed: null,
    };
  }
  async exportAggregate(
    actor: Actor,
    propertyId: string | null,
    from: string,
    to: string,
  ) {
    const data = await this.rollup(actor, propertyId, from, to);
    const brand =
      (
        await this.db.pg.query<{ body: { displayName: string } }>(
          "select body from white_label_brands where organization_id=$1 and id='default'",
          [actor.organizationId],
        )
      ).rows[0]?.body.displayName ?? "ArtificAgent Spaces";
    return [
      "brand,step,count",
      ...data.steps.map((x) =>
        [csvCell(brand), csvCell(x.label), csvCell(x.count)].join(","),
      ),
    ].join("\n");
  }
  async privateLead(actor: Actor, leadId: string) {
    await authorize(this.db, actor, "admin");
    const row = (
      await this.db.as(actor, (tx) =>
        tx.query<{ body: { encryptedContact: string } }>(
          "select body from leads where organization_id=$1 and id=$2 and expires_at>now()",
          [actor.organizationId, leadId],
        ),
      )
    ).rows[0];
    invariant(row, "LEAD_NOT_FOUND", 404);
    await this.db.pg.transaction((tx) =>
      audit(tx, actor, "lead.private_access", leadId),
    );
    return JSON.parse(
      this.secrets
        .tenant(actor.organizationId)
        .decrypt(row.body.encryptedContact),
    ) as {
      name: string;
      contactMethod: string;
      contact: string;
      message: string;
    };
  }
  async sweep(actor: Actor) {
    await authorize(this.db, actor, "admin");
    let deleted = 0;
    await this.db.pg.transaction(async (tx) => {
      for (const table of [
        "analytics_events",
        "leads",
        "viewing_requests",
        "campaign_attribution",
      ])
        deleted += (
          await tx.query(
            `delete from ${table} where organization_id=$1 and expires_at<now() returning id`,
            [actor.organizationId],
          )
        ).rows.length;
      await audit(
        tx,
        actor,
        "retention.expired_records_deleted",
        String(deleted),
      );
    });
    return { deleted, organizationId: actor.organizationId };
  }
}
