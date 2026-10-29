"use client";

import {
  ArrowRight,
  Check,
  Clapperboard,
  Box,
  Scan,
  ShieldCheck,
} from "lucide-react";
import {
  PROPERTY_STYLE_CARDS,
  STUDIO_PRODUCTS,
  type PropertyVideoStyle,
  type StudioProduct,
} from "@/domain/real-estate-styles";
import type { StudioPlanView } from "@/contracts/studio-ui";
import { sampleAsset, videoSample } from "../showcase/media";

export function StudioProductSelector({
  value,
  onSelect,
  disabled,
}: {
  value: StudioProduct;
  onSelect: (product: StudioProduct) => void;
  disabled: boolean;
}) {
  return (
    <div
      className="v54-products"
      role="group"
      aria-label="Oluşturmak istediğin içerik"
    >
      {STUDIO_PRODUCTS.map((p, index) => {
        const Icon = [Clapperboard, Box, Scan][index]!;
        return (
          <button
            type="button"
            key={p.id}
            aria-pressed={value === p.id}
            disabled={disabled}
            onClick={() => onSelect(p.id)}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ApiFirstControls({
  product,
  styleId,
  onStyle,
  aspect,
  onAspect,
  duration,
  onDuration,
  photoCount,
  plan,
  busy,
  canEdit,
  onPlan,
  onCreateLocal,
  panoramaConfirmed,
  onPanoramaConfirmed,
  onContinue,
}: {
  product: StudioProduct;
  styleId: PropertyVideoStyle;
  onStyle: (style: PropertyVideoStyle) => void;
  aspect: "16:9" | "9:16";
  onAspect: (aspect: "16:9" | "9:16") => void;
  duration: 30 | 45 | 60;
  onDuration: (seconds: 30 | 45 | 60) => void;
  photoCount: number;
  plan: StudioPlanView | null;
  busy: boolean;
  canEdit: boolean;
  onPlan: () => void;
  onCreateLocal: () => void;
  panoramaConfirmed: boolean;
  onPanoramaConfirmed: (confirmed: boolean) => void;
  onContinue?: () => void;
}) {
  const required = duration / 5,
    availableSeconds = Math.min(photoCount, required) * 5;
  return (
    <div className="v54-controls">
      {product === "video" ? (
        <>
          <fieldset className="v54-style-grid">
            <legend className="sr-only">Emlak video stili</legend>
            {PROPERTY_STYLE_CARDS.map((style, i) => (
              <label
                className={`v54-style ${styleId === style.id ? "is-selected" : ""}`}
                key={style.id}
              >
                <input
                  type="radio"
                  name="property-camera-style"
                  value={style.id}
                  checked={styleId === style.id}
                  disabled={busy || !canEdit}
                  onChange={() => onStyle(style.id)}
                />
                <span className="v54-style-media">
                  <img
                    src={
                      sampleAsset(videoSample(style.id)?.posterId ?? "")?.url
                    }
                    width="640"
                    height="360"
                    alt=""
                    loading="lazy"
                  />
                  <span>Gerçek örnek videodan kare</span>
                  <b aria-hidden="true">0{i + 1}</b>
                  {styleId === style.id && (
                    <Check size={20} aria-hidden="true" />
                  )}
                </span>
                <span className="v54-style-copy">
                  <strong>{style.label}</strong>
                  <span>{style.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="v54-format-row">
            <fieldset>
              <legend>Sunum biçimi</legend>
              <div className="v54-segmented">
                {(
                  [
                    ["9:16", "Dikey · Reels"],
                    ["16:9", "Yatay · İlan"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={aspect === id}
                    disabled={busy || !canEdit}
                    onClick={() => onAspect(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              Tanıtım hedef süresi
              <select
                value={duration}
                disabled={busy || !canEdit}
                onChange={(e) =>
                  onDuration(Number(e.target.value) as 30 | 45 | 60)
                }
              >
                {[30, 45, 60].map((n) => (
                  <option value={n} key={n}>
                    {n} saniye
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="v54-target">
            1080p teslim hedefi · Gerçek AI üretimi henüz etkin değil.
          </p>
          <p className="ux-small">
            Yerel örnekte fotoğrafın oranı korunur, kenarları kesilmez.
            Gerekirse çerçevede boşluk bırakılır.
          </p>
          <div className="v54-source-advice" role="status">
            {photoCount < required ? (
              <>
                <strong>
                  {duration} saniye için {required} farklı fotoğraf gerekir.
                </strong>
                <span>
                  {photoCount
                    ? `Mevcut kaynaklarla ${availableSeconds} saniyelik yerel kurgu deneyebilirsin. Hedef süreyi tamamlamış sayılmaz.`
                    : "Önce mülk fotoğraflarını ekle. Desteklenen videolar önceki yerel kurgu yolunda kullanılabilir."}
                </span>
              </>
            ) : (
              <>
                <strong>
                  {required} fotoğraf · her biri 5 saniyelik ayrı sahne
                </strong>
                <span>
                  {photoCount > required
                    ? `Sıralamadaki ilk ${required} fotoğraf kullanılacak. `
                    : ""}
                  Görünmeyen odalar arasında hayalî geçiş kurulmaz.
                </span>
              </>
            )}
            {styleId === "exterior" && (
              <span>
                Dış Cephe için bina fotoğrafı seç; örnek kart gerçek bir cephe
                üretimi değildir.
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="v54-product-detail">
          <span className="ux-kicker">
            {product === "ai-3d" ? "FOTOĞRAFTAN SAHNE" : "PANORAMADAN TUR"}
          </span>
          <h3>
            {product === "ai-3d"
              ? "Mekânı başka bir boyutta keşfet."
              : "Odaları birbirine bağlayan bir deneyim."}
          </h3>
          <p>
            {product === "ai-3d"
              ? "1–4 fotoğrafla yönlendirilecek bir AI sahnesi. Görünmeyen alanlar tahmin olabilir; gerçek dairenin ölçülü dijital ikizi değildir."
              : "Yalnız gerçek, 2:1 oranındaki equirectangular 360° panoramalarla hazırlanır. Normal oda fotoğraflarından 3D üretmez."}
          </p>
          <p>
            {product === "tour-360"
              ? "Tur üretimi ve dış bağlantı yayını kapalı. Türkçe tur dili sağlayıcıda belgelenmedi; yerel arayüz Türkçe kalır."
              : "Harici üretim kapalı. Mevcut ölçülü sentetik 3D örneği aşağıdaki yerel araçlarda korunur."}
          </p>
          {product === "tour-360" && (
            <label className="ux-checkbox">
              <input
                type="checkbox"
                checked={panoramaConfirmed}
                disabled={busy || !canEdit}
                onChange={(e) => onPanoramaConfirmed(e.target.checked)}
              />
              <span>
                Bu görseller gerçek 360° panoramalardır; normal oda fotoğrafları
                değildir.
              </span>
            </label>
          )}
        </div>
      )}
      <div className="v54-availability">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          Kaynaklar bu yerel projede kalır. Sağlayıcıya gönderim yapılmaz; fiyat
          ve dış kullanım onayları bekleniyor.
        </p>
      </div>
      {plan && (
        <p className="ux-note" role="status">
          Seçimlerin kontrol edildi. {plan.availablePhotos} fotoğraf kayıtlı.{" "}
          {product === "video"
            ? `Yerel örnek ${plan.suggestedDurationSeconds} sn; ${plan.currentLocalResolution}.`
            : "Canlı oluşturma ve dış paylaşım kapalı."}{" "}
          Gerçek AI üretim fiyatı henüz doğrulanmadı.
        </p>
      )}
      <div className="v54-main-actions">
        <button
          className="ux-primary"
          type="button"
          disabled={
            busy ||
            !canEdit ||
            !photoCount ||
            (product === "tour-360" && !panoramaConfirmed)
          }
          onClick={onContinue ?? (product === "video" ? onCreateLocal : onPlan)}
        >
          {busy
            ? "Kontrol ediliyor…"
            : onContinue
              ? "İsteği gözden geçir"
              : product === "video"
                ? "Yerel örnek oluştur"
                : "Seçimlerimi kontrol et"}
          <ArrowRight size={17} aria-hidden="true" />
        </button>
        {(product === "video" || !!onContinue) && (
          <button
            className="subtle"
            type="button"
            disabled={
              busy ||
              !canEdit ||
              !photoCount ||
              (product === "tour-360" && !panoramaConfirmed)
            }
            onClick={onPlan}
          >
            Seçimlerimi kontrol et
          </button>
        )}
        <button
          className="subtle"
          type="button"
          disabled
          aria-describedby="v54-live-reason"
        >
          AI üretimi kapalı
        </button>
      </div>
      <p id="v54-live-reason" className="ux-small">
        Canlı üretim ve 1080p teslim kullanıma açılmadı. Yerel örnek, kaynak
        fotoğraflardan ayrı kliplerin kurgusudur; AI tarafından üretilmiş tur
        değildir. İndirme öncesi farklı incelemecinin her sahneyi onaylaması
        gerekir.
      </p>
    </div>
  );
}
