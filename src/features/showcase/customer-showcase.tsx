"use client";
import { useRef, useState } from "react";
import { ArrowRight, Play, ShieldCheck, X } from "lucide-react";
import { StudioWordmark } from "../platform/studio-presentation";
import {
  PROPERTY_STYLE_CARDS,
  type StudioProduct,
  type PropertyVideoStyle,
} from "../../domain/real-estate-styles";
import { BeforeAfterSlider } from "../../components/before-after-slider";
import { sampleAsset, showcaseMedia } from "./media";
import { VideoExample } from "./video-example";
import { InteractiveSample } from "./interactive-sample";

export const CUSTOMER_SERVICES = [
  {
    id: "video",
    title: "AI Emlak Video",
    description: "Fotoğraflarınızdan, seçtiğiniz kamera tarzıyla bir tanıtım.",
    format: "Yerel örnek: H.264 MP4 · AI üretimi kapalı",
    poster: "/showcase-v55/premium-poster.webp",
  },
  {
    id: "ai-3d",
    title: "AI 3D Deneyim",
    description: "Mekânı farklı açılardan, etkileşimli olarak keşfedin.",
    format: "Sentetik GLB örneği · AI üretimi kapalı",
    poster: "/golden-v5/living.png",
  },
  {
    id: "tour-360",
    title: "360° Sanal Tur",
    description: "Gerçek panoramalardan, sabit noktalı bir tur deneyimi.",
    format: "2:1 panorama örneği · Tur servisi kapalı",
    poster: "/showcase-v55/living-panorama.jpg",
  },
] as const;

