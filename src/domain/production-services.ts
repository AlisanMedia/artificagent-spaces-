import { z } from "zod";
import { Id } from "./platform";

export const SERVICE_IDS = [
  "V01",
  "V02",
  "V03",
  "V04",
  "P01",
  "P02",
  "P03",
  "P04",
  "P05",
  "P06",
  "P07",
  "P07b",
  "T01",
  "T02",
  "B01",
] as const;
export const ProductionServiceId = z.enum(SERVICE_IDS);
export type ProductionServiceId = z.infer<typeof ProductionServiceId>;
export const ROOM_TYPES = [
  "Living room",
  "Dining + Living room",
  "Bedroom",
  "Dining room",
  "Terrace",
  "Entrance",
  "Office",
  "Bathroom",
] as const;
export const FURNITURE_STYLES = [
  "Modern",
  "Scandinavian",
  "Contemporary",
  "Minimalist",
  "Mediterranean",
] as const;
export const SKY_STYLES = [
  "sunny",
  "sunny-no-reflections",
  "sunrise",
  "dawn",
  "night",
] as const;
export const ServiceOptions = z
  .object({
    roomType: z.enum(ROOM_TYPES).optional(),
    style: z.enum(FURNITURE_STYLES).optional(),
    skyStyle: z.enum(SKY_STYLES).optional(),
    durationSeconds: z.number().int().min(3).max(30).optional(),
    aspectRatio: z.enum(["16:9", "9:16"]).optional(),
    target: z.enum(["wall", "floor"]).optional(),
    finish: z
      .enum(["warm-white-paint", "sage-paint", "natural-oak", "neutral-stone"])
      .optional(),
  })
  .strict();
export type ServiceOptions = z.infer<typeof ServiceOptions>;
export const ProductionRequest = z
  .object({
    propertyId: Id,
    revision: z.number().int().positive(),
    serviceId: ProductionServiceId,
    sourceAssetIds: z.array(Id).min(1).max(12),
    options: ServiceOptions.default({}),
    rights: z
      .object({
        syntheticOnly: z.literal(true),
        ownedOrLicensed: z.literal(true),
        conceptAccepted: z.boolean().default(false),
      })
      .strict(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
    maxCostMicroUsd: z.literal(0),
  })
  .strict();
export type ProductionRequest = z.infer<typeof ProductionRequest>;
export interface ProductionRequestView {
  id: string;
  serviceLabel: string;
  propertyId: string;
  revision: number;
  sourceCount: number;
  options: ServiceOptions;
  state:
    | "awaiting-provider-approval"
    | "cancelled"
    | "qa-held"
    | "awaiting-review"
    | "approved"
    | "processing"
    | "rejected";
  message: string;
  futurePriceMicroUsd: null;
  actualExternalCostMicroUsd: 0;
  downloadAllowed: false;
  liveEnabled: false;
}
/** Customer-only vocabulary. Provider routes, prompt bytes and credentials are never imported by the UI. */
export const SERVICE_FAMILIES = Object.freeze([
  {
    id: "video",
    label: "AI Emlak Video",
    benefit: "Fotoğraflarını bir tanıtım filmine dönüştür.",
    serviceId: "V01",
    example: "video",
    concept: false,
  },
  {
    id: "enhance",
    label: "Fotoğraf İyileştir",
    benefit: "Işık ve netliği, mevcut mekâna sadık kalarak düzenle.",
    serviceId: "P01",
    example: "photo-local",
    concept: false,
  },
  {
    id: "furnish",
    label: "Sanal Mobilya",
    benefit: "Boş odanın nasıl döşenebileceğini görselleştir.",
    serviceId: "P03",
    example: null,
    concept: false,
  },
  {
    id: "empty",
    label: "Odayı Boşalt",
    benefit: "Taşınabilir eşyalar olmadan bir sunum hazırla.",
    serviceId: "P04",
    example: null,
    concept: false,
  },
  {
    id: "remove",
    label: "Nesne Kaldır",
    benefit: "Yalnız işaretlenen alandaki nesne için düzenleme iste.",
    serviceId: "P05",
    example: null,
    concept: false,
  },
  {
    id: "sky",
    label: "Gökyüzü / Akşam",
    benefit: "Dış cephe için açıkça belirtilmiş bir ışık yorumu.",
    serviceId: "P06",
    example: null,
    concept: false,
  },
  {
    id: "tour-360",
    label: "360° Sanal Tur",
    benefit: "Gerçek 360° panoramalarla mekâna etraftan bak.",
    serviceId: "T01",
    example: "tour-360",
    concept: false,
  },
  {
    id: "renovate",
    label: "Renovasyon Konsepti",
    benefit: "Mevcut durumu değil, olası bir tasarımı göster.",
    serviceId: "P07",
    example: null,
    concept: true,
  },
  {
    id: "ai-3d",
    label: "AI 3D Deneyim",
    benefit: "Fotoğraflara dayalı, ölçü garantisi olmayan mekânsal yorum.",
    serviceId: "T02",
    example: "ai-3d",
    concept: true,
  },
] as const);
