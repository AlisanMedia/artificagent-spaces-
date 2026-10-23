import { z } from "zod";
import { Id, invariant } from "./platform";

export const PHOTO_MAX_BYTES = 5_242_880;
export const VIDEO_MAX_BYTES = 20_971_520;
export const VIDEO_MAX_SECONDS = 30;
export const IntakeMetadata = z
  .object({
    mime: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4"]),
    byteLength: z.number().int().positive().max(VIDEO_MAX_BYTES),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.mime !== "video/mp4" && v.byteLength > PHOTO_MAX_BYTES)
      ctx.addIssue({ code: "custom", message: "UPLOAD_SIZE_LIMIT" });
  });
export const MediaGrantMetadata = IntakeMetadata.safeExtend({
  replaceAssetId: Id.optional(),
});
export const UploadSelection = MediaGrantMetadata.safeExtend({
  filename: z
    .string()
    .min(1)
    .max(180)
    .refine(
      (s) =>
        !/[\\/]/.test(s) &&
        !Array.from(s).some((c) => c.charCodeAt(0) < 32) &&
        !s.includes(".."),
      "UNSAFE_FILENAME",
    ),
  revision: z.number().int().positive(),
}).superRefine((v, ctx) => {
  const extensions: Record<string, RegExp> = {
    "image/jpeg": /\.jpe?g$/i,
    "image/png": /\.png$/i,
    "image/webp": /\.webp$/i,
    "video/mp4": /\.mp4$/i,
  };
  if (!extensions[v.mime]!.test(v.filename))
    ctx.addIssue({ code: "custom", message: "MEDIA_TYPE_MISMATCH" });
});
export const VIDEO_STYLES = [
  {
    id: "pov",
    label: "Doğal keşif",
    description: "Mekânın detaylarına sakin ve yakın bir bakış.",
  },
  {
    id: "cinematic",
    label: "Sinematik tanıtım",
    description: "Özenli kesmelerle güçlü bir ilk izlenim.",
  },
  {
    id: "hybrid",
    label: "Karma kurgu",
    description: "Detayları ve geniş bakışları aynı videoda birleştir.",
  },
] as const;
export const TEMPLATE_LABELS = {
  modern: "Modern Daire",
  luxury: "Lüks Konut",
  warm: "Sıcak Ev",
  hotel: "Otel / Konaklama",
  investment: "Yatırım Sunumu",
} as const;
export const EXPORT_PRESETS = {
  reels: { label: "Instagram Reels / Story", aspect: "9:16" },
  whatsapp: { label: "WhatsApp", aspect: "9:16" },
  youtube: { label: "YouTube", aspect: "16:9" },
  listing: { label: "Emlak ilanı", aspect: "16:9" },
} as const;
export function validateMp4Magic(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  invariant(
    b.length >= 16 && b.toString("ascii", 4, 8) === "ftyp",
    "UNSUPPORTED_VIDEO_CONTAINER",
    415,
  );
  const length = b.readUInt32BE(0);
  invariant(
    length >= 16 && length <= 4096 && length <= b.length && length % 4 === 0,
    "INVALID_MP4_HEADER",
    415,
  );
  const brands = [];
  for (let i = 8; i < length; i += 4)
    if (i !== 12) brands.push(b.toString("ascii", i, i + 4));
  invariant(
    !brands.includes("qt  ") &&
      brands.some((s) => ["isom", "iso2", "mp41", "mp42", "avc1"].includes(s)),
    "UNSUPPORTED_VIDEO_CONTAINER",
    415,
  );
}

export function validatePhotoMagic(bytes: Uint8Array, mime: string) {
  const b = Buffer.from(bytes);
  const actual =
    b[0] === 255 && b[1] === 216 && b[2] === 255
      ? "image/jpeg"
      : b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : b.subarray(0, 4).toString() === "RIFF" &&
            b.subarray(8, 12).toString() === "WEBP"
          ? "image/webp"
          : "unknown";
  invariant(actual === mime, "MEDIA_TYPE_MISMATCH", 415);
}