export function ServiceCards({
  onSelect,
  onInspect,
  selected,
  compact = false,
  disabled = false,
  studioHref = "/spaces",
}: {
  onSelect?: (p: StudioProduct) => void;
  onInspect?: (p: StudioProduct) => void;
  selected?: StudioProduct;
  compact?: boolean;
  disabled?: boolean;
  studioHref?: string;
}) {
  return (
    <div className={`sc-services ${compact ? "is-compact" : ""}`}>
      {CUSTOMER_SERVICES.map((s, i) => (
        <article
          className={`sc-service ${selected === s.id ? "is-selected" : ""}`}
          key={s.id}
          aria-label={s.title}
        >
          <img
            src={s.poster}
            width="640"
            height="360"
            alt={`${s.title} için sentetik örnek`}
            loading="lazy"
          />
          <div className="sc-service-copy">
            <span className="sc-overline">
              0{i + 1} /{" "}
              {s.id === "video"
                ? "HAREKET"
                : s.id === "ai-3d"
                  ? "MEKÂN"
                  : "PANORAMA"}
            </span>
            <h3>{s.title}</h3>
            <p>{s.description}</p>
            <small>{s.format}</small>
            <div className="sc-service-actions">
              {onInspect ? (
                <button
                  className="subtle"
                  type="button"
                  onClick={() => onInspect(s.id)}
                >
                  Örneği İncele <Play size={13} aria-hidden="true" />
                </button>
              ) : (
                <a
                  className="subtle"
                  href={`/spaces/showcase?product=${s.id}#ornekler`}
                >
                  Örneği İncele
                </a>
              )}
              {onSelect ? (
                <button
                  type="button"
                  disabled={disabled}
                  className="sc-select"
                  onClick={() => onSelect(s.id)}
                  aria-pressed={selected === s.id}
                >
                  Bu Hizmeti Seç <ArrowRight size={15} aria-hidden="true" />
                </button>
              ) : (
                <a className="sc-select" href={`${studioHref}?service=${s.id}`}>
                  Bu Hizmeti Seç <ArrowRight size={15} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ShowcaseGallery({
  initialProduct = "video",
}: {
  initialProduct?: StudioProduct;
}) {
  const [product, setProduct] = useState<StudioProduct>(initialProduct),
    [style, setStyle] = useState<PropertyVideoStyle>("natural");
  return (
    <div className="sc-gallery">
      <div
        className="sc-gallery-tabs"
        role="group"
        aria-label="Örnek çalışma türü"
      >
        {(
          [
            ["video", "Video örnekleri"],
            ["ai-3d", "3D örneği"],
            ["tour-360", "360° örneği"],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={product === id}
            onClick={() => setProduct(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {product === "video" ? (
        <>
          <fieldset className="sc-style-tabs">
            <legend>Video tarzı</legend>
            {PROPERTY_STYLE_CARDS.map((s) => (
              <label key={s.id}>
                <input
                  type="radio"
                  name="showcase-style"
                  value={s.id}
                  checked={s.id === style}
                  onChange={() => setStyle(s.id)}
                />
                <span>{s.label}</span>
              </label>
            ))}
          </fieldset>
          <p className="sc-style-description">
            {PROPERTY_STYLE_CARDS.find((s) => s.id === style)?.description}{" "}
            Yerel örnek, bu kamera hareketinin fotogerçekçi AI uygulaması
            değildir.
          </p>
          <VideoExample key={style} style={style} />
        </>
      ) : (
        <>
          <div className="sc-spatial-source">
            <img
              src={
                product === "ai-3d"
                  ? "/golden-v5/living.png"
                  : "/showcase-v55/living-panorama.jpg"
              }
              width="640"
              height={product === "ai-3d" ? 360 : 320}
              alt={
                product === "ai-3d"
                  ? "Örnek mülkün kaynak salon görünümü"
                  : "Gerçek küresel projeksiyonla render edilen sentetik 2:1 panorama"
              }
              loading="lazy"
            />
            <p>
              {product === "ai-3d"
                ? "Kaynak görünüm: Örnek mülk / salon. Tasarım ölçüleri sentetiktir; fotoğraftan daire rekonstrüksiyonu yapılmadı."
                : "Kaynak: aynı sentetik salonun 1024 × 512 equirectangular panoraması. Normal oda fotoğrafı değildir."}
            </p>
          </div>
          <InteractiveSample key={product} kind={product} />
          <p className="sc-disclosure">
            {product === "ai-3d"
              ? "Bu, serbestçe dolaşılabilen ölçülü sentetik bir 3D tasarımdır. Canlı AI üretimi, ölçülmüş konut veya dijital ikiz değildir."
              : "Bu tek odalı sentetik panorama yerel olarak görüntülenir. Harici tur, oda geçişi veya dış paylaşım oluşturulmadı."}
          </p>
        </>
      )}
    </div>
  );
}

export function CustomerShowcase({
  isolated = false,
  studioHref = "/spaces",
  initialProduct = "video",
}: {
  isolated?: boolean;
  studioHref?: string;
  initialProduct?: StudioProduct;
}) {
  const [selected, setSelected] = useState<StudioProduct>(initialProduct),
    [galleryKey, setGalleryKey] = useState(0),
    [isolatedNotice, setIsolatedNotice] = useState("");
  const login = useRef<HTMLDialogElement>(null),
    gallery = useRef<HTMLElement>(null);
  function inspect(p: StudioProduct) {
    setSelected(p);
    setGalleryKey((k) => k + 1);
    requestAnimationFrame(() => {
      gallery.current?.scrollIntoView({ behavior: "auto" });
      gallery.current?.focus({ preventScroll: true });
    });
  }
  const before = sampleAsset(showcaseMedia.comparison.beforeId),
    after = sampleAsset(showcaseMedia.comparison.afterId),
    source = sampleAsset(showcaseMedia.comparison.sourceId);
  return (
    <div className="studio-theme sc-public">
      <a href="#showcase-main" className="studio-skip">
        İçeriğe geç
      </a>
      <header className="sc-header">
        <a
          href={studioHref}
          className="sc-brand"
          aria-label="ArtificAgent Spaces stüdyo"
        >
          <StudioWordmark />
        </a>
        <nav aria-label="Ürün gezinme">
          <a href="#hizmetler">Hizmetler</a>
          <a href="#ornekler">Örnek Çalışmalar</a>
          <a href="#nasil">Nasıl Çalışır</a>
        </nav>
        <button
          type="button"
          className="subtle"
          onClick={() => login.current?.showModal()}
        >
          Giriş Yap
        </button>
      </header>
      <main id="showcase-main" tabIndex={-1}>
        <div className="sc-notice">
          <ShieldCheck size={14} aria-hidden="true" />
          Sentetik ürün gösterimi · Gerçek AI üretimi henüz etkin değil
        </div>

        <section className="sc-hero">
          <div>
            <span className="sc-overline">GAYRİMENKULÜNÜZE YENİ BİR BAKIŞ</span>
            <h1>
              Gayrimenkullerinizi <em>profesyonel içeriklerle</em> tanıtın.
            </h1>
            <p>
              Fotoğraflarınızı yükleyin, tarzınızı seçin, video veya sanal tur
              deneyiminizi oluşturun.
            </p>
            <a className="ux-primary" href={studioHref}>
              Yeni Çalışma Oluştur <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#ornekler" className="sc-hero-secondary">
              Önce örneklere bak <Play size={14} aria-hidden="true" />
            </a>
            <small>
              Şimdi: sentetik kaynaklarla yerel deneme. Gerçek müşteri verisi
              yüklemeyin.
            </small>
          </div>
          <div className="sc-hero-media">
            <VideoExample style="premium" compact />
            <span className="sc-editorial-note">
              Bir mekân. Üç farklı deneyim.
            </span>
          </div>
        </section>
        <section id="hizmetler" className="sc-section">
          <div className="sc-section-heading">
            <span className="sc-overline">HİZMETLER</span>
            <h2>
              İlanınız için <em>doğru anlatım.</em>
            </h2>
            <p>
              Video, serbest 3D veya panoramik tur. Her birinin kaynağı ve
              sonucu farklıdır.
            </p>
          </div>
          <ServiceCards
            onInspect={inspect}
            studioHref={studioHref}
            {...(isolated
              ? {
                  onSelect: (p: StudioProduct) => {
                    inspect(p);
                    setIsolatedNotice(
                      "Bu statik önizlemede yalnız hazır örnek gösterilir. Üretim, hesap ve yükleme sunucusu bağlı değildir.",
                    );
                  },
                }
              : {})}
          />
          {isolatedNotice && (
            <p role="status" className="sc-disclosure">
              {isolatedNotice}
            </p>
          )}
        </section>
        <section
          id="ornekler"
          className="sc-section"
          ref={gallery}
          tabIndex={-1}
        >
          <div className="sc-section-heading">
            <span className="sc-overline">ÖRNEK ÇALIŞMALAR</span>
            <h2>
              Önce görün. <em>Sonra karar verin.</em>
            </h2>
            <p>
              Tüm örnekler bu proje için hazırlanmış sentetik içeriklerdir.
              Kendi dosyanızdan üretilmiş sonuç değildir.
            </p>
          </div>
          <ShowcaseGallery key={galleryKey} initialProduct={selected} />
        </section>
        <section id="nasil" className="sc-section sc-process">
          <div className="sc-section-heading">
            <span className="sc-overline">NASIL ÇALIŞIR</span>
            <h2>
              Dört adımda <em>kendi çalışmanız.</em>
            </h2>
          </div>
          <ol>
            {[
              "Hizmetini seç",
              "Fotoğraflarını yükle",
              "Tarzını belirle",
              "Oluştur",
            ].map((x, i) => (
              <li key={x}>
                <span>0{i + 1}</span>
                <h3>{x}</h3>
                <p>
                  {
                    [
                      "Sonuçları inceleyip ihtiyacına uygun deneyimi seç.",
                      "Yalnız hakları sana ait sentetik kaynaklarla dene.",
                      "İçerik türüne uygun, sade seçeneklerle ilerle.",
                      "Yerel video örneğini oluştur. Sonuç ayrıca bağımsız incelemeye gider.",
                    ][i]
                  }
                </p>
              </li>
            ))}
          </ol>
        </section>
        <section className="sc-section sc-comparison-section">
          <div>
            <span className="sc-overline">AYNI KAYNAK, AYNI KADRAJ</span>
            <h2>
              Küçük bir <em>görsel karşılaştırma.</em>
            </h2>
            <p>
              Üç hizmetten ayrı bir fotoğraf düzenleme örneği. Kaynak salon
              karesine dosya düzeyinde ton ve netlik düzenlemesi uygulanmıştır;
              mimari veya mobilya değiştirilmemiştir.
            </p>
          </div>
          {before && after && source ? (
            <BeforeAfterSlider
              before={before}
              after={after}
              source={source}
              disclosure={showcaseMedia.comparison.disclosure}
            />
          ) : (
            <p role="status">
              Doğrulanmış karşılaştırma çifti henüz hazır değil.
            </p>
          )}
        </section>
        <section className="sc-section sc-faq">
          <div className="sc-section-heading">
            <span className="sc-overline">MERAK ETTİKLERİNİZ</span>
            <h2>
              Açık ve <em>dürüst cevaplar.</em>
            </h2>
          </div>
          {[
            [
              "Şu anda hangi sonuçları alabilirim?",
              "Yerel uygulama sentetik kaynaklardan gerçek, düşük çözünürlüklü MP4 kurgu oluşturabilir. Hazır video, sentetik serbest 3D ve 360° panorama örneklerini inceleyebilirsiniz. Canlı AI hizmetleri kapalıdır.",
            ],
            [
              "Kendi fotoğrafımı yüklersem örnek video değişir mi?",
              "Hazır örnekler dosyanızdan oluşturulmaz. Yerel stüdyoda ayrı bir kurgu işlemi başlatılır. Bu gösterimde gerçek müşteri fotoğrafı kullanılmamalıdır.",
            ],
            [
              "3D ve 360° aynı şey mi?",
              "Hayır. 3D örneğinde ölçülü sentetik odalarda dolaşılır. 360° örneğinde gerçek 2:1 panorama üzerinden sabit noktadan etrafa bakılır. AI üretimi ayrıca açılmalıdır.",
            ],
            [
              "Ücret veya işlem süresi ne kadar?",
              "Gerçek sağlayıcı fiyatı, işlem süresi ve ticari teslim kalitesi henüz doğrulanmadı. Yerel örnekte dış ücret alınmaz; ücretsiz kredi veya kesin teslim süresi vaadi yoktur.",
            ],
            [
              "Çıktıyı hemen indirebilir miyim?",
              "Hazır kamuya uygun örnekler ile kendi yerel projenizin teslimi ayrıdır. Kendi projenizin final dosyası farklı bir incelemeci onaylamadan indirilemez.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      </main>
      <footer className="sc-footer">
        <StudioWordmark />
        <p>
          Sentetik ürün gösterimi. Gerçek müşterilere açık ticari servis
          değildir.
        </p>
        <a href={studioHref}>Stüdyoyu aç</a>
      </footer>
      <dialog
        ref={login}
        className="ux-dialog"
        aria-labelledby="sc-login-title"
      >
        <div className="ux-section-heading">
          <h2 id="sc-login-title">Hesap erişimi</h2>
          <button
            type="button"
            className="subtle"
            aria-label="Giriş bilgisini kapat"
            onClick={() => login.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          Gerçek müşteri girişi henüz etkin değil. Bu deneyim sentetik örnekleri
          incelemek içindir.
        </p>
        {isolated ? (
          <p>
            İzole önizleme kimlik, yükleme veya yönetim servisi içermez.
            Dosyalar cihazda kalır.
          </p>
        ) : (
          <a href="/spaces/manage">Yerel demo hesabı ve yetkili yönetim</a>
        )}
        <button
          type="button"
          className="ux-primary"
          onClick={() => login.current?.close()}
        >
          Örneklere dön
        </button>
      </dialog>
    </div>
  );
}
