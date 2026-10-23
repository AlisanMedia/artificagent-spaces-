import {
  adviseSelection,
  MEDIA_CAPABILITIES,
  type MediaAdvice,
} from "@/domain/media-capabilities";
import { mp4Hints } from "@/domain/mp4-preflight";
export async function preflightSelection(file: File): Promise<MediaAdvice> {
  const advice = adviseSelection({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (!advice.supported || advice.category !== "video") return advice;
  const hints = mp4Hints(new Uint8Array(await file.arrayBuffer()));
  const block = (code: string, message: string): MediaAdvice => ({
    supported: false,
    category: "unsupported",
    code,
    message,
  });
  if (hints.codec === "unsupported")
    return block(
      "UNSUPPORTED_VIDEO_CODEC",
      "MP4 içindeki video biçimi desteklenmiyor (örneğin HEVC). H.264 MP4, SDR, 8-bit ve en fazla 1080p olarak dışa aktar. Seçimin korunuyor.",
    );
  if (hints.highBitDepth || hints.color === "hdr")
    return block(
      "UNSUPPORTED_VIDEO_COLOR",
      "Bu video HDR veya 10-bit görünüyor. Cihazında standart renkli (SDR), 8-bit H.264 MP4 kopyasını oluştur. Dosyan yüklenmedi veya silinmedi.",
    );
  const cap = MEDIA_CAPABILITIES.video;
  if (
    hints.width &&
    hints.height &&
    (hints.width > cap.maxSide ||
      hints.height > cap.maxSide ||
      hints.width * hints.height > cap.maxPixels)
  )
    return block(
      "VIDEO_DIMENSION_LIMIT",
      "Bu video 1080p sınırını aşıyor (örneğin 4K). Dikey 1080 × 1920 veya yatay 1920 × 1080 boyutunda H.264 MP4 kopyasını seç.",
    );
  return advice;
}
