// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair, SignJWT } from "jose";
import { PlatformRuntime } from "@/server/runtime";
import type { Actor } from "@/server/database";
import { guideReply, SPACES_GUIDE_TEMPLATE } from "@/server/voice";
import { measuredFixture } from "@/server/seed";
import { Secrets, newId, type Grant } from "@/server/crypto";
import { verifyLocalRequest, limitedBody } from "@/server/http";
import {
  DisabledVideoAdapter,
  PROVIDERS,
  prepareMarbleRequest,
  routeProvider,
  MarbleExport,
} from "@/adapters/providers/registry";
import {
  ElevenLabsDisabledProvider,
  prepareSignedRequest,
  SignedCredential,
  propertyVariables,
} from "@/adapters/providers/elevenlabs";
import { VoiceInsightWebhook } from "@/server/voice-webhook";
import { SandboxPayments } from "@/server/payments";
import { verifySupabaseSession } from "@/adapters/providers/supabase-session";

const consent = {
  analytics: true,
  voice: true,
  recording: false,
  contact: true,
  version: "spaces-consent-v1",
};
const approval = {
  decision: "approved",
  rights: true,
  evidence: true,
  continuity: true,
  disclosure: true,
};
describe("two-property voice / analytics / reseller adversarial boundaries", () => {
  let rt: PlatformRuntime, root: string, a: Actor, b: Actor;
  let pubA: { token: string; id: string },
    pubB: { token: string; id: string },
    visitorA: { token: string; id: string },
    visitorB: { token: string; id: string };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "spaces-adversarial-"));
    rt = await PlatformRuntime.create(root, true);
    a = await rt.db.actor("demo-admin-a", "studio");
    b = await rt.db.actor("demo-admin-b", "atelier");
    for (const [actor, property, reviewer, target] of [
      [a, "property-a", "demo-reviewer-a", "a"],
      [b, "property-b", "demo-reviewer-b", "b"],
    ] as const) {
      const job = await rt.jobs.submit(actor, {
        propertyId: property,
        revision: 2,
        mode: "interactive-3d",
        idempotencyKey: "security-" + target,
      });
      await rt.jobs.processNext();
      expect((await rt.jobs.get(actor, job.id)).state).toBe("awaiting-review");
      await rt.releases.review(
        await rt.db.actor(reviewer, actor.organizationId),
        job.id,
        approval,
      );
      const pub = await rt.releases.publish(actor, job.id);
      const visitor = await rt.analytics.createVisitor(pub.token, consent);
      if (target === "a") {
        pubA = pub;
        visitorA = visitor;
      } else {
        pubB = pub;
        visitorB = visitor;
      }
    }
  }, 120000);
  afterAll(async () => {
    await rt.db.close();
    await rm(root, { recursive: true, force: true });
  });
  it("uses one template with distinct isolated per-property profiles and no external agent IDs", async () => {
    const va = await rt.voice.start(pubA.token, visitorA.token),
      vb = await rt.voice.start(pubB.token, visitorB.token);
    expect(va.template).toBe(vb.template);
    expect(SPACES_GUIDE_TEMPLATE.providerAgentId).toBeNull();
    const profiles = (
      await rt.db.pg.query<{
        organization_id: string;
        property_id: string;
        body: { providerAgentId: null };
      }>("select * from property_agent_profiles")
    ).rows;
    expect(profiles.map((p) => p.property_id).sort()).toEqual([
      "property-a",
      "property-b",
    ]);
    expect(profiles.every((p) => p.body.providerAgentId === null)).toBe(true);
    await expect(
      rt.voice.speak(pubA.token, visitorA.token, vb.token, {
        sequence: 1,
        question: "Salon?",
      }),
    ).rejects.toMatchObject({ code: "VOICE_SCOPE_MISMATCH" });
    await expect(
      rt.voice.speak(pubB.token, visitorA.token, va.token, {
        sequence: 1,
        question: "Salon?",
      }),
    ).rejects.toMatchObject({ code: "VISITOR_SCOPE_MISMATCH" });
    await rt.voice.stop(pubA.token, visitorA.token, va.token);
    await rt.voice.stop(pubB.token, visitorB.token, vb.token);
  });
  it("denies forged publication scope even with a valid app MAC, edited token and old visitor resume", async () => {
    const grant = rt.secrets.verify(pubA.token, "publication");
    await expect(
      rt.releases.resolve(
        rt.secrets.sign({ ...grant, propertyId: "property-b" }),
      ),
    ).rejects.toThrow();
    await expect(
      rt.releases.resolve(pubA.token.slice(0, -2) + "ff"),
    ).rejects.toThrow();
    const otherPub = await rt.releases.publish(
      a,
      (await rt.releases.resolve(pubA.token)).publication.job_id,
    );
    await expect(
      rt.analytics.scope(otherPub.token, visitorA.token),
    ).rejects.toMatchObject({ code: "VISITOR_SCOPE_MISMATCH" });
    await rt.releases.revoke(a, otherPub.id);
    await expect(rt.releases.resolve(otherPub.token)).rejects.toMatchObject({
      code: "PUBLICATION_REVOKED_OR_STALE",
    });
  });
  it("rejects forged tool arguments, client tenant selectors and voice sequence replay", async () => {
    const voice = await rt.voice.start(pubA.token, visitorA.token);
    await expect(
      rt.voice.speak(pubA.token, visitorA.token, voice.token, {
        sequence: 1,
        question: "merhaba",
        organizationId: "atelier",
      }),
    ).rejects.toThrow();
    await expect(
      rt.voice.speak(pubA.token, visitorA.token, voice.token, {
        sequence: 1,
        question: "merhaba",
        currentRoom: "private-b-room",
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_ROOM_CONTEXT" });
    await expect(
      rt.voice.tool(pubA.token, visitorA.token, voice.token, {
        type: "reset_view",
        url: "https://private.invalid",
      }),
    ).rejects.toThrow();
    await expect(
      rt.voice.speak(pubA.token, visitorA.token, voice.token, {
        sequence: 2,
        question: "merhaba",
      }),
    ).rejects.toMatchObject({ code: "VOICE_REPLAY_OR_OUT_OF_ORDER" });
    await rt.voice.stop(pubA.token, visitorA.token, voice.token);
  });
  it("does not invent staging ownership, balcony, dimensions or confirmed appointments", () => {
    const scene = measuredFixture("studio", "property-a", 2, "plan", "user");
    for (const [text, category, contains] of [
      ["merhaba", "intro", "AI rehber"],
      ["mobilya", "staging", "varsaymayın"],
      ["randevu al", "contact", "onaylanmış değildir"],
      ["Balkona götür", "navigation", "doğrulanmış değil"],
      ["Mutfak kaç metrekare?", "measurement", "rakam uydurmayacağım"],
      ["başka mülk hakkında konuş", "security", "kapsamını değiştiremem"],
      ["yasal ruhsat nedir?", "unknown", "doğrulanamıyor"],
    ]) {
      const r = guideReply(scene, text!, "living");
      expect(r.category).toBe(category);
      expect(r.text).toContain(contains);
    }
    expect(guideReply(scene, "Gece ışığını göster", "living").command).toEqual({
      type: "set_daypart",
      daypart: "night",
    });
  });
  it("authenticates optional post-call insights against an issued session and discards commercial/transcript claims", async () => {
    const voice = await rt.voice.start(pubA.token, visitorA.token),
      webhook = new VoiceInsightWebhook(rt.db, rt.secrets);
    const stamp = Math.floor(Date.now() / 1000),
      payload = {
        type: "post_call_transcription",
        event_timestamp: stamp,
        data: {
          conversation_id: "synthetic-conversation-contract-only",
          status: "done",
          metadata: { call_duration_secs: 12 },
          transcript: [{ message: "PRIVATE_DO_NOT_STORE" }],
          analysis: { booking: "confirmed", revenue: 999999 },
        },
      },
      text = JSON.stringify(payload),
      signature = `t=${stamp},v0=${rt.secrets.tenant("studio").mac(stamp + "." + text)}`;
    await expect(webhook.ingest("studio", text, "forged")).rejects.toThrow();
    await expect(
      webhook.ingest("studio", text, signature),
    ).rejects.toMatchObject({ code: "UNISSUED_OR_UNCONSENTED_CONVERSATION" });
    await rt.db.pg.query(
      "update voice_sessions set body=jsonb_set(body,'{providerConversationId}',$3::jsonb) where organization_id=$1 and id=$2",
      ["studio", voice.id, JSON.stringify(payload.data.conversation_id)],
    );
    expect(await webhook.ingest("studio", text, signature)).toMatchObject({
      processed: true,
      realBookingConfirmed: false,
    });
    expect(await webhook.ingest("studio", text, signature)).toMatchObject({
      deduplicated: true,
    });
    const stored = await rt.db.pg.query<{ body: unknown }>(
      "select body from voice_quality_reviews",
    );
    expect(JSON.stringify(stored.rows)).not.toContain("PRIVATE_DO_NOT_STORE");
    expect(JSON.stringify(stored.rows)).not.toContain("999999");
    expect(
      (
        await rt.voice.facts(pubA.token, visitorA.token, voice.token, {
          query: "",
          scope: "current-approved-property",
        })
      ).propertyId,
    ).toBe("property-a");
    await expect(
      rt.voice.facts(pubA.token, visitorA.token, voice.token, {
        query: "",
        scope: "current-approved-property",
        propertyId: "property-b",
      }),
    ).rejects.toThrow();
    await rt.voice.stop(pubA.token, visitorA.token, voice.token);
  });
  it("caps voice concurrency, settles expired reserves once and never records raw transcript", async () => {
    const voices = [];
    for (let i = 0; i < 3; i++)
      voices.push(await rt.voice.start(pubA.token, visitorA.token));
    await expect(
      rt.voice.start(pubA.token, visitorA.token),
    ).rejects.toMatchObject({ code: "VOICE_CONCURRENCY_LIMIT" });
    await rt.db.pg.query(
      "update voice_sessions set expires_at=now()-interval '1 second' where organization_id='studio' and body->>'status'='active'",
    );
    await expect(
      rt.voice.speak(pubA.token, visitorA.token, voices[0]!.token, {
        sequence: 1,
        question: "hello",
      }),
    ).rejects.toMatchObject({ code: "VOICE_SESSION_INACTIVE" });
    expect((await rt.voice.settleExpired()).settled).toBe(3);
    expect((await rt.voice.settleExpired()).settled).toBe(0);
    const calls = await rt.db.pg.query<{ body: Record<string, unknown> }>(
      "select body from voice_tool_calls",
    );
    for (const row of calls.rows)
      expect(Object.keys(row.body)).not.toContain("question");
    expect(
      (
        await rt.db.pg.query<{ reserved: string }>(
          "select reserved::text from credit_accounts where organization_id='studio'",
        )
      ).rows[0]!.reserved,
    ).toBe("0");
  });
  it("rejects missing consent, bot traffic, foreign event scope, old timestamps and replay", async () => {
    const noConsent = await rt.analytics.createVisitor(pubA.token, {
      ...consent,
      analytics: false,
      voice: false,
      contact: false,
    });
    await expect(
      rt.voice.start(pubA.token, noConsent.token),
    ).rejects.toMatchObject({ code: "VOICE_CONSENT_REQUIRED" });
    const event = {
      eventId: newId(),
      name: "listing_viewed",
      timestamp: new Date().toISOString(),
    };
    expect(
      await rt.analytics.ingest(pubA.token, noConsent.token, [event]),
    ).toMatchObject({ accepted: 0 });
    expect(
      await rt.analytics.ingest(pubA.token, visitorA.token, [event], true),
    ).toMatchObject({ accepted: 0, reason: "BOT_POLICY" });
    await expect(
      rt.analytics.ingest(pubB.token, visitorA.token, [event]),
    ).rejects.toMatchObject({ code: "VISITOR_SCOPE_MISMATCH" });
    await expect(
      rt.analytics.ingest(pubA.token, visitorA.token, [
        { ...event, timestamp: "2020-01-01T00:00:00Z" },
      ]),
    ).rejects.toMatchObject({ code: "EVENT_TIME_OUT_OF_RANGE" });
    await rt.analytics.ingest(pubA.token, visitorA.token, [event]);
    expect(
      await rt.analytics.ingest(pubA.token, visitorA.token, [event]),
    ).toMatchObject({ accepted: 0 });
  });
  it("prevents cross-property session references directly at the database FK", async () => {
    await expect(
      rt.db.pg.query(
        "insert into analytics_events(organization_id,id,property_id,revision,session_id,body) values('atelier','bad-fk','property-b',2,$1,'{}')",
        [visitorA.id],
      ),
    ).rejects.toThrow(/foreign key/);
  });
  it("protects lead ownership, per-tenant HMAC CRM conversion and deduplication", async () => {
    const lead = {
      name: "Sentetik",
      contactMethod: "email",
      contact: "test@example.invalid",
      explicitConsent: true,
      consentVersion: "spaces-consent-v1",
      viewingRequested: true,
      idempotencyKey: "security-lead",
    };
    expect(
      await rt.analytics.lead(pubA.token, visitorA.token, lead),
    ).toMatchObject({ bookingConfirmed: false });
    await expect(
      rt.analytics.privateLead(b, lead.idempotencyKey),
    ).rejects.toMatchObject({ code: "LEAD_NOT_FOUND" });
    const samePropertyVisitor = await rt.analytics.createVisitor(
      pubA.token,
      consent,
    );
    await expect(
      rt.analytics.lead(pubA.token, samePropertyVisitor.token, lead),
    ).rejects.toMatchObject({ code: "LEAD_IDEMPOTENCY_CONFLICT" });
    const body = JSON.stringify({
        providerEventId: "crm-test",
        viewingRequestId: lead.idempotencyKey,
        organizationId: "studio",
        status: "confirmed",
        mode: "simulated-crm",
      }),
      t = Math.floor(Date.now() / 1000),
      header = (key: Secrets) => `t=${t},v0=${key.mac(t + "." + body)}`;
    await expect(
      rt.analytics.confirmViewing(body, header(rt.secrets.tenant("atelier"))),
    ).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    expect(
      await rt.analytics.confirmViewing(
        body,
        header(rt.secrets.tenant("studio")),
      ),
    ).toMatchObject({ status: "CONFIRMED_SIMULATED", realBooking: false });
    expect(
      await rt.analytics.confirmViewing(
        body,
        header(rt.secrets.tenant("studio")),
      ),
    ).toMatchObject({ deduplicated: true });
    expect(
      await rt.analytics.privateLead(a, lead.idempotencyKey),
    ).toMatchObject({ contact: "test@example.invalid" });
  });
  it("counts unique sessions instead of repeated launches/leads, and denies analytics roles", async () => {
    const events = Array.from({ length: 4 }, () => ({
      eventId: newId(),
      name: "tour_3d_started",
      timestamp: new Date().toISOString(),
    }));
    await rt.analytics.ingest(pubA.token, visitorA.token, events);
    const from = new Date(Date.now() - 60000).toISOString(),
      to = new Date(Date.now() + 60000).toISOString();
    const data = await rt.analytics.rollup(a, "property-a", from, to);
    expect(data.steps.find((x) => x.key === "tours")?.count).toBe(1);
    expect(data.conversionRate).toBeLessThanOrEqual(1);
    const viewer = await rt.db.actor("demo-viewer-a", "studio");
    await expect(
      rt.analytics.rollup(viewer, null, from, to),
    ).rejects.toMatchObject({ code: "ANALYTICS_ROLE_DENIED" });
    const empty = await rt.analytics.rollup(b, "property-b", from, to);
    expect(empty.totalEvents).toBe(0);
    expect(empty.conversionRate).toBeNull();
    await expect(rt.analytics.rollup(a, null, to, from)).rejects.toMatchObject({
      code: "INVALID_ANALYTICS_WINDOW",
    });
  });
  it("serializes consent withdrawal against concurrent event writes", async () => {
    const visit = await rt.analytics.createVisitor(pubA.token, consent);
    await Promise.all([
      rt.analytics.ingest(pubA.token, visit.token, [
        {
          eventId: newId(),
          name: "listing_viewed",
          timestamp: new Date().toISOString(),
        },
      ]),
      rt.analytics.withdraw(pubA.token, visit.token),
    ]);
    expect(
      (
        await rt.db.pg.query(
          "select id from analytics_events where organization_id='studio' and session_id=$1",
          [visit.id],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("retention deletes expired rows and retrospective consent withdrawal removes events", async () => {
    await rt.db.pg.query(
      "update analytics_events set expires_at=now()-interval '1 second' where organization_id='studio'",
    );
    expect((await rt.analytics.sweep(a)).deleted).toBeGreaterThan(0);
    await rt.analytics.withdraw(pubA.token, visitorA.token);
    expect(
      await rt.analytics.ingest(pubA.token, visitorA.token, []),
    ).toMatchObject({ reason: "NO_ANALYTICS_CONSENT" });
  });
  it("keeps partner A/B child reports separate and never grants child raw media or leads", async () => {
    const north = await rt.db.actor("demo-partner-a", "agency-north"),
      south = await rt.db.actor("demo-partner-b", "agency-south");
    expect(
      (await rt.brands.partnerSummary(north)).assignedChildren.map(
        (c) => c.childOrganizationId,
      ),
    ).toEqual(["studio"]);
    expect(
      (await rt.brands.partnerSummary(south)).assignedChildren.map(
        (c) => c.childOrganizationId,
      ),
    ).toEqual(["atelier"]);
    await expect(rt.properties.get(north, "property-a")).rejects.toMatchObject({
      code: "PROPERTY_NOT_FOUND",
    });
    await expect(
      rt.analytics.privateLead(north, "security-lead"),
    ).rejects.toThrow();
    await expect(rt.db.actor(north.userId, "studio")).rejects.toMatchObject({
      code: "TENANT_ACCESS_DENIED",
    });
  });
  it("rejects theme injection/foreign logo/vanity domains; branding never changes access", async () => {
    const old = await rt.brands.get(a);
    await expect(
      rt.brands.save(a, { ...old, displayName: "<script>" }),
    ).rejects.toThrow();
    const {
      accentText: _text,
      domainStatus: _domain,
      externalDomainVerified: _verified,
      ...theme
    } = old;
    void _text;
    void _domain;
    void _verified;
    await expect(
      rt.brands.save(a, { ...theme, domain: "other-customer.example" }),
    ).rejects.toThrow();
    const foreign = (await rt.properties.assets(b, "property-b"))[0]!;
    await expect(
      rt.brands.save(a, { ...theme, logoAssetId: foreign.id }),
    ).rejects.toMatchObject({ code: "BRAND_ASSET_SCOPE_DENIED" });
    await rt.brands.save(a, {
      ...theme,
      displayName: "Studio Local Brand",
      domain: "studio.localhost",
    });
    expect((await rt.brands.get(a)).externalDomainVerified).toBe(false);
    expect((await rt.brands.get(b)).displayName).toBe("Atelier Collection");
  });
  it("accepts only tenant-signed sandbox callbacks and reconciles duplicates without moving real funds", async () => {
    const sandbox = new SandboxPayments(rt.db, rt.secrets),
      event = {
        organizationId: "studio",
        eventId: "sandbox-event",
        amountMicroUsd: 100,
        mode: "synthetic-sandbox",
        actualFunds: false,
      },
      body = JSON.stringify(event),
      stamp = Math.floor(Date.now() / 1000),
      sign = (text: string) =>
        `t=${stamp},v0=${rt.secrets.tenant("studio").mac(stamp + "." + text)}`;
    await expect(sandbox.callback(body, "forged")).rejects.toThrow();
    expect(await sandbox.callback(body, sign(body))).toMatchObject({
      realFundsMoved: false,
      creditedSimulatedMicroUsd: 100,
    });
    expect(await sandbox.callback(body, sign(body))).toMatchObject({
      deduplicated: true,
    });
    const changed = JSON.stringify({ ...event, amountMicroUsd: 200 });
    await expect(
      sandbox.callback(changed, sign(changed)),
    ).rejects.toMatchObject({ code: "PAYMENT_REPLAY_CONFLICT" });
    const real = JSON.stringify({ ...event, actualFunds: true });
    await expect(sandbox.callback(real, sign(real))).rejects.toThrow();
  });
  it("provisions local child workspaces without parent raw access and requires the child owner's reporting permission", async () => {
    const parent = await rt.db.actor("demo-partner-a", "agency-north");
    const child = await rt.brands.provisionChild(parent, {
      displayName: "Synthetic assigned child",
      ownerSyntheticUserId: "demo-admin-a",
      syntheticOnly: true,
    });
    expect(child.parentMembershipGranted).toBe(false);
    await expect(
      rt.db.actor(parent.userId, child.childOrganizationId),
    ).rejects.toThrow();
    const childOwner = await rt.db.actor(
      "demo-admin-a",
      child.childOrganizationId,
    );
    expect(
      (
        await rt.brands.setChildReporting(
          childOwner,
          parent.organizationId,
          true,
        )
      ).aggregateAllowed,
    ).toBe(true);
    expect(
      (await rt.brands.partnerSummary(parent)).assignedChildren.map(
        (c) => c.childOrganizationId,
      ),
    ).toContain(child.childOrganizationId);
    await expect(
      rt.brands.provisionChild(a, {
        displayName: "not a partner",
        ownerSyntheticUserId: "demo-admin-a",
        syntheticOnly: true,
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZED_PARTNER_REQUIRED" });
  });
  it("recovers worker leases with epoch fencing and releases credits after the bounded final attempt", async () => {
    const job = await rt.jobs.submit(a, {
      propertyId: "property-a",
      revision: 2,
      mode: "pov",
      idempotencyKey: "lease-expiry",
    });
    await rt.db.pg.query(
      "update jobs set state='processing',attempt=2,fence='old-worker',lease_until=now()-interval '1 second' where organization_id=$1 and id=$2",
      [a.organizationId, job.id],
    );
    await rt.jobs.recoverLeases();
    const done = await rt.jobs.get(a, job.id);
    expect(done.state).toBe("failed");
    expect(done.epoch).toBe(1);
    expect(done.fence).toBeNull();
    expect(
      (
        await rt.db.pg.query<{ status: string }>(
          "select status from credit_reservations where organization_id=$1 and job_id=$2",
          [a.organizationId, job.id],
        )
      ).rows[0]!.status,
    ).toBe("released");
    await expect(
      rt.db.pg.query(
        "update credit_accounts set available=-1 where organization_id='studio'",
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("cryptographic, HTTP and disabled provider contracts", () => {
  it("rejects expired/replayed-purpose grants and stale/invalid webhook signatures", () => {
    const secrets = Secrets.ephemeral(),
      grant: Grant = {
        purpose: "asset",
        organizationId: "studio",
        propertyId: "p",
        revision: 1,
        resourceId: "r",
        sessionId: "session",
        nonce: "n",
        expiresAt: Date.now() + 60000,
      };
    const token = secrets.sign(grant);
    expect(secrets.verify(token, "asset")).toEqual(grant);
    expect(() => secrets.verify(token, "voice")).toThrow();
    expect(() => secrets.verify(token, "asset", Date.now() + 120000)).toThrow();
    const t = Math.floor(Date.now() / 1000) - 301,
      body = "{}";
    expect(() =>
      secrets.verifyWebhook(body, `t=${t},v0=${secrets.mac(t + "." + body)}`),
    ).toThrow("STALE_WEBHOOK");
    expect(() => secrets.verifyWebhook(body, "bad")).toThrow();
    const cipher = secrets.tenant("studio").encrypt("synthetic-contact");
    expect(() => secrets.tenant("atelier").decrypt(cipher)).toThrow();
  });
  it("enforces loopback, same-origin mutation and actual streamed byte limit", async () => {
    expect(() =>
      verifyLocalRequest(
        new Request("https://public.invalid/api/spaces/bootstrap"),
      ),
    ).toThrow();
    expect(() =>
      verifyLocalRequest(
        new Request("http://localhost:3000/api/spaces/session", {
          method: "POST",
          headers: { Origin: "https://evil.invalid" },
        }),
      ),
    ).toThrow();
    verifyLocalRequest(
      new Request("http://127.0.0.1:3000/api/spaces/session", {
        method: "POST",
        headers: { Origin: "http://127.0.0.1:3000" },
      }),
    );
    await expect(
      limitedBody(
        new Request("http://localhost", { method: "POST", body: "12345" }),
        4,
      ),
    ).rejects.toThrow();
  });
  it("verifies Supabase-compatible JWT offline and ignores forged role/tenant metadata", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256"),
      issuer = "https://supabase.example.invalid/auth/v1";
    const token = await new SignJWT({
      role: "authenticated",
      app_metadata: { organization_id: "victim", role: "admin" },
    })
      .setProtectedHeader({ alg: "ES256" })
      .setSubject("user-offline")
      .setIssuer(issuer)
      .setAudience("authenticated")
      .setExpirationTime("2m")
      .sign(privateKey);
    expect(await verifySupabaseSession(token, publicKey, issuer)).toMatchObject(
      {
        userId: "user-offline",
        organizationId: null,
        membershipMustBeResolved: true,
        hostedIntegrationEnabled: false,
      },
    );
    await expect(
      verifySupabaseSession(
        token,
        publicKey,
        issuer,
        new Date(Date.now() + 300000),
      ),
    ).rejects.toThrow();
    await expect(
      verifySupabaseSession(token, publicKey, "https://wrong.invalid"),
    ).rejects.toThrow();
  });
  it("keeps vendor routing and ElevenLabs issuance disabled, with no silent paid fallback", async () => {
    const input = {
      organizationId: "studio",
      propertyId: "property-a",
      revision: 2,
      mode: "pov",
      sourceHashes: ["a".repeat(64)],
      maxCostMicroUsd: 0,
      eyeHeightMeters: 1.65,
      firstPerson: true,
      forbiddenClaims: ["unknown balcony"],
    };
    const video = new DisabledVideoAdapter(PROVIDERS.kling);
    await expect(video.submit(video.prepare(input))).rejects.toMatchObject({
      code: "BLOCKED_EXTERNAL_APPROVAL",
    });
    expect(() => video.prepare({ ...input, maxCostMicroUsd: 1 })).toThrow();
    expect(() => video.prepare({ ...input, firstPerson: false })).toThrow();
    expect(() => routeProvider("kling")).toThrow(
      "MODEL_OR_SCHEMA_NOT_VERIFIED",
    );
    expect(() => routeProvider("astra")).toThrow("BLOCKED_EXTERNAL_APPROVAL");
    const scene = measuredFixture("studio", "property-a", 2, "plan", "user");
    await expect(
      new ElevenLabsDisabledProvider().createSession({
        organizationId: "studio",
        propertyId: "property-a",
        revision: 2,
        approvedScene: scene,
        visitorConsent: true,
      }),
    ).rejects.toMatchObject({ code: "BLOCKED_EXTERNAL_APPROVAL" });
    expect(
      prepareSignedRequest({
        dedicatedSpacesAgentId: "agent_syntheticfixture",
        purpose: "spaces-property-guide",
        includeConversationId: true,
      }).path,
    ).toBe("/v1/convai/conversation/get-signed-url");
    expect(() =>
      SignedCredential.parse({ signed_url: "wss://evil.invalid/steal" }),
    ).toThrow();
    expect(
      propertyVariables(scene, "title", "brand", "living").approved_summary,
    ).not.toContain("Atelier");
    expect(() =>
      propertyVariables(scene, "title", "brand", "unknown"),
    ).toThrow();
    expect(
      prepareMarbleRequest({
        display_name: "Local contract only",
        model: "marble-1.1",
        world_prompt: { type: "text", text_prompt: "synthetic" },
      }).enabled,
    ).toBe(false);
    expect(
      MarbleExport.parse({ asset_type: "mesh", format: "glb" }).format,
    ).toBe("glb");
  });
});
