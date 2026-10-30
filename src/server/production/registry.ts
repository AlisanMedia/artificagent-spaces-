import {
  SERVICE_IDS,
  type ProductionServiceId,
  type ServiceOptions,
} from "@/domain/production-services";
import { invariant } from "@/domain/platform";
import { PROFILE_VERSIONS } from "./prompts";

export interface ProductionDefinition {
  readonly id: ProductionServiceId;
  readonly labelTR: string;
  readonly provider: "fal" | "pedra" | "worldlabs" | "composition";
  readonly endpoint: string;
  readonly profileVersion: string;
  readonly schemaRef: string;
  readonly schemaRevision: "official-2026-10-30" | "internal-v1";
  readonly output:
    | "video/mp4"
    | "image"
    | "private-world"
    | "hosted-360"
    | "bundle";
  readonly permittedChanges: readonly string[];
  readonly riskTags: readonly string[];
  readonly optionKeys: readonly (keyof ServiceOptions)[];
  readonly disclosure: string;
  readonly liveEnabled: false;
  readonly requiresIndependentReview: true;
}
const rows = [
  [
    "V01",
    "Doğal Tur",
    "fal",
    "kling/v4/image-to-video",
    "fal-kling",
    "video/mp4",
    ["camera_motion"],
    [
      "WARP_DOORS",
      "EXPANDING_ROOM",
      "WINDOW_DRIFT",
      "INVENTED_CORRIDOR",
      "FLICKER",
      "MIRROR_REFLECTION",
    ],
    ["durationSeconds", "aspectRatio"],
    "AI video yorumu; görünmeyen mekânın doğruluğu garanti edilmez.",
  ],
  [
    "V02",
    "Premium Sinematik",
    "fal",
    "bytedance/seedance-2.5/us/image-to-video",
    "fal-seedance",
    "video/mp4",
    ["camera_motion"],
    [
      "FALSE_GLASS_REFLECTION",
      "OVERSTYLIZED_HDR",
      "MOVING_FURNITURE",
      "CAMERA_JUMP",
      "ARCHITECTURE_DRIFT",
    ],
    ["durationSeconds", "aspectRatio"],
    "AI video yorumu; kaynakla karşılaştırmalı inceleme gerekir.",
  ],
  [
    "V03",
    "Mekânı Keşfet",
    "fal",
    "kling/v4/image-to-video",
    "fal-kling",
    "video/mp4",
    ["camera_pan"],
    ["ROOM_EXTENSION", "FLOOR_PATTERN_WARP", "FALSE_DECOR", "PAN_TOO_WIDE"],
    ["durationSeconds", "aspectRatio"],
    "Yalnız fotoğrafta görünen mekânın kamera yorumu.",
  ],
  [
    "V04",
    "Dış Cephe",
    "fal",
    "kling/v4/image-to-video",
    "fal-kling",
    "video/mp4",
    ["virtual_crane"],
    [
      "NEW_FLOOR",
      "ROOF_MUTATION",
      "FAKE_NEIGHBORHOOD",
      "DRONE_IMPLIED_CAPTURE",
      "SKYLINE_MORPH",
    ],
    ["durationSeconds", "aspectRatio"],
    "Sanal kamera efekti; gerçek drone çekimi değildir.",
  ],
  [
    "P01",
    "Fotoğraf İyileştir",
    "pedra",
    "/api/enhance",
    "pedra-enhance",
    "image",
    ["exposure", "sharpness"],
    ["ARCHITECTURE_DRIFT", "ARBITRARY_CROP"],
    [],
    "Işık ve netlik düzenlemesi; yapısal inceleme gerekir.",
  ],
  [
    "P02",
    "Perspektif Düzelt",
    "pedra",
    "/api/enhance_and_correct_perspective",
    "pedra-enhance",
    "image",
    ["perspective", "exposure"],
    ["PROPORTION_DRIFT", "ARBITRARY_CROP"],
    [],
    "Perspektif düzenlemesi; ölçülü plan veya alan kanıtı değildir.",
  ],
  [
    "P03",
    "Sanal Mobilya",
    "pedra",
    "/api/furnish",
    "pedra-furnish",
    "image",
    ["movable_furniture"],
    ["FURNITURE_SCALE", "FLOATING_OBJECT", "WINDOW_DRIFT"],
    ["roomType", "style"],
    "Sanal dekorasyon — mevcut eşyalardan farklıdır.",
  ],
  [
    "P04",
    "Odayı Boşalt",
    "pedra",
    "/api/empty_room",
    "pedra-furnish",
    "image",
    ["movable_furniture_removal"],
    ["FIXTURE_REMOVED", "GHOSTING", "TILE_SEAMS"],
    [],
    "Dijital olarak boşaltıldı; görünmeyen yüzeyler yorumlanabilir.",
  ],
  [
    "P05",
    "Nesne Kaldır",
    "pedra",
    "/api/remove_object",
    "pedra-furnish",
    "image",
    ["approved_mask_only"],
    ["NON_TARGET_EDIT", "MASK_EDGE", "WATERMARK_REMOVAL"],
    [],
    "Yalnız onaylı alan dijital düzenlemedir; atıf/su işareti silinmez.",
  ],
  [
    "P06",
    "Gökyüzü / Akşam",
    "pedra",
    "/api/sky_blue",
    "pedra-enhance",
    "image",
    ["sky_and_light"],
    ["FALSE_REFLECTION", "SKYLINE_MORPH"],
    ["skyStyle"],
    "Dijital ışık/gökyüzü düzenlemesi; mevcut çekim koşulu değildir.",
  ],
  [
    "P07",
    "Renovasyon Konsepti",
    "pedra",
    "/api/renovation",
    "pedra-furnish",
    "image",
    ["concept_finishes"],
    ["WINDOW_DRIFT", "FAKE_WALL"],
    ["style"],
    "Konsept görsel; mülkün mevcut durumu değildir.",
  ],
  [
    "P07b",
    "Boya / Zemin Konsepti",
    "fal",
    "fal-ai/nano-banana-pro/edit",
    "fal-edit",
    "image",
    ["approved_surface_only"],
    [
      "NON_TARGET_EDIT",
      "DOOR_REMOVED",
      "PERSPECTIVE_CHANGE",
      "FAKE_WALL",
      "REFLECTION_INCONSISTENCY",
    ],
    ["target", "finish"],
    "Önerilen tasarım; mevcut durum fotoğrafı değildir.",
  ],
  [
    "T01",
    "360° Sanal Tur",
    "pedra",
    "/api/create_virtual_tour",
    "pedra-tour",
    "hosted-360",
    ["verified_panorama_linking"],
    ["FALSE_360", "WRONG_ROOM_CONNECTION", "PUBLICATION_WITHOUT_CONSENT"],
    [],
    "Gerçek equirectangular panorama gerekir; hosted yayın ayrı izinlidir.",
  ],
  [
    "T02",
    "AI 3D Deneyim",
    "worldlabs",
    "marble-1.1-plus",
    "world-generate-md",
    "private-world",
    ["uncertain_spatial_interpretation"],
    [
      "FAKE_ROOM",
      "FALSE_DOOR",
      "METRIC_MEASUREMENT_CLAIM",
      "FLOATING_OBJECT",
      "MESH_COLLISION",
      "SPLAT_ARTIFACT",
    ],
    [],
    "Yapay zekâ ile oluşturulmuş 3D yorum; ölçülü dijital ikiz değildir.",
  ],
  [
    "B01",
    "İlan Paketi",
    "composition",
    "accepted-artifact-composition",
    "internal",
    "bundle",
    ["approved_artifacts_only"],
    ["UNAPPROVED_ARTIFACT", "SOURCE_DRIFT"],
    [],
    "Yalnız bağımsız incelemeyle kabul edilmiş kaynak-bağlı çıktıların paketi.",
  ],
] as const;
export const PRODUCTION_SERVICES: readonly ProductionDefinition[] =
  Object.freeze(
    rows.map(
      ([
        id,
        labelTR,
        provider,
        endpoint,
        schemaRef,
        output,
        permittedChanges,
        riskTags,
        optionKeys,
        disclosure,
      ]) =>
        Object.freeze({
          id,
          labelTR,
          provider,
          endpoint,
          schemaRef,
          output,
          permittedChanges: Object.freeze([...permittedChanges]),
          riskTags: Object.freeze([...riskTags]),
          optionKeys: Object.freeze([...optionKeys]),
          disclosure,
          profileVersion: PROFILE_VERSIONS[id],
          schemaRevision:
            id === "B01"
              ? ("internal-v1" as const)
              : ("official-2026-10-30" as const),
          liveEnabled: false as const,
          requiresIndependentReview: true as const,
        }),
    ),
  );
export function productionService(id: ProductionServiceId) {
  const found = PRODUCTION_SERVICES.find((s) => s.id === id);
  invariant(found && SERVICE_IDS.includes(id), "UNKNOWN_SERVICE", 422);
  return found;
}
