import type { Database } from "./database";
import { Brand, validateScene, type Scene } from "@/domain/platform";

export const DEMO_IDENTITIES = [
  {
    id: "demo-admin-a",
    label: "Studio • yönetici",
    organizationId: "studio",
    role: "admin",
  },
  {
    id: "demo-editor-a",
    label: "Studio • editör",
    organizationId: "studio",
    role: "editor",
  },
  {
    id: "demo-reviewer-a",
    label: "Studio • bağımsız incelemeci",
    organizationId: "studio",
    role: "reviewer",
  },
  {
    id: "demo-viewer-a",
    label: "Studio • görüntüleyici",
    organizationId: "studio",
    role: "viewer",
  },
  {
    id: "demo-admin-b",
    label: "Atelier • yönetici",
    organizationId: "atelier",
    role: "admin",
  },
  {
    id: "demo-reviewer-b",
    label: "Atelier • incelemeci",
    organizationId: "atelier",
    role: "reviewer",
  },
  {
    id: "demo-partner-a",
    label: "North • partner",
    organizationId: "agency-north",
    role: "admin",
  },
  {
    id: "demo-partner-b",
    label: "South • partner",
    organizationId: "agency-south",
    role: "admin",
  },
] as const;
export async function seedIdentity(db: Database) {
  await db.ready();
  await db.pg.transaction(async (tx) => {
    for (const [id, name] of [
      ["studio", "ArtificAgent Studio"],
      ["atelier", "Atelier Collection"],
      ["agency-north", "North Agency"],
      ["agency-south", "South Agency"],
    ]) {
      await tx.query(
        "insert into organizations(id,name,created_by) values($1,$2,$3) on conflict do nothing",
        [
          id,
          name,
          id === "studio"
            ? "demo-admin-a"
            : id === "atelier"
              ? "demo-admin-b"
              : id === "agency-north"
                ? "demo-partner-a"
                : "demo-partner-b",
        ],
      );
      await tx.query(
        "insert into credit_accounts(organization_id,available,reserved) values($1,10000000,0) on conflict do nothing",
        [id],
      );
      const theme = Brand.parse({
        displayName: name,
        accent: id === "atelier" ? "#d4c2a5" : "#f4f0e8",
        language: "tr",
        voiceName: id === "atelier" ? "Atelier rehberi" : "Spaces rehberi",
        domain: id === "atelier" ? "atelier.localhost" : null,
      });
      await tx.query(
        "insert into white_label_brands(organization_id,id,body) values($1,'default',$2) on conflict do nothing",
        [id, JSON.stringify(theme)],
      );
    }
    for (const user of DEMO_IDENTITIES) {
      await tx.query(
        "insert into spaces_private.users(id,label) values($1,$2) on conflict do nothing",
        [user.id, user.label],
      );
      await tx.query(
        "insert into memberships values($1,$2,$3) on conflict do nothing",
        [user.organizationId, user.id, user.role],
      );
    }
    await tx.exec(
      "insert into partner_assignments values('agency-north','studio',true),('agency-south','atelier',true) on conflict do nothing",
    );
    for (const id of ["agency-north", "agency-south"]) await tx.query("insert into partner_workspaces(organization_id,id,body) values($1,'default',$2) on conflict do nothing", [id, JSON.stringify({kind:"synthetic-reseller",active:true,commission:"NOT_CONTRACTED",rawChildAccess:false})]);
  });
}
export function emptyManifest(
  organizationId: string,
  propertyId: string,
  revision: number,
): Scene {
  return {
    schemaVersion: 1,
    organizationId,
    propertyId,
    revision,
    source: "synthetic",
    measuredBy: null,
    evidenceIds: [],
    rooms: [],
    doors: [],
    facts: [],
    pois: [],
    unknownRegions: ["Ölçü ve plan henüz doğrulanmadı"],
    dayparts: [],
    calibratedLighting: false,
  };
}
export function measuredFixture(
  organizationId: string,
  propertyId: string,
  revision: number,
  planId: string,
  measuredBy: string,
): Scene {
  return validateScene({
    schemaVersion: 1,
    organizationId,
    propertyId,
    revision,
    source: "synthetic",
    measuredBy,
    evidenceIds: [planId],
    rooms: [
      {
        id: "living",
        label: "Salon",
        x: 0,
        z: 0,
        width: 6,
        depth: 5,
        height: 3,
        truth: "E2",
        evidenceIds: [planId],
        material: "oak",
      },
      {
        id: "kitchen",
        label: "Mutfak",
        x: 6,
        z: 0,
        width: 4,
        depth: 5,
        height: 3,
        truth: "E2",
        evidenceIds: [planId],
        material: "stone",
      },
      {
        id: "bedroom",
        label: "Yatak odası",
        x: 0,
        z: 5,
        width: 6,
        depth: 4,
        height: 3,
        truth: "E2",
        evidenceIds: [planId],
        material: "oak",
      },
    ],
    doors: [
      {
        id: "door-kitchen",
        from: "living",
        to: "kitchen",
        axis: "x",
        at: 6,
        center: 2.5,
        width: 1.2,
        evidenceIds: [planId],
      },
      {
        id: "door-bedroom",
        from: "living",
        to: "bedroom",
        axis: "z",
        at: 5,
        center: 3,
        width: 1.2,
        evidenceIds: [planId],
      },
    ],
    facts: [
      {
        id: "living-area",
        roomId: "living",
        label: "Salon alanı",
        value: 30,
        truth: "E2",
        evidenceIds: [planId],
        staged: false,
      },
      {
        id: "fixture-origin",
        label: "Kaynak",
        value:
          organizationId === "atelier"
            ? "Yalnız Atelier B sentetik koleksiyonu"
            : "Studio A sentetik ölçülü planı",
        truth: "E2",
        evidenceIds: [planId],
        staged: false,
      },
      {
        id: "staging",
        roomId: "living",
        label: "Sahne dekorasyonu",
        value:
          "Mobilyalar sanal gösterimdir; satışa dahil oldukları doğrulanmamıştır.",
        truth: "E1",
        evidenceIds: [planId],
        staged: true,
      },
    ],
    pois: [
      {
        id: "material-oak",
        roomId: "living",
        label: "Sanal meşe zemin",
        x: 2,
        z: 2,
        truth: "E2",
        evidenceIds: [planId],
      },
    ],
    unknownRegions: ["Dış cephe, balkon ve çevre görüşü doğrulanmamıştır"],
    dayparts: ["morning", "noon", "evening", "night"],
    calibratedLighting: false,
  });
}
