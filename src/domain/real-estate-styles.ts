/** Customer copy only: provider IDs and camera prompts belong to server/domain policy. */
export const PROPERTY_STYLE_IDS = [
  "natural",
  "premium",
  "explore",
  "exterior",
] as const;
export type PropertyVideoStyle = (typeof PROPERTY_STYLE_IDS)[number];
export const PROPERTY_STYLE_CARDS = Object.freeze([
  Object.freeze({
    id: "natural",
    label: "Doğal Tur",
    description: "Göz hizasında, sakin bir yaklaşma.",
    poster: "pov-landscape.webp",
    legacyMode: "pov",
  }),
  Object.freeze({
    id: "premium",
    label: "Premium Sinematik",
    description: "Zarif bir yana kayış, güçlü bir sunum.",
    poster: "cinematic-landscape.webp",
    legacyMode: "cinematic",
  }),
  Object.freeze({
    id: "explore",
    label: "Mekânı Keşfet",
    description: "Görünür detayları takip eden dengeli bakış.",
    poster: "hybrid-landscape.webp",
    legacyMode: "hybrid",
  }),
  Object.freeze({
    id: "exterior",
    label: "Dış Cephe",
    description: "Bina fotoğrafınız için ölçülü yükseliş.",
    poster: "cinematic-landscape.webp",
    legacyMode: "cinematic",
  }),
] as const);
export const STUDIO_PRODUCTS = Object.freeze([
  Object.freeze({
    id: "video",
    label: "Video Tanıtımı",
    help: "Fotoğraflarından sıralı bir video anlatımı.",
  }),
  Object.freeze({
    id: "ai-3d",
    label: "AI 3D Deneyim",
    help: "Fotoğraflarla yönlendirilen yapay zekâ sahnesi; ölçülü dijital ikiz değil.",
  }),
  Object.freeze({
    id: "tour-360",
    label: "360° Sanal Tur",
    help: "Yalnız gerçek 2:1 panoramalar; serbest 3D üretimi değil.",
  }),
] as const);
export type StudioProduct = (typeof STUDIO_PRODUCTS)[number]["id"];
