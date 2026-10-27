import { after } from "next/server";
import { z } from "zod";
import { Id, invariant } from "@/domain/platform";
import { getRuntime } from "@/server/runtime";
import { DEMO_IDENTITIES } from "@/server/seed";
import { MEDIA_CAPABILITIES } from "@/domain/media-capabilities";
import { MediaGrantMetadata, UploadSelection } from "@/domain/media-intake";
import { authorize } from "@/server/properties";
import {
  prepareStudioPlan,
  STUDIO_PROVIDER_READINESS,
} from "@/server/studio-planner";
import {
  cookie,
  errorResponse,
  jsonBody,
  limitedBody,
  responseJson,
  sessionCookie,
  verifyLocalRequest,
} from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ segments: string[] }> };
const TourEnvelope = z
  .object({
    publicationToken: z.string().min(20).max(3000),
    data: z.unknown().optional(),
  })
  .strict();

async function handler(request: Request, context: RouteContext) {
  try {
    verifyLocalRequest(request);
    const platform = await getRuntime();
    const { segments } = await context.params;
    const path = segments.join("/"),
      method = request.method,
      url = new URL(request.url);
    if (path === "bootstrap" && method === "GET") {
      let actor = null;
      try {
        actor = await platform.identity.resolve(
          cookie(request, "spaces_session"),
        );
      } catch {
        /* signed out */
      }
      return responseJson({
        actor: actor
          ? {
              userId: actor.userId,
              organizationId: actor.organizationId,
              role: actor.role,
            }
          : null,
        identities: DEMO_IDENTITIES,
        mode: "LOCAL_SYNTHETIC",
        externalSpendMicroUsd: 0,
      });
    }
    if (path === "session" && method === "POST") {
      const input = z
        .object({ identityId: Id })
        .strict()
        .parse(await jsonBody(request));
      const login = await platform.identity.login(input.identityId);
      return responseJson(
        {
          user: login.user,
          organizationId: login.organizationId,
          mode: login.mode,
        },
        200,
        sessionCookie("spaces_session", login.token),
      );
    }
    if (path === "session" && method === "DELETE") {
      const token = cookie(request, "spaces_session");
      if (token) await platform.identity.logout(token);
      return responseJson(
        { signedOut: true },
        200,
        sessionCookie("spaces_session", "", 0),
      );
    }
    if (path.startsWith("tour/") && method === "POST") {
      const body = TourEnvelope.parse(await jsonBody(request));
      const scope = await platform.releases.resolve(body.publicationToken);
      const visitorCookieName = "spaces_tour_" + scope.publication.id;
      if (path === "tour/resolve")
        return responseJson({
          publicationId: scope.publication.id,
          propertyId: scope.publication.property_id,
          title: scope.title,
          scene: scope.scene,
          output: scope.output,
          expiresAt: scope.publication.expires_at,
          brand: await platform.brands.publicBrand(
            scope.publication.organization_id,
          ),
          localOnly: true,
        });
      if (path === "tour/output")
        return new Response(
          new Uint8Array(
            await platform.storage.readVerified(
              scope.publication.organization_id,
              scope.output.artifactId ?? scope.publication.job_id,
              scope.output.sha256,
              "output",
              scope.output.extension,
            ),
          ),
          {
            headers: {
              "Content-Type": scope.output.mime,
              "Cache-Control": "private, no-store",
              "X-Content-Type-Options": "nosniff",
            },
          },
        );
      if (path === "tour/consent") {
        const visitor = await platform.analytics.createVisitor(
          body.publicationToken,
          body.data,
        );
        return responseJson(
          { id: visitor.id, expiresAt: visitor.expiresAt },
          200,
          sessionCookie(visitorCookieName, visitor.token),
        );
      }
      const visitorToken = cookie(request, visitorCookieName);
      invariant(visitorToken, "VISITOR_CONSENT_SESSION_REQUIRED", 401);
      if (path === "tour/events")
        return responseJson(
          await platform.analytics.ingest(
            body.publicationToken,
            visitorToken,
            body.data,
            /bot|crawler|spider/i.test(request.headers.get("user-agent") ?? ""),
          ),
        );
      if (path === "tour/withdraw")
        return responseJson(
          await platform.analytics.withdraw(
            body.publicationToken,
            visitorToken,
          ),
        );
      if (path === "tour/erase")
        return responseJson(
          await platform.analytics.erase(body.publicationToken, visitorToken),
        );
      if (path === "tour/lead")
        return responseJson(
          await platform.analytics.lead(
            body.publicationToken,
            visitorToken,
            body.data,
          ),
        );
      if (path === "tour/voice/start")
        return responseJson(
          await platform.voice.start(body.publicationToken, visitorToken),
        );
      if (path.startsWith("tour/voice/")) {
        const input = z
          .object({
            voiceToken: z.string().max(3000),
            payload: z.unknown().optional(),
          })
          .strict()
          .parse(body.data);
        if (path === "tour/voice/speak")
          return responseJson(
            await platform.voice.speak(
              body.publicationToken,
              visitorToken,
              input.voiceToken,
              input.payload,
            ),
          );
        if (path === "tour/voice/tool")
          return responseJson(
            await platform.voice.tool(
              body.publicationToken,
              visitorToken,
              input.voiceToken,
              input.payload,
            ),
          );
        if (path === "tour/voice/resume")
          return responseJson(
            await platform.voice.resume(
              body.publicationToken,
              visitorToken,
              input.voiceToken,
            ),
          );
        if (path === "tour/voice/facts")
          return responseJson(
            await platform.voice.facts(
              body.publicationToken,
              visitorToken,
              input.voiceToken,
              input.payload,
            ),
          );
        if (path === "tour/voice/stop")
          return responseJson(
            await platform.voice.stop(
              body.publicationToken,
              visitorToken,
              input.voiceToken,
            ),
          );
      }
      invariant(false, "ROUTE_NOT_FOUND", 404);
    }
    if (path === "simulated-crm/webhook" && method === "POST") {
      const body = new TextDecoder().decode(await limitedBody(request, 16384));
      return responseJson(
        await platform.analytics.confirmViewing(
          body,
          request.headers.get("x-spaces-simulated-signature") ?? "",
        ),
      );
    }
    if (path === "voice/elevenlabs-credential")
      invariant(false, "BLOCKED_EXTERNAL_APPROVAL", 403);
    const actor = await platform.identity.resolve(
      cookie(request, "spaces_session"),
    );
    if (path === "workspace" && method === "GET")
      return responseJson({
        actor: {
          userId: actor.userId,
          organizationId: actor.organizationId,
          role: actor.role,
        },
        properties: await platform.properties.list(actor),
        jobs: await platform.jobs.list(actor),
        brand: await platform.brands.get(actor),
        accounts: (
          await platform.db.as(actor, (tx) =>
            tx.query(
              "select available::float8,reserved::float8,currency from credit_accounts where organization_id=$1",
              [actor.organizationId],
            ),
          )
        ).rows,
      });
    if (path === "organizations" && method === "GET")
      return responseJson(await platform.identity.organizations(actor));
    if (path === "organizations" && method === "POST") {
      const body = z
        .object({ name: z.string().min(1).max(100) })
        .strict()
        .parse(await jsonBody(request));
      return responseJson(
        await platform.identity.createOrganization(actor, body.name),
        201,
      );
    }
    if (path === "organizations/switch" && method === "POST") {
      const body = z
        .object({ organizationId: Id })
        .strict()
        .parse(await jsonBody(request));
      return responseJson(
        await platform.identity.switchOrganization(actor, body.organizationId),
      );
    }
    if (path === "invitations/accept" && method === "POST") {
      const value = z
        .object({ organizationId: Id, invitationId: Id })
        .strict()
        .parse(await jsonBody(request));
      return responseJson(
        await platform.identity.acceptInvitation(
          actor,
          value.organizationId,
          value.invitationId,
        ),
      );
    }
    if (path === "invitations" && method === "POST") {
      const body = z
        .object({ userId: Id, role: z.enum(["editor", "reviewer", "viewer"]) })
        .strict()
        .parse(await jsonBody(request));
      return responseJson(
        await platform.identity.invite(actor, body.userId, body.role),
      );
    }
    if (path === "properties" && method === "POST")
      return responseJson(
        await platform.properties.create(actor, await jsonBody(request)),
        201,
      );
    if (segments[0] === "properties" && segments[1]) {
      const propertyId = Id.parse(segments[1]);
      if (segments.length === 2 && method === "GET")
        return responseJson({
          property: await platform.properties.get(actor, propertyId),
          assets: await platform.properties.assets(actor, propertyId),
        });
      if (segments.length === 2 && method === "PATCH") {
        const input = z
          .object({
            expectedRevision: z.number().int().positive(),
            title: z.string().max(120).optional(),
            description: z.string().max(500).optional(),
            archived: z.boolean().optional(),
          })
          .strict()
          .parse(await jsonBody(request));
        return responseJson(
          await platform.properties.revise(
            actor,
            propertyId,
            input.expectedRevision,
            {
              ...(input.title === undefined ? {} : { title: input.title }),
              ...(input.description === undefined
                ? {}
                : { description: input.description }),
              ...(input.archived === undefined
                ? {}
                : { archived: input.archived }),
            },
          ),
        );
      }
      if (segments[2] === "fixture" && method === "POST")
        return responseJson(
          await platform.properties.applySyntheticPlan(actor, propertyId),
        );
      if (segments[2] === "media" && method === "PATCH") {
        const data = z
          .object({
            revision: z.number().int().positive(),
            assetIds: z.array(Id).max(20),
          })
          .strict()
          .parse(await jsonBody(request));
        return responseJson(
          await platform.properties.reorderMedia(
            actor,
            propertyId,
            data.revision,
            data.assetIds,
          ),
        );
      }
      if (segments[2] === "media-grant" && method === "POST") {
        await authorize(platform.db, actor, "edit");
        const data = UploadSelection.parse(await jsonBody(request));
        const property = await platform.properties.get(actor, propertyId);
        invariant(property.revision === data.revision, "STALE_REVISION", 409);
        return responseJson({
          token: platform.secrets.sign({
            purpose: "upload",
            organizationId: actor.organizationId,
            propertyId,
            revision: property.revision,
            resourceId: crypto.randomUUID(),
            sessionId: actor.sessionId,
            nonce: JSON.stringify({
              mime: data.mime,
              byteLength: data.byteLength,
              ...(data.replaceAssetId
                ? { replaceAssetId: data.replaceAssetId }
                : {}),
            }),
            expiresAt:
              Date.now() + MEDIA_CAPABILITIES.uploadGrantSeconds * 1000,
          }),
        });
      }
      if (segments[2] === "media-upload" && method === "POST") {
        const grant = platform.secrets.verify(
          request.headers.get("x-spaces-grant") ?? "",
          "upload",
        );
        const property = await platform.properties.get(actor, propertyId);
        invariant(
          grant.organizationId === actor.organizationId &&
            grant.propertyId === propertyId &&
            grant.revision === property.revision &&
            grant.sessionId === actor.sessionId,
          "UPLOAD_GRANT_SCOPE_DENIED",
          403,
        );
        invariant(
          request.headers.get("x-spaces-rights") ===
            "synthetic-owned-metadata-v1",
          "RIGHTS_ATTESTATION_REQUIRED",
          403,
        );
        const meta = MediaGrantMetadata.parse(JSON.parse(grant.nonce));
        invariant(
          request.headers.get("content-type") === meta.mime,
          "MEDIA_TYPE_MISMATCH",
          415,
        );
        const bytes = await limitedBody(request, meta.byteLength);
        invariant(
          bytes.length === meta.byteLength,
          "MEDIA_LENGTH_MISMATCH",
          422,
        );
        return responseJson(
          await platform.properties.upload(
            actor,
            propertyId,
            bytes,
            meta.mime === "video/mp4" ? "walkthrough" : "photo",
            {
              syntheticOnly: true,
              ownedOrLicensed: true,
              metadataRemovalAccepted: true,
            },
            grant.resourceId,
            {
              revision: grant.revision,
              mime: meta.mime,
              signal: request.signal,
              ...(meta.replaceAssetId
                ? { replaceAssetId: meta.replaceAssetId }
                : {}),
            },
          ),
          201,
        );
      }
      if (segments[2] === "upload-grant" && method === "POST") {
        await authorize(platform.db, actor, "edit");
        const property = await platform.properties.get(actor, propertyId);
        return responseJson({
          token: platform.secrets.sign({
            purpose: "upload",
            organizationId: actor.organizationId,
            propertyId,
            revision: property.revision,
            resourceId: crypto.randomUUID(),
            sessionId: actor.sessionId,
            nonce: crypto.randomUUID(),
            expiresAt:
              Date.now() + MEDIA_CAPABILITIES.uploadGrantSeconds * 1000,
          }),
          maxBytes: MEDIA_CAPABILITIES.photo.maxBytes,
          accepted: ["image/jpeg", "image/png", "image/webp"],
        });
      }
      if (segments[2] === "upload" && method === "POST") {
        const grant = platform.secrets.verify(
          request.headers.get("x-spaces-grant") ?? "",
          "upload",
        );
        const property = await platform.properties.get(actor, propertyId);
        invariant(
          grant.organizationId === actor.organizationId &&
            grant.propertyId === propertyId &&
            grant.revision === property.revision &&
            grant.sessionId === actor.sessionId,
          "UPLOAD_GRANT_SCOPE_DENIED",
          403,
        );
        invariant(
          request.headers.get("x-spaces-rights") ===
            "synthetic-owned-metadata-v1",
          "RIGHTS_ATTESTATION_REQUIRED",
          403,
        );
        const kind = z
          .enum(["photo", "floor-plan", "panorama"])
          .parse(request.headers.get("x-asset-kind"));
        return responseJson(
          await platform.properties.upload(
            actor,
            propertyId,
            await limitedBody(request, MEDIA_CAPABILITIES.photo.maxBytes),
            kind,
            {
              syntheticOnly: true,
              ownedOrLicensed: true,
              metadataRemovalAccepted: true,
            },
            grant.resourceId,
          ),
          201,
        );
      }
    }
    if (path === "operations/drain" && method === "POST") {
      await authorize(platform.db, actor, "admin");
      after(async () => {
        await platform.jobs.processNext();
        await platform.voice.settleExpired();
      });
      return responseJson({ scheduled: true, externalSpendMicroUsd: 0 }, 202);
    }
    if (path === "studio/provider-readiness" && method === "GET") {
      await authorize(platform.db, actor, "admin");
      return responseJson(STUDIO_PROVIDER_READINESS);
    }
    if (
      (path === "studio/plan" || path === "studio/submit") &&
      method === "POST"
    ) {
      const plan = await prepareStudioPlan(
        platform.db,
        platform.properties,
        actor,
        await jsonBody(request),
      );
      invariant(path !== "studio/submit", "BLOCKED_EXTERNAL_APPROVAL", 403);
      return responseJson(plan);
    }
    if (path === "quote" && method === "POST")
      return responseJson(platform.jobs.quote(await jsonBody(request)));
    if (path === "jobs" && method === "POST") {
      const job = await platform.jobs.submit(actor, await jsonBody(request));
      after(async () => {
        for (let i = 0; i < 3; i++)
          if (!(await platform.jobs.processNext())) break;
        await platform.voice.settleExpired();
      });
      return responseJson(job, 202);
    }
    if (segments[0] === "jobs" && segments[1]) {
      const id = Id.parse(segments[1]);
      if (segments.length === 2 && method === "GET")
        return responseJson(await platform.jobs.get(actor, id));
      if (segments[2] === "cancel" && method === "POST") {
        await platform.jobs.cancel(actor, id);
        return responseJson({ cancelled: true });
      }
      if (segments[2] === "review" && method === "POST")
        return responseJson(
          await platform.releases.review(actor, id, await jsonBody(request)),
        );
      if (segments[2] === "publish" && method === "POST")
        return responseJson(await platform.releases.publish(actor, id));
      if (segments[2] === "download-grant" && method === "POST")
        return responseJson({
          token: await platform.releases.outputGrant(actor, id),
        });
      if (segments[2] === "preview-grant" && method === "POST") {
        await authorize(platform.db, actor, "edit");
        const job = await platform.jobs.get(actor, id);
        const property = await platform.properties.get(actor, job.property_id);
        invariant(
          job.created_by === actor.userId &&
            job.state === "awaiting-review" &&
            job.revision === property.revision,
          "PREVIEW_SCOPE_DENIED",
          403,
        );
        return responseJson({
          token: platform.secrets.sign({
            purpose: "output",
            organizationId: actor.organizationId,
            propertyId: job.property_id,
            revision: job.revision,
            resourceId: id,
            sessionId: actor.sessionId,
            nonce: "author-preview",
            expiresAt:
              Date.now() + MEDIA_CAPABILITIES.uploadGrantSeconds * 1000,
          }),
        });
      }
      if (segments[2] === "review-grant" && method === "POST") {
        await authorize(platform.db, actor, "review");
        const job = await platform.jobs.get(actor, id);
        const property = await platform.properties.get(actor, job.property_id);
        invariant(
          job.state === "awaiting-review" &&
            job.output &&
            job.revision === property.revision,
          "CANDIDATE_NOT_AVAILABLE",
          403,
        );
        return responseJson({
          token: platform.secrets.sign({
            purpose: "output",
            organizationId: actor.organizationId,
            propertyId: property.id,
            revision: job.revision,
            resourceId: id,
            sessionId: actor.sessionId,
            nonce: "review-candidate",
            expiresAt:
              Date.now() + MEDIA_CAPABILITIES.uploadGrantSeconds * 1000,
          }),
        });
      }
      if (
        (segments[2] === "output" || segments[2] === "clips") &&
        method === "GET"
      ) {
        const grant = platform.secrets.verify(
          request.headers.get("x-spaces-grant") ??
            url.searchParams.get("grant") ??
            "",
          "output",
        );
        const job = await platform.jobs.get(actor, id);
        const property = await platform.properties.get(actor, job.property_id);
        invariant(
          grant.organizationId === actor.organizationId &&
            grant.sessionId === actor.sessionId &&
            grant.resourceId === id &&
            grant.propertyId === property.id &&
            grant.revision === property.revision &&
            job.output,
          "OUTPUT_GRANT_SCOPE_DENIED",
          403,
        );
        if (grant.nonce === "author-preview") {
          await authorize(platform.db, actor, "edit");
          invariant(
            job.state === "awaiting-review" && job.created_by === actor.userId,
            "PREVIEW_SCOPE_DENIED",
            403,
          );
        } else if (grant.nonce === "review-candidate") {
          await authorize(platform.db, actor, "review");
          invariant(
            job.state === "awaiting-review",
            "CANDIDATE_NOT_AVAILABLE",
            403,
          );
        } else
          invariant(job.state === "approved", "APPROVED_OUTPUT_REQUIRED", 403);
        const clip =
          segments[2] === "clips"
            ? job.output.photoComposition?.clips.find(
                (c) => String(c.order) === segments[3],
              )
            : undefined;
        invariant(
          segments[2] !== "clips" || (segments.length === 4 && clip),
          "CLIP_NOT_FOUND",
          404,
        );
        const bytes = await platform.storage.readVerified(
          actor.organizationId,
          clip?.artifactId ?? job.output.artifactId ?? id,
          clip?.sha256 ?? job.output.sha256,
          "output",
          clip ? "mp4" : job.output.extension,
        );
        return new Response(new Uint8Array(bytes), {
          headers: {
            "Content-Type": job.output.mime,
            "Content-Disposition": `inline; filename="${id}.${job.output.extension}"`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }
    if (segments[0] === "assets" && segments[1]) {
      const assetId = Id.parse(segments[1]);
      const asset = (
        await platform.db.as(actor, (tx) =>
          tx.query<{ property_id: string; clean_hash: string; mime: string }>(
            "select property_id,clean_hash,mime from assets where organization_id=$1 and id=$2 and status='clean'",
            [actor.organizationId, assetId],
          ),
        )
      ).rows[0];
      invariant(asset, "ASSET_NOT_FOUND", 404);
      const property = await platform.properties.get(actor, asset.property_id);
      const currentMedia = await platform.db.as(actor, (tx) =>
        tx.query(
          "select asset_id from property_media_revisions where organization_id=$1 and property_id=$2 and revision=$3 and asset_id=$4",
          [actor.organizationId, property.id, property.revision, assetId],
        ),
      );
      invariant(
        currentMedia.rows.length > 0,
        "ASSET_NOT_IN_CURRENT_REVISION",
        403,
      );
      if (segments[2] === "grant" && method === "POST")
        return responseJson({
          token: platform.secrets.sign({
            purpose: "asset",
            organizationId: actor.organizationId,
            propertyId: property.id,
            revision: property.revision,
            resourceId: assetId,
            sessionId: actor.sessionId,
            nonce: crypto.randomUUID(),
            expiresAt:
              Date.now() + MEDIA_CAPABILITIES.uploadGrantSeconds * 1000,
          }),
        });
      if (segments.length === 2 && method === "GET") {
        const grant = platform.secrets.verify(
          request.headers.get("x-spaces-grant") ??
            url.searchParams.get("grant") ??
            "",
          "asset",
        );
        invariant(
          grant.organizationId === actor.organizationId &&
            grant.resourceId === assetId &&
            grant.propertyId === property.id &&
            grant.revision === property.revision &&
            grant.sessionId === actor.sessionId,
          "ASSET_GRANT_SCOPE_DENIED",
          403,
        );
        return new Response(
          new Uint8Array(
            await platform.storage.readVerified(
              actor.organizationId,
              assetId,
              asset.clean_hash,
              "source",
              asset.mime === "video/mp4" ? "mp4" : "jpg",
            ),
          ),
          {
            headers: {
              "Content-Type": asset.mime,
              "Cache-Control": "private, no-store",
              "X-Content-Type-Options": "nosniff",
            },
          },
        );
      }
    }
    if (path === "analytics" && method === "GET")
      return responseJson(
        await platform.analytics.rollup(
          actor,
          url.searchParams.get("propertyId"),
          url.searchParams.get("from") ??
            new Date(Date.now() - 7 * 86400000).toISOString(),
          url.searchParams.get("to") ?? new Date().toISOString(),
        ),
      );
    if (path === "analytics/export" && method === "GET") {
      const csv = await platform.analytics.exportAggregate(
        actor,
        url.searchParams.get("propertyId"),
        url.searchParams.get("from") ??
          new Date(Date.now() - 7 * 86400000).toISOString(),
        url.searchParams.get("to") ?? new Date().toISOString(),
      );
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=spaces-aggregate.csv",
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (path === "brands" && method === "GET")
      return responseJson(await platform.brands.get(actor));
    if (path === "brands" && method === "POST")
      return responseJson(
        await platform.brands.save(actor, await jsonBody(request)),
      );
    if (path === "partner/children" && method === "POST")
      return responseJson(
        await platform.brands.provisionChild(actor, await jsonBody(request)),
        201,
      );
    if (path === "partner/reporting-permission" && method === "POST") {
      const value = z
        .object({ parentOrganizationId: Id, allowed: z.boolean() })
        .strict()
        .parse(await jsonBody(request));
      return responseJson(
        await platform.brands.setChildReporting(
          actor,
          value.parentOrganizationId,
          value.allowed,
        ),
      );
    }
    if (
      segments[0] === "publications" &&
      segments[1] &&
      segments[2] === "revoke" &&
      method === "POST"
    ) {
      await platform.releases.revoke(actor, Id.parse(segments[1]));
      return responseJson({ revoked: true });
    }
    if (path === "partner" && method === "GET")
      return responseJson(await platform.brands.partnerSummary(actor));
    if (path === "retention/sweep" && method === "POST")
      return responseJson(await platform.analytics.sweep(actor));
    if (path === "support/grant" && method === "POST")
      return responseJson(
        await platform.brands.supportGrant(actor, await jsonBody(request)),
      );
    if (path === "credits" && method === "GET") {
      await authorize(platform.db, actor, "admin");
      return responseJson({
        accounts: (
          await platform.db.as(actor, (tx) =>
            tx.query(
              "select available::text,reserved::text,currency from credit_accounts where organization_id=$1",
              [actor.organizationId],
            ),
          )
        ).rows,
        events: (
          await platform.db.as(actor, (tx) =>
            tx.query(
              "select kind,amount::text,created_at from cost_ledger where organization_id=$1 order by created_at desc limit 50",
              [actor.organizationId],
            ),
          )
        ).rows,
        voiceEvents: (
          await platform.db.as(actor, (tx) =>
            tx.query(
              "select body,created_at from voice_cost_events where organization_id=$1 order by created_at desc limit 50",
              [actor.organizationId],
            ),
          )
        ).rows,
        externalSpendMicroUsd: 0,
      });
    }
    invariant(false, "ROUTE_NOT_FOUND", 404);
  } catch (error) {
    return errorResponse(error);
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
