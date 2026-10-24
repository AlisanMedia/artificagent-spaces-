/** V4 single source of truth. Selection advice is never upload authorization. */
import { invariant } from "./platform-errors";

export const MEDIA_CAPABILITIES = Object.freeze({
  version: "local-intake-v4.1",
  photo: {
    mimes: ["image/jpeg", "image/png", "image/webp"] as const,
    extensions: ["jpg", "jpeg", "png", "webp"] as const,
    maxBytes: 5_242_880,
    minSide: 64,
    maxPixels: 24_000_000,
    normalizedMaxSide: 1600,
    pages: 1,
  },
  video: {
    mime: "video/mp4" as const,
    extension: "mp4",
    codec: "h264",
    optionalAudioCodec: "aac",
    pixelFormats: ["yuv420p", "yuvj420p"] as const,
    maxBytes: 20_971_520,
    minSeconds: 0.25,
    maxSeconds: 30,
    minSide: 64,
    maxSide: 1920,
    maxPixels: 2_073_600,
    maxFps: 60,
    maxStreams: 2,
    squarePixelsOnly: true,
    normalizedFps: 24,
    normalizedMaxSide: 720,
    normalizedMaxBytes: 8_388_608,
  },
  maxSelection: 12,
  propertyMaxRecords: 20,
  propertyMaxBytes: 52_428_800,
  uploadGrantSeconds: 60,
});
export const SUPPORTED_MIMES = [
  ...MEDIA_CAPABILITIES.photo.mimes,
  MEDIA_CAPABILITIES.video.mime,
] as const;
export const MEDIA_PICKER_ACCEPT = "image/*,video/*"; // Broad selection enables advice, not ingestion.
export const MEDIA_UPLOAD_HELP_TR = {
  photos: "JPEG, PNG veya WebP fotoğraf · en fazla 5 MiB",
  videos:
    "Standart renkli H.264 MP4 · en fazla 20 MiB, 30 sn, 1080p ve 60 kare/sn",
  iphone:
    "iPhone HEIC, MOV, HEVC ve HDR dosyaları henüz işlenmiyor. Fotoğrafı JPEG; videoyu H.264 MP4, SDR, 8-bit ve en fazla 1080p olarak cihazındaki güvenilir bir düzenleyiciden dışa aktar. Yalnız uzantısını değiştirmek yeterli değildir. Özel dosyaları çevrimiçi dönüştürücülere gönderme.",
  caveat:
    "MP4 uzantısı tek başına yeterli değildir. Son biçim kontrolü özel yüklemede yapılır; desteklenmeyen dosya için içerik işi veya ücret oluşturulmaz.",
};
export interface SelectionInfo {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}
export interface MediaAdvice {
  readonly supported: boolean;
  readonly category: "photo" | "video" | "unsupported";
  readonly code: string;
  readonly message: string;
}
const blocked = (code: string, message: string): MediaAdvice => ({
  supported: false,
  category: "unsupported",
  code,
  message,
});
export function adviseSelection(file: SelectionInfo): MediaAdvice {
  const ext = file.name.toLowerCase().split(".").at(-1) ?? "";
  if (
    /[\\/]/.test(file.name) ||
    file.name.includes("..") ||
    Array.from(file.name).some((c) => c.charCodeAt(0) < 32) ||
    file.name.length > 180
  )
    return blocked(
      "UNSAFE_FILENAME",
      "Dosya adındaki klasör işaretlerini kaldırıp yeniden seç. Dosyan silinmedi.",
    );
  if (["heic", "heif"].includes(ext) || /image\/(heic|heif)/.test(file.type))
    return blocked(
      "HEIC_NOT_SUPPORTED",
      "Bu iPhone fotoğrafı HEIC/HEIF biçiminde. Cihazında JPEG olarak dışa aktar ve kopyasını seç. Dosyan silinmedi.",
    );
  if (["mov", "qt"].includes(ext) || file.type === "video/quicktime")
    return blocked(
      "MOV_NOT_SUPPORTED",
      "Bu video MOV/QuickTime biçiminde. H.264 MP4, standart renk (SDR), 8-bit ve en fazla 1080p olarak dışa aktar; dosyanı burada koruyoruz.",
    );
  if (ext === "webm" || file.type === "video/webm")
    return blocked(
      "WEBM_NOT_SUPPORTED",
      "WebM henüz desteklenmiyor. Cihazında H.264 MP4 olarak dışa aktar ve desteklenen kopyayı seç.",
    );
  const photo = MEDIA_CAPABILITIES.photo.mimes.includes(
    file.type as (typeof MEDIA_CAPABILITIES.photo.mimes)[number],
  );
  const expected: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    mp4: "video/mp4",
  };
  if (expected[ext] !== file.type || (!photo && file.type !== "video/mp4"))
    return blocked(
      "MEDIA_TYPE_MISMATCH",
      "Bu dosya biçimi desteklenmiyor. Asıl JPEG, PNG, WebP fotoğrafını veya H.264 MP4 videoyu seç; yalnız uzantıyı değiştirme.",
    );
  if (
    !Number.isSafeInteger(file.size) ||
    file.size <= 0 ||
    file.size >
      (photo
        ? MEDIA_CAPABILITIES.photo.maxBytes
        : MEDIA_CAPABILITIES.video.maxBytes)
  )
    return blocked(
      "UPLOAD_SIZE_LIMIT",
      photo
        ? "Fotoğraf 5 MiB sınırını aşıyor veya boş. Daha küçük bir JPEG, PNG veya WebP kopyası seç."
        : "Video 20 MiB sınırını aşıyor veya boş. En fazla 30 saniye ve 1080p bir H.264 MP4 kopyası seç.",
    );
  return {
    supported: true,
    category: photo ? "photo" : "video",
    code: "SERVER_VALIDATION_REQUIRED",
    message: photo
      ? "Yüklemeden sonra dosya içeriği ve gizlilik kontrol edilecek."
      : MEDIA_UPLOAD_HELP_TR.caveat,
  };
}
export interface ProbedVideo {
  readonly streams: readonly {
    codec_type: string;
    codec_name: string;
    pix_fmt?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    sample_aspect_ratio?: string;
    color_primaries?: string;
    color_transfer?: string;
    color_space?: string;
  }[];
  readonly format: { duration: string };
}
export function validateProbedVideo(meta: ProbedVideo) {
  const cap = MEDIA_CAPABILITIES.video,
    videos = meta.streams.filter((s) => s.codec_type === "video"),
    v = videos[0];
  invariant(
    videos.length === 1 &&
      meta.streams.length <= cap.maxStreams &&
      meta.streams.every(
        (s) =>
          s.codec_type === "video" ||
          (s.codec_type === "audio" && s.codec_name === cap.optionalAudioCodec),
      ),
    "UNSUPPORTED_VIDEO_STREAMS",
    415,
  );
  invariant(v?.codec_name === cap.codec, "UNSUPPORTED_VIDEO_CODEC", 415);
  invariant(
    cap.pixelFormats.some((p) => p === v.pix_fmt) &&
      [v.color_primaries, v.color_transfer].every(
        (c) => c === undefined || c === "unknown" || c === "bt709",
      ) &&
      [undefined, "unknown", "bt709", "smpte170m", "bt470bg"].includes(
        v.color_space,
      ),
    "UNSUPPORTED_VIDEO_COLOR",
    415,
  );
  invariant(
    !v.sample_aspect_ratio || ["1:1", "N/A"].includes(v.sample_aspect_ratio),
    "UNSUPPORTED_VIDEO_PIXEL_ASPECT",
    415,
  );
  const duration = Number(meta.format.duration);
  invariant(
    Number.isFinite(duration) &&
      duration >= cap.minSeconds &&
      duration <= cap.maxSeconds,
    "VIDEO_DURATION_LIMIT",
    422,
  );
  invariant(
    v.width &&
      v.height &&
      v.width >= cap.minSide &&
      v.height >= cap.minSide &&
      v.width <= cap.maxSide &&
      v.height <= cap.maxSide &&
      v.width * v.height <= cap.maxPixels,
    "VIDEO_DIMENSION_LIMIT",
    422,
  );
  const [n, d] = (v.r_frame_rate ?? "0/1").split("/").map(Number),
    fps = n! / d!;
  invariant(
    Number.isFinite(fps) && fps > 0 && fps <= cap.maxFps,
    "VIDEO_FRAME_RATE_LIMIT",
    422,
  );
  return { duration, video: v, fps };
}
