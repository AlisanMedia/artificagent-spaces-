"use client";
import { ArrowRight } from "lucide-react";
import type {
  StudioProduct,
  PropertyVideoStyle,
} from "../../domain/real-estate-styles";
import { PROPERTY_STYLE_CARDS } from "../../domain/real-estate-styles";
import type { StudioPlanView } from "../../contracts/studio-ui";
export function CustomerSteps({
  step,
  onStep,
  canAdvance,
  disabled,
}: {
  step: number;
  onStep: (n: number) => void;
  canAdvance: boolean;
  disabled: boolean;
}) {
  return (
    <ol className="v55-steps" aria-label="İçerik oluşturma adımları">
      {["Hizmet", "Medya", "Tarz", "İstek özeti"].map((label, i) => (
        <li
          key={label}
          aria-current={
            step === i + 1 || (step === 5 && i === 3) ? "step" : undefined
          }
        >
          <button
            type="button"
            disabled={disabled || (i > 1 && !canAdvance)}
            onClick={() => onStep(i + 1)}
          >
            <span>0{i + 1}</span>
            {label}
          </button>
        </li>
      ))}
    </ol>
  );
}
export function OrderSummary({
  product,
  style,
  count,
  aspect,
  duration,
  plan,
  busy,
  canEdit,
  onCreate,
  onCheck,
  onBack,
}: {
  product: StudioProduct;
  style: PropertyVideoStyle;
  count: number;
  aspect: string;
  duration: number;
  plan: StudioPlanView | null;
  busy: boolean;
  canEdit: boolean;
  onCreate: () => void;
  onCheck: () => void;
  onBack: () => void;
}) {
  const video = product === "video";
  return (
    <section className="v55-summary" aria-labelledby="v55-summary-title">
      <span className="ux-kicker">04 / İSTEK ÖZETİ</span>
      <h2 id="v55-summary-title">Son bir göz atalım.</h2>
      <p>Dosyanı oluşturduktan sonra ayrı bir incelemeci kontrol eder.</p>
      <dl>
        <dt>Hizmet</dt>
        <dd>
          {video
            ? "Video Tanıtımı"
            : product === "ai-3d"
              ? "AI 3D Deneyim"
              : "360° Sanal Tur"}
        </dd>
        <dt>Kaynak</dt>
        <dd>{count} fotoğraf · yalnız bu proje</dd>
        {video && (
          <>
            <dt>Tarz</dt>
            <dd>{PROPERTY_STYLE_CARDS.find((s) => s.id === style)?.label}</dd>
            <dt>Biçim</dt>
            <dd>{aspect} · Yerel H.264 MP4</dd>
            <dt>Süre</dt>
            <dd>
              {duration} sn hedef ·{" "}
              {plan?.suggestedDurationSeconds ??
                Math.min(count, duration / 5) * 5}{" "}
              sn yerel öneri
            </dd>
          </>
        )}
        <dt>Çıktı</dt>
        <dd>
          {video
            ? "640 × 360 veya 360 × 640 yerel kurgu"
            : product === "ai-3d"
              ? "AI mekânsal yorum; gerçek üretim kapalı"
              : "Panorama tabanlı tur; gerçek servis kapalı"}
        </dd>
        <dt>Kullanılabilirlik</dt>
        <dd>
          {video
            ? "Sentetik kaynaklardan yerel video denenebilir."
            : "Canlı servis ve dış paylaşım henüz kullanılamıyor."}
        </dd>
        <dt>Ücret</dt>
        <dd>
          Canlı hizmet fiyatı doğrulanmadı. Yerel denemede harici ücret yok.
        </dd>
      </dl>
      <p className="ux-honesty">
        {video
          ? "Yerel örnek, fotoğraflardan kurgu oluşturur; fotogerçekçi AI yürüyüşü değildir. İndirmeden önce farklı incelemecinin her sahneyi onaylaması gerekir."
          : "Bu istek ücretli bir üretim başlatmaz. Kaynakları kontrol edebilir; sonuç türüne uygun hazır örneği inceleyebilirsin."}
      </p>
      <div className="v55-summary-actions">
        <button
          type="button"
          className="ux-primary"
          disabled={busy || !canEdit || !count || !video}
          onClick={onCreate}
        >
          {busy
            ? "İstek hazırlanıyor…"
            : video
              ? "Yerel örnek oluştur"
              : "Üretim henüz açık değil"}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="subtle"
          disabled={busy || !canEdit || !count}
          onClick={onCheck}
        >
          Seçimlerimi kontrol et
        </button>
        <button
          type="button"
          className="subtle"
          disabled={busy}
          onClick={onBack}
        >
          Tercihleri düzenle
        </button>
      </div>
    </section>
  );
}
