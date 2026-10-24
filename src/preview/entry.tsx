import { StrictMode, Suspense, lazy, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Upload,
  Play,
  Download,
  X,
  MoveUp,
  Replace,
  RotateCcw,
  Box,
  ShieldCheck,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import source from "../../fixtures/golden-v5/source.json";
import type { GoldenPlan } from "../domain/golden-property";
import type { SceneController } from "../features/platform/scene-viewer";
import { VIDEO_STYLES } from "../domain/video-styles";
import {
  MEDIA_PICKER_ACCEPT,
  MEDIA_UPLOAD_HELP_TR,
} from "../domain/media-capabilities";
import {
  StudioWordmark,
  StudioSteps,
  StudioStyleCards,
  type VideoStyleId,
} from "../features/platform/studio-presentation";
import { useLocalMedia, type LocalMedia } from "./use-local-media";
import "../app/studio-visual.css";
import "./preview.css";
declare const SPACES_PREVIEW_BUILD_ID: string;
// This immutable fixture is hash/schema validated by build-owner-preview.ts. No client-supplied scene.
// Immutable source is schema-validated and hash-bound by build-owner-preview.ts.
const plan = source as unknown as GoldenPlan;
// Match the independently authored entrance-camera evidence; no inferred room or geometry.
const openingCamera = plan.cameras.find((c) => c.id === "camera-entrance")!;
const openingYaw = Math.atan2(
  openingCamera.position[0] - openingCamera.target[0],
  openingCamera.position[2] - openingCamera.target[2],
);
const SceneViewer = lazy(() =>
  import("../features/platform/scene-viewer").then((m) => ({
    default: m.SceneViewer,
  })),
);
type View = "create" | "examples" | "property" | "results" | "tour";
type Aspect = "portrait" | "landscape";

function Preview() {
  const [view, setView] = useState<View>("create"),
    [step, setStep] = useState(1),
    [mode, setMode] = useState<VideoStyleId>("cinematic"),
    [aspect, setAspect] = useState<Aspect>("portrait"),
    [room, setRoom] = useState("living"),
    [tourActive, setTourActive] = useState(false),
    [inspected, setInspected] = useState<string | null>(null);
  const local = useLocalMedia();
  const input = useRef<HTMLInputElement>(null),
    replaceTarget = useRef<string | null>(null),
    dialog = useRef<HTMLDialogElement>(null),
    viewer = useRef<SceneController>(null);
  const selected = local.media.find((m) => m.id === inspected);
  useEffect(() => {
    const d = dialog.current;
    if (inspected && d && !d.open) d.showModal();
    if (!inspected && d?.open) d.close();
  }, [inspected]);
  const clip = `/golden-v5/${mode}-${aspect}.mp4`,
    poster = `/studio-assets-v52/${mode}-${aspect}.webp`;
  function navigate(next: View) {
    setView(next);
    local.setNotice("");
    document.getElementById("preview-main")?.focus();
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function openPicker(id?: string) {
    replaceTarget.current = id ?? null;
    input.current?.click();
  }
  function examples() {
    if (
      local.examples(
        plan.scene.rooms.map((r) => ({
          id: r.id,
          label: r.label,
          url: `/golden-v5/${r.id}.png`,
          kind: "image",
          message: "Sentetik örnek görünüm",
        })),
      )
    ) {
      setStep(2);
      navigate("create");
    } else navigate("results");
  }
  function changeStep(next: number) {
    setStep(next);
    document.getElementById("preview-main")?.focus();
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  const videoTitle = VIDEO_STYLES.find((s) => s.id === mode)!.label;
  return (
    <div className="studio-theme preview">
      <a href="#preview-main" className="studio-skip">
        İçeriğe geç
      </a>
      <header className="pv52-header">
        <a
          href="#"
          className="pv52-brand"
          aria-label="ArtificAgent Spaces ana sayfa"
          onClick={(e) => {
            e.preventDefault();
            navigate("create");
          }}
        >
          <StudioWordmark />
        </a>
        <span className="pv52-edition">EMLAK STÜDYOSU</span>
      </header>
      <div className="pv52-topline">
        <nav className="pv52-nav" aria-label="Ana gezinme">
          {(
            [
              ["create", "Oluştur"],
              ["examples", "Örnekler"],
              ["tour", "3D Tur"],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-current={
                (
                  id === "examples"
                    ? ["examples", "property", "results"].includes(view)
                    : view === id
                )
                  ? "page"
                  : undefined
              }
              onClick={() => navigate(id)}
            >
              {label}
              {id === "tour" && <ArrowUpRight size={14} aria-hidden="true" />}
            </button>
          ))}
        </nav>
        <p className="pv52-disclosure">
          <span aria-hidden="true" />
          Ürün önizlemesi · Gerçek AI video üretimi henüz aktif değil
        </p>
      </div>
      <main id="preview-main" tabIndex={-1}>
        <input
          ref={input}
          type="file"
          accept={MEDIA_PICKER_ACCEPT}
          multiple
          hidden
          aria-label="Mülk medyası seç"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []),
              id = replaceTarget.current;
            replaceTarget.current = null;
            void local.select(files, id);
            e.target.value = "";
          }}
        />
        {local.notice && (
          <p className="studio-note pv52-status" role="status">
            {local.notice}
          </p>
        )}
        {view === "create" && (
          <>
            <div
              className={`pv52-studio-heading ${step > 1 ? "is-compact" : ""}`}
            >
              <div>
                <p className="studio-eyebrow">SİZİN İÇİN BİR BAŞLANGIÇ</p>
                <h1 className="studio-title">
                  Mülkünüz,
                  <br />
                  <em>sizin imzanız.</em>
                </h1>
                <p className="pv52-lead">
                  Fotoğraf ve videolarınızla başlayın.
                </p>
              </div>
              <div className="pv52-intro-note">
                <span>01 — 03</span>
                <p>
                  Önce mekân.
                  <br />
                  Sonra anlatım.
                </p>
              </div>
            </div>
            <StudioSteps
              step={step}
              onStep={changeStep}
              canAdvance={local.media.some((m) => m.url)}
              disabled={local.busy}
            />
            {step === 1 && (
              <section
                className="pv52-workspace studio-enter"
                aria-label="Medya stüdyosu"
                key="media"
              >
                <div className="pv52-media-column">
                  <UploadArea
                    busy={local.busy}
                    hasMedia={local.media.length > 0}
                    onPicker={() => openPicker()}
                    onExamples={examples}
                    onDrop={(files) => void local.select(files)}
                  />
                  {local.media.length > 0 && (
                    <>
                      <div className="pv52-media-heading">
                        <h2>
                          Seçiminiz <span>{local.media.length}/12</span>
                        </h2>
                        <span className="studio-quiet">
                          Sıralayın, değiştirin, göz atın.
                        </span>
                      </div>
                      <div
                        className="pv52-media-grid"
                        role="group"
                        aria-label="Seçilen medya"
                      >
                        {local.media.map((m, i) => (
                          <MediaCard
                            key={m.id}
                            media={m}
                            index={i}
                            busy={local.busy}
                            onInspect={() => setInspected(m.id)}
                            onReplace={() => openPicker(m.id)}
                            onUp={() => local.reorder(m.id)}
                            onRemove={() => {
                              if (!local.remove(m.id)) setStep(1);
                            }}
                            onError={() => local.markUnreadable(m.id)}
                          />
                        ))}
                      </div>
                      <div className="pv52-next">
                        <p className="studio-quiet">
                          Seçtiklerin yalnız bu sekmede kalır.
                        </p>
                        <button
                          className="studio-primary"
                          disabled={
                            local.busy || !local.media.some((m) => m.url)
                          }
                          onClick={() => changeStep(2)}
                        >
                          Tarzını seç
                          <ArrowRight size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <aside className="pv52-studio-aside">
                  <div className="pv52-architectural-rule" aria-hidden="true" />
                  <p className="studio-eyebrow">BİR MEKÂN. ÜÇ ANLATIM.</p>
                  <h2>
                    Her detayın
                    <br />
                    <em>bir hikâyesi var.</em>
                  </h2>
                  <p>
                    Sakin bir keşif, sinematik bir tanıtım ya da ikisinin
                    dengesi. Önce tarzı seçin, sonra gerçek örnek videoya göz
                    atın.
                  </p>
                  <ol>
                    <li>
                      <span>01</span>Medyanızı ekleyin
                    </li>
                    <li>
                      <span>02</span>Anlatımınızı seçin
                    </li>
                    <li>
                      <span>03</span>Hazır örneği inceleyin
                    </li>
                  </ol>
                  <p className="pv52-aside-truth">
                    <ShieldCheck size={16} aria-hidden="true" />
                    Bu önizlemede yeni video üretilmez. Örneklerimiz sentetik
                    kaynaklardan hazırlanmış gerçek MP4 dosyalarıdır.
                  </p>
                </aside>
              </section>
            )}
            {step === 2 && (
              <section className="pv52-style-stage studio-enter" key="styles">
                <div className="pv52-section-heading">
                  <div>
                    <p className="studio-eyebrow">02 / ANLATIM</p>
                    <h2>Nasıl bir his bıraksın?</h2>
                    <p>Bir tarz seçin. Geri kalanını sade tuttuk.</p>
                  </div>
                  <button
                    className="studio-text-button"
                    onClick={() => changeStep(1)}
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Medyaya dön
                  </button>
                </div>
                <StudioStyleCards value={mode} onSelect={setMode} />
                <div className="pv52-style-bottom">
                  <FormatChoice aspect={aspect} onChange={setAspect} />
                  <button
                    className="studio-primary"
                    onClick={() => changeStep(3)}
                  >
                    Hazır videoyu aç
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
                <p className="pv52-truth">
                  Hazır sentetik örnek gösterilir. Seçtiğiniz dosyalar bu örneği
                  üretmez veya değiştirmez.
                </p>
              </section>
            )}
            {step === 3 && (
              <section className="studio-enter" key="result">
                <div className="pv52-section-heading">
                  <div>
                    <p className="studio-eyebrow">03 / ÖNİZLEME</p>
                    <h2>{videoTitle}</h2>
                  </div>
                  <button
                    className="studio-text-button"
                    onClick={() => changeStep(2)}
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Tarza dön
                  </button>
                </div>
                <SampleResult
                  clip={clip}
                  poster={poster}
                  aspect={aspect}
                  onAspect={setAspect}
                />
              </section>
            )}
          </>
        )}
        {view === "examples" && (
          <section className="studio-enter">
            <PageTitle
              eyebrow="STÜDYODAN SEÇKİ"
              title="Örnek projeler"
              text="Tamamı bizim için tasarlanmış sentetik örnekler. Kaydedilmiş kişisel projeleriniz değildir."
            />
            <div className="pv52-projects">
              <article className="pv52-project-primary">
                <figure>
                  <img
                    src="/studio-assets-v52/cinematic-landscape.webp"
                    width={640}
                    height={360}
                    loading="lazy"
                    alt="Ölçülü sentetik örnek mülkün gerçek video karesi"
                  />
                  <figcaption>
                    Ölçülü sentetik tasarım · Gerçek konut değil
                  </figcaption>
                </figure>
                <div>
                  <span className="studio-eyebrow">ÖRNEK 01</span>
                  <h2>
                    Bir mekânı
                    <br />
                    <em>yakından tanıyın.</em>
                  </h2>
                  <p>
                    Beş oda, metrik plan ve gerçek serbest gezinme. Aynı mekâna
                    üç video yaklaşımı.
                  </p>
                  <div className="pv52-actions">
                    <button
                      className="studio-primary"
                      onClick={() => navigate("property")}
                    >
                      Örnek mülkü aç
                      <ArrowUpRight size={17} aria-hidden="true" />
                    </button>
                    <button
                      className="studio-text-button"
                      onClick={() => navigate("results")}
                    >
                      <Play size={16} aria-hidden="true" />
                      Örnek videolar
                    </button>
                  </div>
                </div>
              </article>
              <article className="pv52-project-secondary">
                <img
                  src="/spaces-examples/interior.svg"
                  width={960}
                  height={640}
                  loading="lazy"
                  alt="Özgün sentetik salon illüstrasyonu"
                />
                <div>
                  <p className="studio-eyebrow">ARŞİVDEN</p>
                  <h3>Çizgisel bir bakış</h3>
                  <p>
                    İlk stüdyo örneklerimiz. Gerçek ilan veya fotoğraf değil.
                  </p>
                  <details>
                    <summary>Özgün yerel videoyu izle</summary>
                    <video
                      controls
                      playsInline
                      preload="none"
                      poster="/studio-assets-v52/style-cinematic.webp"
                      src="/spaces-examples/cinematic.mp4"
                      aria-label="Çizgisel sentetik örnek video"
                    />
                  </details>
                </div>
              </article>
            </div>
          </section>
        )}
        {view === "property" && (
          <section className="studio-enter">
            <PageTitle
              eyebrow="ÖRNEK MÜLK / 01"
              title="Mekânı, her yönüyle."
              text="Bu örnek sıfırdan tasarlanmış sentetik bir modeldir. Gerçek bir evin fotoğraflardan rekonstrüksiyonu değildir."
            />
            <div className="pv52-property-gallery">
              <figure>
                <img
                  src={`/golden-v5/${room}.png`}
                  width={640}
                  height={360}
                  alt={`${plan.scene.rooms.find((r) => r.id === room)!.label} · sabit kamera ile sentetik oda görünümü`}
                />
                <figcaption>
                  Sentetik oda görünümü · Mobilyasız tasarım
                </figcaption>
              </figure>
              <div>
                <span className="studio-eyebrow">ODA GÖRÜNÜMLERİ</span>
                <label className="pv52-field">
                  Oda görünümü
                  <select
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                  >
                    {plan.scene.rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Beş alan. Dört kapı açıklığı. Üç pencere. Işık ve malzemeler
                  sanatsal örnektir; fotoğraf gerçekçiliği doğrulanmadı.
                </p>
                <button
                  className="studio-primary"
                  onClick={() => navigate("tour")}
                >
                  3D turu keşfet
                  <ArrowUpRight size={17} aria-hidden="true" />
                </button>
                <button className="studio-text-button" onClick={examples}>
                  {local.media.length
                    ? "Örnek videoları incele"
                    : "Örnek mülkle dene"}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            <details className="pv52-plan" open>
              <summary>Plan ve tasarım ölçüleri</summary>
              <div className="pv52-plan-grid">
                <img
                  src="/golden-v5/floor-plan.svg"
                  width={700}
                  height={600}
                  loading="lazy"
                  alt="Giriş, koridor, salon, mutfak ve yatak odasının metrik planı; dört kapı, üç pencere"
                />
                <div>
                  <table>
                    <caption>
                      Duvar eksenlerine göre sentetik tasarım ölçüleri
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Alan</th>
                        <th scope="col">Ölçü</th>
                        <th scope="col">Alan m²</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.scene.rooms.map((r) => (
                        <tr key={r.id}>
                          <th scope="row">{r.label}</th>
                          <td>
                            {r.width} × {r.depth} m
                          </td>
                          <td>{(r.width * r.depth).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="studio-quiet">
                    Toplam 78,4 m² tasarım alanı. Duvar kalınlığı düşülmez;
                    gerçek konut net/brüt alanı değildir. Tavan 2,8 m, model
                    açık tavan kesitidir.
                  </p>
                  <p className="studio-quiet">
                    Balkon, dış manzara, mobilya ve fiziksel güneş kalibrasyonu
                    modellenmedi. Bilinmeyen alanlara rota verilmez.
                  </p>
                </div>
              </div>
            </details>
          </section>
        )}
        {view === "results" && (
          <section className="studio-enter">
            <PageTitle
              eyebrow="GERÇEK DOSYA / YEREL KURGU"
              title="Örnek videolar"
              text="Üç tarz, aynı sentetik mekân. İzleyin, biçimi seçin ve örneği indirin."
            />
            <div
              className="pv52-video-tabs"
              role="group"
              aria-label="Örnek video tarzı"
            >
              {VIDEO_STYLES.map((s) => (
                <button
                  key={s.id}
                  aria-pressed={mode === s.id}
                  onClick={() => setMode(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <SampleResult
              clip={clip}
              poster={poster}
              aspect={aspect}
              onAspect={setAspect}
            />
          </section>
        )}
        {view === "tour" && (
          <section className="studio-enter">
            <PageTitle
              eyebrow="SERBEST GEZİNME / ÖRNEK MODEL"
              title="Mekânın içine girin."
              text="Ölçülü sentetik modelde yürüyün, etrafa bakın, günün sanatsal ışığını değiştirin. Bu bir video veya panorama değildir."
            />
            <div className="pv52-tour" data-active={tourActive}>
              <div className="pv52-tour-top">
                <span>
                  <Box size={15} aria-hidden="true" />
                  Örnek mülk · 5 alan
                </span>
                <span>Hafif görünüm</span>
              </div>
              {!tourActive ? (
                <div className="pv52-tour-poster">
                  <img
                    src="/studio-assets-v52/pov-landscape.webp"
                    width={640}
                    height={360}
                    alt="Sentetik modelin video karesi; gezinmeyi başlatmadan önce örnek görünüm"
                  />
                  <div>
                    <p>Kapıyı aralayın.</p>
                    <button
                      className="studio-primary"
                      onClick={() => setTourActive(true)}
                    >
                      <Play size={18} aria-hidden="true" />
                      3D turu başlat
                    </button>
                    <span>3D dosyası yalnız bu eylemle yüklenir.</span>
                  </div>
                </div>
              ) : (
                <>
                  <Suspense
                    fallback={
                      <p className="pv52-loading" role="status">
                        3D görünüm yükleniyor…
                      </p>
                    }
                  >
                    <SceneViewer
                      ref={viewer}
                      scene={plan.scene}
                      modelUrl="/golden-v5/property.glb"
                      initialQuality="low"
                      initialYaw={openingYaw}
                    />
                  </Suspense>
                  <div className="pv52-tour-actions">
                    <button
                      onClick={() => {
                        if (!viewer.current) {
                          local.setNotice(
                            "3D görünüm henüz hazır değil. Tekrar deneyin.",
                          );
                          return;
                        }
                        void viewer.current
                          .execute({ type: "reset_view" })
                          .then(() =>
                            local.setNotice("Başlangıç görünümüne dönüldü."),
                          )
                          .catch(() =>
                            local.setNotice(
                              "3D görünüm henüz hazır değil. Tekrar deneyin.",
                            ),
                          );
                      }}
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                      Başlangıca dön
                    </button>
                    <button onClick={() => setTourActive(false)}>
                      <X size={16} aria-hidden="true" />
                      Turu kapat
                    </button>
                  </div>
                </>
              )}
              <p className="pv52-tour-truth">
                Gerçek konut rekonstrüksiyonu değil. Işık ve günün zamanı
                sanatsal; sesli rehber ve gerçek AI üretimi bu önizlemede
                kapalı.
              </p>
            </div>
            <div className="pv52-tour-bottom">
              <button
                className="studio-text-button"
                onClick={() => navigate("property")}
              >
                Plan ve odaları incele
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
              <p className="studio-quiet">
                WASD / ok tuşları, sürükleyerek bakış ve dokunmatik yön tuşları.
              </p>
            </div>
          </section>
        )}
      </main>
      <footer className="pv52-footer">
        <span>ArtificAgent Spaces</span>
        <span>Bir mekâna yeni bir bakış.</span>
        <details>
          <summary>Teknik bilgi</summary>
          <p>
            Yerel sentetik önizleme · Canlı AI, ses, ödeme, paylaşım ve müşteri
            backend'i kapalı.
          </p>
          <p>
            Kaynak sürüm{" "}
            <code id="preview-build-id">{SPACES_PREVIEW_BUILD_ID}</code>
          </p>
          <a href="/golden-v5/evidence.json" target="_blank" rel="noreferrer">
            Sentetik dosya ve kaynak kanıtları
            <ArrowUpRight size={13} aria-hidden="true" />
          </a>
          <a
            href="/studio-assets-v52/manifest.json"
            target="_blank"
            rel="noreferrer"
          >
            Görsel ve font lisans kayıtları
            <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </details>
      </footer>
      <dialog
        className="pv52-lightbox"
        ref={dialog}
        onClose={() => setInspected(null)}
        onCancel={() => setInspected(null)}
        aria-labelledby="media-preview-title"
      >
        <div>
          <h2 id="media-preview-title">
            {selected?.label ?? "Dosya önizlemesi"}
          </h2>
          <button
            className="studio-icon-button"
            aria-label="Önizlemeyi kapat"
            onClick={() => setInspected(null)}
          >
            <X size={19} />
          </button>
        </div>
        {selected?.url &&
          (selected.kind === "video" ? (
            <video
              controls
              playsInline
              preload="metadata"
              src={selected.url}
              aria-label="Yerel dosya önizlemesi"
            />
          ) : (
            <img
              src={selected.url}
              alt="Seçilen dosyanın yalnız bu tarayıcıdaki önizlemesi"
            />
          ))}
        <p className="studio-quiet">
          Dosya bu cihazda. Uzak sunucuya gönderilmedi.
        </p>
      </dialog>
    </div>
  );
}

function UploadArea({
  busy,
  hasMedia,
  onPicker,
  onExamples,
  onDrop,
}: {
  busy: boolean;
  hasMedia: boolean;
  onPicker: () => void;
  onExamples: () => void;
  onDrop: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <section
      className={`pv52-upload ${dragging ? "is-dragging" : ""} ${hasMedia ? "has-media" : ""}`}
      aria-label="Dosya bırakma alanı"
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (
          !(e.relatedTarget instanceof Node) ||
          !e.currentTarget.contains(e.relatedTarget)
        )
          setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!busy) onDrop(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="pv52-upload-motif" aria-hidden="true">
        <Upload size={24} strokeWidth={1.5} />
      </div>
      <h2>
        {hasMedia ? "Bir açı daha ekleyin." : "İyi bir hikâye burada başlar."}
      </h2>
      <p>Fotoğraf ve videolarınızı buraya bırakın.</p>
      <button className="studio-primary" disabled={busy} onClick={onPicker}>
        <Upload size={17} aria-hidden="true" />
        Fotoğraf veya video ekle
        <ArrowUpRight size={17} aria-hidden="true" />
      </button>
      {!hasMedia && (
        <button
          className="studio-text-button pv52-example-action"
          disabled={busy}
          onClick={onExamples}
        >
          Örnek mülkle dene
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      )}
      <span className="pv52-device-note">
        <ShieldCheck size={13} aria-hidden="true" />
        Dosyalar bu cihazda kalır
      </span>
      <details className="pv52-formats">
        <summary>Desteklenen biçimler</summary>
        <p>{MEDIA_UPLOAD_HELP_TR.photos}</p>
        <p>{MEDIA_UPLOAD_HELP_TR.videos}</p>
        <p>{MEDIA_UPLOAD_HELP_TR.iphone}</p>
        <p>
          Bu yalnız cihazda önizlemedir; yükleme veya güvenli server işleme
          yapılmaz.
        </p>
      </details>
    </section>
  );
}
function MediaCard({
  media: m,
  index,
  busy,
  onInspect,
  onReplace,
  onUp,
  onRemove,
  onError,
}: {
  media: LocalMedia;
  index: number;
  busy: boolean;
  onInspect: () => void;
  onReplace: () => void;
  onUp: () => void;
  onRemove: () => void;
  onError: () => void;
}) {
  return (
    <article
      className={`pv52-media-card studio-media-enter ${m.url ? "" : "is-error"}`}
    >
      <button
        className="pv52-thumbnail"
        disabled={!m.url}
        onClick={onInspect}
        aria-label={`${m.label} önizle`}
      >
        {m.url ? (
          m.kind === "video" ? (
            <video
              src={m.url}
              muted
              preload="metadata"
              aria-hidden="true"
              onError={onError}
            />
          ) : (
            <img src={m.url} alt="" onError={onError} />
          )
        ) : (
          <ImageIcon aria-hidden="true" />
        )}
      </button>
      <div>
        <h3 title={m.label}>{m.label}</h3>
        <p>
          {m.url ? (
            m.message
          ) : (
            <>
              <strong>Desteklenmeyen biçim</strong>
              <br />
              {m.message}
            </>
          )}
        </p>
      </div>
      <div className="pv52-media-tools">
        <button
          className="studio-icon-button"
          disabled={index === 0 || busy}
          onClick={onUp}
          aria-label={`${m.label} öne taşı`}
        >
          <MoveUp size={15} />
        </button>
        <button
          className="studio-icon-button"
          disabled={busy}
          onClick={onReplace}
          aria-label={`${m.label} değiştir`}
        >
          <Replace size={15} />
        </button>
        <button
          className="studio-icon-button"
          disabled={busy}
          onClick={onRemove}
          aria-label={`${m.label} kaldır`}
        >
          <X size={16} />
        </button>
      </div>
    </article>
  );
}
function FormatChoice({
  aspect,
  onChange,
}: {
  aspect: Aspect;
  onChange: (value: Aspect) => void;
}) {
  return (
    <label className="pv52-field pv52-format-choice">
      Video biçimi
      <select
        aria-label="Video biçimi"
        value={aspect}
        onChange={(e) => onChange(e.target.value as Aspect)}
      >
        <option value="portrait">Dikey · 360 × 640 · Reels / Story</option>
        <option value="landscape">Yatay · 640 × 360 · YouTube / İlan</option>
      </select>
    </label>
  );
}
function SampleResult({
  clip,
  poster,
  aspect,
  onAspect,
}: {
  clip: string;
  poster: string;
  aspect: Aspect;
  onAspect: (value: Aspect) => void;
}) {
  const [ready, setReady] = useState(false);
  return (
    <>
      <p className="pv52-origin">
        <Check size={15} aria-hidden="true" />
        <span>
          <strong>Hazır sentetik örnek.</strong> Bu hazır örnek videodur;
          seçtiğin dosyadan oluşturulmadı.
        </span>
      </p>
      <div
        className={`pv52-player ${ready ? "is-ready" : ""}`}
        data-aspect={aspect}
      >
        <div className="pv52-player-bar">
          <span>ARTIFICAGENT / SPACES</span>
          <span>YEREL KURGU</span>
        </div>
        <video
          key={clip}
          controls
          playsInline
          preload="none"
          poster={poster}
          src={clip}
          aria-label="Hazır sentetik örnek video"
          onLoadStart={() => setReady(false)}
          onLoadedData={() => setReady(true)}
        />
        <div className="pv52-player-meta">
          <span>4 sn örnek · H.264 MP4 · Sessiz</span>
          <span>
            {aspect === "portrait" ? "9:16 · 360 × 640" : "16:9 · 640 × 360"}
          </span>
        </div>
      </div>
      <div className="pv52-result-actions">
        <FormatChoice aspect={aspect} onChange={onAspect} />
        <a className="studio-primary" href={clip} download>
          <Download size={17} aria-hidden="true" />
          Örnek MP4'ü indir
          <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </div>
      <p className="pv52-truth">
        Yerel kaynak-görsel hareketi ve kesme örneği; fotogerçekçi AI yürüyüşü
        değil. Yeni üretim, sosyal hesaba paylaşım ve yayın bu önizlemede etkin
        değildir.
      </p>
    </>
  );
}
function PageTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="pv52-page-title">
      <p className="studio-eyebrow">{eyebrow}</p>
      <h1 className="studio-title">{title}</h1>
      <p>{text}</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
