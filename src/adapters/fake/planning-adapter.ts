import type { PlanningAdapter } from "@/contracts/ports";
import type { PreviewPlan, PreviewRequest, Property, StoryboardShot } from "@/domain/types";

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const DIRECTIONS = {
  pov: ["Göz hizasında sakin giriş", "Kaynak görsel içinde yavaş yaklaşma", "Mekân detayına sabit bakış", "Giriş kadrajına dönüş"],
  cinematic: ["Mekânı tanıtan geniş kadraj", "Malzeme ve ışık detayı", "Dengeli sabit kompozisyon", "Sade kapanış kadrajı"],
  hybrid: ["POV ile sakin giriş", "Sinematik detay kadrajı", "POV ile mekâna geri bakış", "Sinematik kapanış"],
  "interactive-3d": ["Oda sınırları için yer tutucu", "Çarpışma kontrolü için yer tutucu", "Aydınlatma durumu taslağı", "Gezinme kontrolü taslağı"],
} as const;

export class DeterministicPlanningAdapter implements PlanningAdapter {
  readonly id = "deterministic-local-fake" as const;
  readonly supportedModes = ["pov", "cinematic", "hybrid", "interactive-3d"] as const;

  plan(request: PreviewRequest, property: Property): PreviewPlan {
    const mode = request.configuration.mode;
    const selectedAssets = property.media.filter((asset) => asset.kind === "illustration" && request.sourceAssetIds.includes(asset.id));
    const shots = DIRECTIONS[mode].map((direction, index): StoryboardShot => ({
      sequence: index + 1,
      roomLabel: property.roomLabels[index % property.roomLabels.length] ?? property.name,
      direction,
      sourceAssetId: selectedAssets[index % selectedAssets.length]!.id,
    }));
    return {
      id: "preview-" + stableHash(JSON.stringify({
        organizationId: request.organizationId, propertyId: request.propertyId,
        assets: [...request.sourceAssetIds].sort(), configuration: request.configuration,
      })),
      organizationId: request.organizationId, propertyId: request.propertyId,
      mode, configuration: { ...request.configuration },
      kind: mode === "interactive-3d" ? "scene-plan" : "storyboard",
      adapter: this.id, syntheticOnly: true, actualCostMicroUsd: 0,
      disclosure: "Yalnız sentetik verilerle hazırlanan yerel akış önizlemesi. Video veya gezilebilir 3D üretilmemiştir.",
      shots,
      checks: ["Sentetik kaynaklar eşleştirildi", "Seçenekler yerel olarak doğrulandı", "İnceleme taslağı hazır"],
    };
  }
}
