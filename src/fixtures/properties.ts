import type { AssetId, MediaAsset, Organization, OrganizationId, Property, PropertyId } from "@/domain/types";

export const STUDIO_ORG = "org-studio" as OrganizationId;
export const ATELIER_ORG = "org-atelier" as OrganizationId;

export const ORGANIZATIONS: readonly Organization[] = [
  { id: STUDIO_ORG, name: "ArtificAgent Studio", initials: "AS" },
  { id: ATELIER_ORG, name: "Atelier Collection", initials: "AC" },
];

function media(organizationId: OrganizationId, propertyId: PropertyId, hasPlan: boolean): readonly MediaAsset[] {
  const illustrationNames = ["Yaşam alanı", "Mekân detayı", "İkinci bakış"];
  const illustrations = illustrationNames.map((label, index): MediaAsset => ({
    id: (propertyId + "-image-" + (index + 1)) as AssetId,
    organizationId, propertyId, label,
    path: "/illustrations/" + (index === 0 ? propertyId : index === 1 ? "detail" : "interior") + ".svg",
    kind: "illustration", source: "synthetic",
  }));
  return hasPlan ? [...illustrations, {
    id: (propertyId + "-plan") as AssetId, organizationId, propertyId,
    label: "Sentetik ölçülü plan", path: "/illustrations/floor-plan.svg",
    kind: "floor-plan", source: "synthetic",
  }] : illustrations;
}

function property(input: Omit<Property, "media">): Property {
  return Object.freeze({ ...input, media: media(input.organizationId, input.id, input.evidenceClass === "spatial-verified") });
}

export const SYNTHETIC_PROPERTIES: readonly Property[] = Object.freeze([
  property({
    id: "atrium" as PropertyId, organizationId: STUDIO_ORG, name: "Atrium Loft",
    reference: "SP–001", location: "Kurgusal İstanbul", category: "Daire",
    areaM2: 145, rooms: "3+1", cover: "/illustrations/atrium.svg",
    evidenceClass: "spatial-verified", status: "review-ready",
    description: "Yüksek tavanlar, açık bir plan ve gün ışığıyla tanımlanan kurgusal bir loft. Dört akışın tamamını keşfetmek için hazırlanmış sentetik örnek.",
    roomLabels: ["Yaşam alanı", "Mutfak", "Yatak odası", "Antre"],
  }),
  property({
    id: "avlu" as PropertyId, organizationId: STUDIO_ORG, name: "Avlu Evi",
    reference: "SP–002", location: "Kurgusal Urla", category: "Villa",
    areaM2: 240, rooms: "4+1", cover: "/illustrations/avlu.svg",
    evidenceClass: "spatial-verified", status: "draft",
    description: "Sade hacimler ve özel bir avlu etrafında kurgulanmış sentetik konut. Bu çizimler gerçek bir mülke veya müşteriye ait değildir.",
    roomLabels: ["Avlu", "Salon", "Mutfak", "Yatak odası"],
  }),
  property({
    id: "linea" as PropertyId, organizationId: STUDIO_ORG, name: "Linea Residence",
    reference: "SP–003", location: "Kurgusal İstanbul", category: "Daire",
    areaM2: 92, rooms: "2+1", cover: "/illustrations/linea.svg",
    evidenceClass: "visual-evidence", status: "evidence-needed",
    description: "Kent yaşamına odaklanan kurgusal bir daire. Ölçülü planı bulunmadığı için Interactive 3D akışındaki kanıt kontrolünü gösterir.",
    roomLabels: ["Salon", "Mutfak", "Yatak odası"],
  }),
  property({
    id: "suite" as PropertyId, organizationId: ATELIER_ORG, name: "Kıyı Süiti",
    reference: "AC–001", location: "Kurgusal Bodrum", category: "Konaklama",
    areaM2: 68, rooms: "1+1", cover: "/illustrations/suite.svg",
    evidenceClass: "visual-evidence", status: "draft",
    description: "İkinci örnek çalışma alanına ait tamamen sentetik bir konaklama birimi.",
    roomLabels: ["Yaşam alanı", "Yatak odası"],
  }),
]);
