// Turkish-first copy boundary. Live English localization is not enabled.
export const DISCLOSURE =
  "Yerel örnek video: kaynak görsellerden kurgu; fotogerçekçi AI yürüyüşü değil.";
export const RIGHTS =
  "Bu dosyaları kullanma hakkım var; bu demoda yalnız sentetik örnek kullanıyorum. Konum ve diğer dosya bilgileri, videoların sesi kaldırılacak.";
export const friendlyMediaError = (error: unknown) => {
  const key = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    DISTINCT_PHOTOS_REQUIRED:
      "Her sahne için farklı bir fotoğraf seç. Aynı fotoğrafın kopyaları süreyi uzatmak için kullanılmaz.",
    PANORAMA_2_TO_1_REQUIRED:
      "360° tur için yalnız 2:1 oranında gerçek panoramalar ekle. Normal oda fotoğrafı kullanılamaz.",
    PANORAMA_CONFIRMATION_REQUIRED:
      "Görsellerin gerçek 360° panorama olduğunu onayla. Kaynakları ayrıca incelemeci kontrol etmelidir.",
    MARBLE_PHOTO_LIMIT:
      "AI 3D hazırlığı için 1–4 fotoğraf seç. Diğer kaynakların projende korunur.",
    MEDIA_SCOPE_DENIED:
      "Seçilen kaynak bu projede kullanılamıyor. Projeni yeniden açıp kaynaklarını kontrol et.",
    BLOCKED_EXTERNAL_APPROVAL:
      "Gerçek AI üretimi henüz açık değil. Dosyaların korundu; yerel örnekle devam edebilirsin.",
    ALL_CLIP_REVIEWS_REQUIRED:
      "İndirme için başka bir incelemecinin her sahneyi kaynağıyla karşılaştırıp onaylaması gerekir.",
    UPLOAD_SIZE_LIMIT:
      "Dosya fazla büyük. Fotoğrafı 5 MB, MP4 videoyu 20 MB altında seç.",
    VIDEO_DURATION_LIMIT: "En fazla 30 saniyelik bir video seç.",
    VIDEO_DIMENSION_LIMIT:
      "Video yatay 1920 × 1080 veya dikey 1080 × 1920 sınırında olmalı; HDR/4K yerine standart renkli H.264 MP4 seç.",
    VIDEO_FRAME_RATE_LIMIT: "Saniyede en fazla 60 kare içeren bir video seç.",
    UNSUPPORTED_VIDEO_COLOR:
      "Bu videonun renk biçimi desteklenmiyor. Standart renkli (SDR), 8-bit H.264 MP4 olarak dışa aktarıp yeniden dene.",
    UNSUPPORTED_VIDEO_PIXEL_ASPECT:
      "Bu videonun görüntü oranı standart değil. En-boy oranını koruyarak standart H.264 MP4 olarak yeniden dışa aktar.",
    UNSUPPORTED_VIDEO_CODEC:
      "Bu video işlenemiyor. H.264 olarak kaydedilmiş MP4 seç.",
    UNSUPPORTED_VIDEO_CONTAINER:
      "Yalnız MP4 video destekleniyor. MOV ve WebM henüz desteklenmiyor.",
    UNSUPPORTED_VIDEO_STREAMS:
      "MP4 içinde yalnız bir görüntü ve isteğe bağlı AAC ses olabilir.",
    VIDEO_DECODE_FAILED:
      "Video okunamadı. H.264 MP4 olarak yeniden dışa aktar ve tekrar dene.",
    MEDIA_TYPE_MISMATCH:
      "Dosya türü ve içeriği eşleşmiyor. Asıl JPEG, PNG, WebP veya MP4 dosyasını seç.",
    PROPERTY_UPLOAD_QUOTA:
      "Bu projede dosya sınırına ulaştın. Daha küçük dosyalarla yeni bir proje aç.",
    VIDEO_UPLOAD_BUSY: "Bir video işleniyor. Biraz bekleyip tekrar dene.",
    ROLE_DENIED:
      "Bu hesap bu işlem için yetkili değil. Hesap ve yönetim alanından erişimini kontrol et.",
    STALE_REVISION:
      "Proje değişti. Projelerim’den yeniden aç; yüklediklerin korunuyor.",
    INSUFFICIENT_EVIDENCE:
      "Video için fotoğraf veya desteklenen video ekle. 3D için ayrıca doğrulanmış ölçülü plan gerekir.",
    UPLOAD_CANCELLED: "Yükleme durduruldu. Dosyanı tekrar deneyebilirsin.",
  };
  return (
    messages[key] ??
    "İşlem tamamlanamadı. Seçtiklerin korunuyor; bağlantını kontrol edip tekrar dene."
  );
};

export const STUDIO_TR = {
  upload: "Fotoğraf veya video ekle",
  steps: ["Medyanı yükle", "Tarzını seç", "Önizle ve indir"] as const,
  create: "İçeriği oluştur",
  preview: "Önizle",
  download: "İndir",
} as const;
