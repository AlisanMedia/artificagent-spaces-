import { z } from "zod";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Transaction } from "@electric-sql/pglite";
import {
  CreateProperty,
  Id,
  invariant,
  permits,
  validateScene,
  type Scene,
} from "@/domain/platform";
import { newId, digest } from "./crypto";
import type { Actor, Database } from "./database";
import type { LocalPrivateStorage } from "./storage";
import { emptyManifest, measuredFixture } from "./seed";

export interface PropertyRecord {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  revision: number;
  archived: boolean;
  created_by: string;
  manifest: Scene;
}
export interface AssetRecord {
  id: string;
  property_id: string;
  kind: string;
  status: string;
  clean_hash: string;
  width: number;
  height: number;
  mime: string;
  bytes: number;
}
export async function authorize(
  db: Database,
  actor: Actor,
  action: "read" | "edit" | "review" | "admin",
) {
  const current = await db.actor(
    actor.userId,
    actor.organizationId,
    actor.sessionId,
  );
  invariant(permits(current.role, action), "ROLE_DENIED", 403);
  return current;
}
export async function audit(
  tx: Transaction,
  actor: Actor,
  action: string,
  id: string,
) {
  await tx.query(
    "insert into audit_log(organization_id,id,actor_id,action,resource_id) values($1,$2,$3,$4,$5)",
    [actor.organizationId, newId(), actor.userId, action, id],
  );
}
export class PropertyService {
  constructor(
    readonly db: Database,
    readonly storage: LocalPrivateStorage,
  ) {}
  async list(actor: Actor) {
    await authorize(this.db, actor, "read");
    const result = await this.db.as(actor, (tx) =>
      tx.query<Omit<PropertyRecord, "manifest">>(
        "select * from properties where organization_id=$1 and not archived order by created_at desc,id",
        [actor.organizationId],
      ),
    );
    return result.rows;
  }
  async get(actor: Actor, id: string): Promise<PropertyRecord> {
    Id.parse(id);
    await authorize(this.db, actor, "read");
    const result = await this.db.as(actor, (tx) =>
      tx.query<PropertyRecord>(
        "select p.*,r.manifest from properties p join property_revisions r on r.organization_id=p.organization_id and r.property_id=p.id and r.revision=p.revision where p.organization_id=$1 and p.id=$2 and not p.archived",
        [actor.organizationId, id],
      ),
    );
    const row = result.rows[0];
    invariant(row, "PROPERTY_NOT_FOUND", 404);
    return { ...row, manifest: validateScene(row.manifest) };
  }
  async create(actor: Actor, input: unknown, requestedId: string = newId()) {
    await authorize(this.db, actor, "edit");
    const value = CreateProperty.parse(input);
    const id = Id.parse(requestedId),
      manifest = emptyManifest(actor.organizationId, id, 1);
    await this.db.as(actor, async (tx) => {
      await tx.query(
        "insert into properties(organization_id,id,title,description,synthetic_only,created_by) values($1,$2,$3,$4,true,$5)",
        [
          actor.organizationId,
          id,
          value.title,
          value.description,
          actor.userId,
        ],
      );
      await tx.query(
        "insert into property_revisions(organization_id,property_id,revision,manifest,created_by) values($1,$2,1,$3,$4)",
        [actor.organizationId, id, JSON.stringify(manifest), actor.userId],
      );
      await audit(tx, actor, "property.created", id);
    });
    return this.get(actor, id);
  }
  async revise(
    actor: Actor,
    id: string,
    expectedRevision: number,
    update: {
      title?: string;
      description?: string;
      manifest?: Scene;
      archived?: boolean;
    },
  ) {
    await authorize(this.db, actor, "edit");
    const current = await this.get(actor, id);
    invariant(current.revision === expectedRevision, "STALE_REVISION", 409);
    const value = CreateProperty.parse({
      title: update.title ?? current.title,
      description: update.description ?? current.description,
      syntheticOnly: true,
    });
    const next = validateScene({
      ...(update.manifest ?? current.manifest),
      revision: current.revision + 1,
      organizationId: actor.organizationId,
      propertyId: id,
    });
    await this.db.as(actor, async (tx) => {
      const result = await tx.query(
        "update properties set title=$3,description=$4,revision=revision+1,archived=$5 where organization_id=$1 and id=$2 and revision=$6 returning id",
        [
          actor.organizationId,
          id,
          value.title,
          value.description,
          update.archived ?? false,
          expectedRevision,
        ],
      );
      invariant(result.rows.length === 1, "STALE_REVISION", 409);
      await tx.query(
        "insert into property_revisions(organization_id,property_id,revision,manifest,created_by) values($1,$2,$3,$4,$5)",
        [
          actor.organizationId,
          id,
          next.revision,
          JSON.stringify(next),
          actor.userId,
        ],
      );
      await audit(
        tx,
        actor,
        update.archived ? "property.archived" : "property.revised",
        id,
      );
    });
    return { id, revision: next.revision };
  }
  async assets(actor: Actor, propertyId: string) {
    await this.get(actor, propertyId);
    return (
      await this.db.as(actor, (tx) =>
        tx.query<AssetRecord>(
          "select id,property_id,kind,status,clean_hash,width,height,mime,bytes from assets where organization_id=$1 and property_id=$2 order by created_at",
          [actor.organizationId, propertyId],
        ),
      )
    ).rows;
  }
  async upload(
    actor: Actor,
    propertyId: string,
    bytes: Uint8Array,
    kind: "photo" | "floor-plan" | "panorama",
    rights: unknown,
    requestedId: string = newId(),
  ) {
    await authorize(this.db, actor, "edit");
    await this.get(actor, propertyId);
    z.object({
      syntheticOnly: z.literal(true),
      ownedOrLicensed: z.literal(true),
      metadataRemovalAccepted: z.literal(true),
    })
      .strict()
      .parse(rights);
    invariant(
      bytes.byteLength > 0 && bytes.byteLength <= 5_242_880,
      "UPLOAD_SIZE_LIMIT",
      413,
    );
    const id = Id.parse(requestedId);
    invariant(
      !(
        await this.db.as(actor, (tx) =>
          tx.query("select id from assets where organization_id=$1 and id=$2", [
            actor.organizationId,
            id,
          ]),
        )
      ).rows.length,
      "UPLOAD_GRANT_ALREADY_USED",
      409,
    );
    await this.db.as(actor, async (tx) => {
      await tx.query(
        "select id from properties where organization_id=$1 and id=$2 for update",
        [actor.organizationId, propertyId],
      );
      const usage = await tx.query<{ bytes: string; count: string }>(
        "select coalesce(sum(bytes),0)::text as bytes,count(*)::text as count from assets where organization_id=$1 and property_id=$2",
        [actor.organizationId, propertyId],
      );
      invariant(
        Number(usage.rows[0]!.bytes) + bytes.byteLength <= 52_428_800 &&
          Number(usage.rows[0]!.count) < 20,
        "PROPERTY_UPLOAD_QUOTA",
        429,
      );
      await tx.query(
        "insert into assets(organization_id,property_id,id,kind,status,original_hash,bytes,mime,rights,created_by) values($1,$2,$3,$4,'quarantine',$5,$6,'application/octet-stream',$7,$8)",
        [
          actor.organizationId,
          propertyId,
          id,
          kind,
          digest(bytes),
          bytes.byteLength,
          JSON.stringify(rights),
          actor.userId,
        ],
      );
    });
    try {
      const clean = await this.storage.ingest(actor.organizationId, id, bytes);
      await this.db.as(actor, (tx) =>
        tx.query(
          "update assets set status='clean',clean_hash=$3,bytes=$4,width=$5,height=$6,mime=$7 where organization_id=$1 and id=$2 and status='quarantine'",
          [
            actor.organizationId,
            id,
            clean.cleanHash,
            clean.bytes,
            clean.width,
            clean.height,
            clean.mime,
          ],
        ),
      );
      return { id, ...clean };
    } catch (error) {
      await this.db.as(actor, (tx) =>
        tx.query(
          "update assets set status='rejected' where organization_id=$1 and id=$2",
          [actor.organizationId, id],
        ),
      );
      throw error;
    }
  }
  async applySyntheticPlan(actor: Actor, propertyId: string) {
    const property = await this.get(actor, propertyId);
    await authorize(this.db, actor, "edit");
    const png = await sharp(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="900"><rect width="1000" height="900" fill="#eee8dc"/><path d="M50 50H950V500H590V850H50Z M590 50V500 M50 500H590" fill="none" stroke="#272725" stroke-width="12"/><text x="120" y="250" font-size="40">SYNTHETIC • 6m x 5m</text><text x="650" y="250" font-size="30">4m x 5m</text><text x="120" y="700" font-size="32">6m x 4m</text></svg>',
      ),
    )
      .png()
      .toBuffer();
    const plan = await this.upload(actor, propertyId, png, "floor-plan", {
      syntheticOnly: true,
      ownedOrLicensed: true,
      metadataRemovalAccepted: true,
    });
    const manifest = measuredFixture(
      actor.organizationId,
      propertyId,
      property.revision + 1,
      plan.id,
      actor.userId,
    );
    await this.revise(actor, propertyId, property.revision, { manifest });
    const illustration = await sharp(
      await readFile(join(process.cwd(), "public/illustrations/interior.svg")),
    )
      .png()
      .toBuffer();
    await this.upload(actor, propertyId, illustration, "photo", {
      syntheticOnly: true,
      ownedOrLicensed: true,
      metadataRemovalAccepted: true,
    });
    return this.get(actor, propertyId);
  }
}
