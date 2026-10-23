import { StrictMode, Suspense, lazy, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Upload,
  Play,
  Download,
  Check,
  Box,
  ArrowLeft,
  X,
} from "lucide-react";
import source from "../../fixtures/golden-v5/source.json";
import { validateGoldenSource } from "../domain/golden-property";
import { preflightSelection } from "../features/platform/media-preflight";
import "../app/platform.css";
import "./preview.css";
declare const SPACES_PREVIEW_BUILD_ID: string;

const plan = validateGoldenSource(source);
const SceneViewer = lazy(() =>
  import("../features/platform/scene-viewer").then((m) => ({
    default: m.SceneViewer,
  })),
);
const styles = [
  {
    id: "pov",
    label: "Doğal keşif",
    text: "Mekânı göz hizasından keşfetme hissi. Bu örnekte kaynak görseller hareket eder.",
  },
  {
    id: "cinematic",
    label: "Sinematik tanıtım",
    text: "Özenli kadrajlar, sakin geçişler ve ilanına uygun bir anlatım.",
  },
  {
    id: "hybrid",
    label: "Karma kurgu",
    text: "Keşif ve tanıtım ritmini bir araya getiren örnek kurgu.",
  },
] as const;
type Style = (typeof styles)[number]["id"];
type View = "create" | "projects" | "results" | "golden" | "tour";
type LocalMedia = {
  id: string;
  label: string;
  url: string | null;
  kind: "image" | "video";
  message: string;
};

function Preview() {
  const [view, setView] = useState<View>("create"),
    [step, setStep] = useState(1),
    [mode, setMode] = useState<Style>("cinematic"),
    [aspect, setAspect] = useState<"portrait" | "landscape">("portrait");
  const [media, setMedia] = useState<LocalMedia[]>([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [room, setRoom] = useState("living");
  const input = useRef<HTMLInputElement>(null),
    owned = useRef(new Set<string>()),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    const urls = owned.current;
    return () => {
      active.current = false;
      for (const u of urls) URL.revokeObjectURL(u);
      urls.clear();
    };
  }, []);
  const selected = styles.find((s) => s.id === mode)!;
  const clip = `/golden-v5/${mode}-${aspect}.mp4`;
  function navigate(v: View) {
    setView(v);
    setNotice("");
    document.getElementById("preview-main")?.focus();
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  async function select(files: FileList | null) {
    if (!files) return;
    if (media.length + files.length > 12) {
      setNotice("Bir seferde en fazla 12 örnek seçebilirsin.");
      return;
    }
    setBusy(true);
    setNotice("");
    const entries: LocalMedia[] = [];
    try {
      for (const f of Array.from(files)) {
        const result = await preflightSelection(f);
        let problem = result.supported ? null : result.message;
        if (!problem && f.type.startsWith("image/")) {
          const b = new Uint8Array(await f.slice(0, 12).arrayBuffer());
          const magic =
            f.type === "image/jpeg"
              ? b[0] === 255 && b[1] === 216 && b[2] === 255
              : f.type === "image/png"
                ? b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71
                : String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
                  String.fromCharCode(...b.slice(8, 12)) === "WEBP";
          if (!magic)
            problem =
              "Dosyanın içeriği seçilen biçimle uyuşmuyor. Başka bir örnek seç.";
        }
        if (!active.current) break;
        const url = problem ? null : URL.createObjectURL(f);
        if (url) owned.current.add(url);
        entries.push({
          id: crypto.randomUUID(),
          label: f.name.slice(0, 100),
          url,
          kind: f.type.startsWith("video/") ? "video" : "image",
          message: problem ?? "Yalnız bu tarayıcıda · sunucuya gönderilmedi",
        });
      }
      if (active.current)
        setMedia((current) => [...current, ...entries].slice(0, 12));
    } catch {
      if (active.current)
        setNotice("Dosya önizlenemedi. Desteklenen başka bir örnek seç.");
    } finally {
      if (active.current) setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  function examples() {
    for (const u of owned.current) URL.revokeObjectURL(u);
    owned.current.clear();
    setMedia(
      plan.scene.rooms.map((r) => ({
        id: r.id,
        label: r.label,
        url: `/golden-v5/${r.id}.png`,
        kind: "image",
        message: "Tarafımızdan tasarlanmış sentetik oda görünümü",
      })),
    );
    setNotice(
      "Golden Property örnekleri eklendi. Gerçek üretim bu önizlemede kapalı.",
    );
  }
  function remove(id: string) {
    setMedia((current) =>
      current.filter((m) => {
        if (m.id !== id) return true;
        if (m.url && owned.current.has(m.url)) {
          URL.revokeObjectURL(m.url);
          owned.current.delete(m.url);
        }
        return false;
      }),
    );
  }
  function reorder(index: number) {
    setMedia((current) => {
      const next = [...current];
      if (index > 0)
        [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
      return next;
    });
  }
  function result() {
    setStep(3);
    setNotice(
      "Hazır sentetik örnek gösteriliyor. Seçtiğin dosyalardan yeni video üretilmedi.",
    );
  }
  return (
    <div className="spaces-shell preview">
      <header className="pv-header">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("create");
          }}
          className="pv-brand"
          aria-label="ArtificAgent Spaces ana sayfa"
        >
          ArtificAgent <span>SPACES</span>
        </a>
        <span className="pv-badge">ÜRÜN ÖNİZLEMESİ</span>
      </header>
      <div className="pv-disclosure" role="note">
        Sentetik ürün önizlemesi — gerçek AI video üretimi henüz etkin değildir.
        Dosyalar cihazında kalır.
      </div>
      <nav className="pv-nav" aria-label="Ana gezinme">
        {(
          [
            ["create", "Oluştur"],
            ["projects", "Projelerim"],
            ["results", "Sonuçlar"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={view === id}
            onClick={() => navigate(id)}
          >
            {label}
          </button>
        ))}
        <div className="pv-secondary">
          <button onClick={() => navigate("golden")}>Golden Property</button>
          <button onClick={() => navigate("tour")}>
            <Box size={16} aria-hidden="true" /> 3D Premium / Beta
          </button>
        </div>
      </nav>
      <main id="preview-main" tabIndex={-1}>
        <input
          ref={input}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          aria-label="Mülk medyası seç"
          onChange={(e) => void select(e.target.files)}
        />
        {notice && (
          <div className="pv-notice" role="status">
            {notice}
          </div>
        )}
        {view === "create" && (
          <>
            <section className="pv-hero">
              <div>
                <p className="pv-eyebrow">MÜLKÜNÜN HİKÂYESİNİ GÖSTER</p>
                <h1>
                  Bir mekân.
                  <br />
                  <em>Güçlü bir ilk izlenim.</em>
                </h1>
                <p>
                  Fotoğraf ve videolarını ekle. Tarzını seç.
                  <br />
                  Örnek sonucu önizle ve incele.
                </p>
                <button
                  className="pv-primary"
                  onClick={() => {
                    setStep(1);
                    input.current?.click();
                  }}
                  disabled={busy}
                >
                  <Upload size={19} aria-hidden="true" />
                  Mülk medyasını yükle{" "}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
                <p className="pv-small">
                  Yalnız cihazında önizleme · Uzak sunucuya yüklenmez
                </p>
              </div>
              <figure>
                <img
                  src="/golden-v5/living.png"
                  alt="Golden Property: tasarlanmış sentetik salon; gerçek ilan fotoğrafı değil"
                />
                <figcaption>Golden Property 01 · Sentetik tasarım</figcaption>
              </figure>
            </section>
            <ol className="pv-steps" aria-label="İçerik adımları">
              {["Medyanı ekle", "Tarzını seç", "Önizle ve indir"].map(
                (s, i) => (
                  <li
                    key={s}
                    aria-current={step === i + 1 ? "step" : undefined}
                  >
                    <span>{i + 1}</span>
                    {s}
                  </li>
                ),
              )}
            </ol>
            {step === 1 && (
              <section className="pv-panel" aria-labelledby="upload-title">
                <p className="pv-eyebrow">01 / MEDYA</p>
                <h2 id="upload-title">Fotoğraf ve videolarını ekle</h2>
                <p>
                  İstersen hazır sentetik mülkü dene; kendi dosyan yalnız bu
                  sekmede görünür.
                </p>
                <button
                  className="pv-drop"
                  onClick={() => {
                    setStep(1);
                    input.current?.click();
                  }}
                  disabled={busy}
                >
                  <Upload size={36} aria-hidden="true" />
                  <strong>Dosyalarını seç</strong>
                  <span>JPEG, PNG, WebP veya desteklenen H.264 MP4</span>
                </button>
                <div className="pv-actions">
                  <button onClick={examples}>Örnek medyalarla dene</button>
                  <span className="pv-small">
                    HEIC, MOV, HEVC, WebM ve HDR desteklenmiyor.
                  </span>
                </div>
                <div className="pv-media">
                  {media.map((m, i) => (
                    <article key={m.id}>
                      {m.url ? (
                        m.kind === "video" ? (
                          <video
                            src={m.url}
                            controls
                            preload="metadata"
                            aria-label={m.label}
                          />
                        ) : (
                          <img
                            src={m.url}
                            alt={m.label}
                            onError={() =>
                              setNotice(
                                "Bu görsel tarayıcıda açılamadı. Başka bir örnek seç.",
                              )
                            }
                          />
                        )
                      ) : (
                        <div className="pv-file-error">
                          Desteklenmeyen biçim
                        </div>
                      )}
                      <h3>{m.label}</h3>
                      <p>{m.message}</p>
                      <div className="pv-actions">
                        <button
                          aria-label={`${m.label} kaldır`}
                          onClick={() => remove(m.id)}
                        >
                          <X size={16} aria-hidden="true" />
                          Kaldır
                        </button>
                        <button
                          disabled={i === 0}
                          aria-label={`${m.label} öne taşı`}
                          onClick={() => reorder(i)}
                        >
                          Öne taşı
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="pv-actions pv-end">
                  <button
                    className="pv-primary"
                    disabled={!media.some((m) => m.url) || busy}
                    onClick={() => setStep(2)}
                  >
                    Tarzını seç <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}
            {step === 2 && (
              <section className="pv-panel">
                <p className="pv-eyebrow">02 / TARZ</p>
                <h2>Nasıl bir video istersin?</h2>
                <div className="pv-style-grid">
                  {styles.map((s) => (
                    <button
                      key={s.id}
                      className="pv-style"
                      aria-pressed={mode === s.id}
                      onClick={() => setMode(s.id)}
                    >
                      <img
                        src={`/golden-v5/${s.id === "pov" ? "entrance" : s.id === "cinematic" ? "living" : "kitchen"}.png`}
                        alt=""
                      />
                      <span>
                        {s.label}
                        {mode === s.id && (
                          <Check size={18} aria-hidden="true" />
                        )}
                      </span>
                      <p>{s.text}</p>
                    </button>
                  ))}
                </div>
                <label className="pv-label">
                  Paylaşım biçimi
                  <select
                    aria-label="Video biçimi"
                    value={aspect}
                    onChange={(e) => setAspect(e.target.value as typeof aspect)}
                  >
                    <option value="portrait">
                      Dikey · Reels / Story · 360 × 640
                    </option>
                    <option value="landscape">
                      Yatay · YouTube / İlan · 640 × 360
                    </option>
                  </select>
                </label>
                <p className="pv-small">
                  Bu önizlemede 4 saniyelik, önceden hazırlanmış yerel örnekler
                  vardır. Şablon ve gerçek üretim hizmetleri kapalıdır.
                </p>
                <div className="pv-actions pv-end">
                  <button onClick={() => setStep(1)}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Medyaya dön
                  </button>
                  <button className="pv-primary" onClick={result}>
                    Örnek sonucu göster <Play size={17} aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}
            {step === 3 && (
              <section className="pv-panel">
                <p className="pv-eyebrow">03 / ÖNİZLEME</p>
                <h2>{selected.label}</h2>
                <Result clip={clip} aspect={aspect} onAspect={setAspect} />
                <button onClick={() => setStep(2)}>Tarza dön</button>
              </section>
            )}
          </>
        )}
        {view === "projects" && (
          <section className="pv-panel">
            <p className="pv-eyebrow">SENTETİK KOLEKSİYON</p>
            <h1>Projelerim</h1>
            <p>
              Örnek portföy. Gerçek müşteri kaydı, adres veya fiyat içermez.
            </p>
            <div className="pv-style-grid">
              <article>
                <img
                  src="/golden-v5/living.png"
                  alt="Golden Property sentetik salon"
                />
                <h2>Golden Property 01</h2>
                <p>5 alan · ölçülü tasarım · açık tavan kesiti</p>
                <button
                  className="pv-primary"
                  onClick={() => {
                    examples();
                    navigate("create");
                    setStep(2);
                  }}
                >
                  Örnek içerik akışını aç
                </button>
                <button onClick={() => navigate("golden")}>
                  Planı ve odaları incele
                </button>
              </article>
              <article>
                <img
                  src="/spaces-examples/interior.svg"
                  alt="V3 özgün sentetik iç mekân illüstrasyonu"
                />
                <h2>Studio Collection</h2>
                <p>V3 yerel kurgudan bir illüstrasyon örneği.</p>
                <video
                  src="/spaces-examples/cinematic.mp4"
                  controls
                  preload="none"
                  aria-label="V3 hazır sentetik tanıtım örneği"
                />
              </article>
            </div>
          </section>
        )}
        {view === "results" && (
          <section className="pv-panel">
            <p className="pv-eyebrow">HAZIR ÖRNEKLER</p>
            <h1>Sonuçlar</h1>
            <p>
              Bu dosyalar önceden, yerel işlem hattında hazırlandı. Yeni üretim
              veya yayın onayı değildir.
            </p>
            <div className="pv-actions">
              {styles.map((s) => (
                <button
                  key={s.id}
                  aria-pressed={mode === s.id}
                  onClick={() => setMode(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <h2>{selected.label}</h2>
            <Result clip={clip} aspect={aspect} onAspect={setAspect} />
          </section>
        )}
        {view === "golden" && (
          <section className="pv-panel">
            <p className="pv-eyebrow">GOLDEN PROPERTY 01</p>
            <h1>Tasarlanan mekânı tanı</h1>
            <p>
              Bu mülk sıfırdan, ölçülü sentetik planla tasarlandı. Gerçek bir
              evin fotoğraflardan rekonstrüksiyonu değildir. Pencerelerin
              dışında doğrulanmış manzara, balkon veya fiziksel güneş
              simülasyonu yoktur.
            </p>
            <div className="pv-golden-grid">
              <img
                className="pv-plan"
                src="/golden-v5/floor-plan.svg"
                alt="Giriş, koridor, salon, mutfak ve yatak odasının metrik planı; yeşil dört kapı, mavi üç pencere"
              />
              <div>
                <h2>Ölçüler tasarım kaynağından gelir</h2>
                <table>
                  <caption>
                    Sentetik odaların duvar eksenlerine göre tasarım ölçüleri
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
                <p>
                  Tavan yüksekliği 2,8 m; model açık tavan kesitidir. Malzeme ve
                  ışık örnektir; fotoğraf gerçekçiliği doğrulanmadı. Duvar
                  kalınlığı alanlardan düşülmez; gerçek konut net/brüt alanı
                  değildir.
                </p>
                <button className="pv-primary" onClick={() => navigate("tour")}>
                  3D içinde gez <ArrowRight size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <label className="pv-label">
              Oda görünümü
              <select
                aria-label="Oda görünümü"
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
            <img
              className="pv-room-view"
              src={`/golden-v5/${room}.png`}
              alt={`${plan.scene.rooms.find((r) => r.id === room)?.label} · sabit kamera ile üretilmiş sentetik görünüm`}
            />
            <details>
              <summary>Kaynak ve doğruluk bilgileri</summary>
              <p>
                5 alan, 4 iç kapı ve 3 pencere CAD kaynağına bağlıdır. Görüşler
                sabit kamera/FOV ile Blender CPU'da üretildi. Mobilya, mülkiyet,
                satış fiyatı ve çevre bilgisi yoktur. İnsan incelemesi henüz
                tamamlanmadı.
              </p>
              <a
                href="/golden-v5/evidence.json"
                target="_blank"
                rel="noreferrer"
              >
                Sentetik dosya ve kaynak kanıtını aç
              </a>
            </details>
          </section>
        )}
        {view === "tour" && (
          <section className="pv-panel">
            <p className="pv-eyebrow">PREMIUM / BETA</p>
            <h1>3D Sanal Tur</h1>
            <p>
              Ölçülü sentetik modelde serbestçe gez. Işık ve günün zamanı
              sanatsal örnektir. Sesli rehber ve gerçek mülk üretimi bu yayında
              kapalıdır. Hafif görünümle açılır; ek gölge ve efektleri Kalite
              seçeneğinden açabilirsin.
            </p>
            <Suspense fallback={<p role="status">3D görünüm hazırlanıyor…</p>}>
              <SceneViewer
                scene={plan.scene}
                modelUrl="/golden-v5/property.glb"
                initialQuality="low"
              />
            </Suspense>
            <button onClick={() => navigate("golden")}>
              Planı ve ölçüleri aç
            </button>
          </section>
        )}
      </main>
      <footer className="pv-footer">
        <span>ARTIFICAGENT SPACES</span>
        <span>Sentetik inceleme · Canlı hizmet ve ödeme kapalı</span>
        <small>
          Kaynak sürüm{" "}
          <span id="preview-build-id">{SPACES_PREVIEW_BUILD_ID}</span>
        </small>
      </footer>
    </div>
  );
}
function Result({
  clip,
  aspect,
  onAspect,
}: {
  clip: string;
  aspect: "portrait" | "landscape";
  onAspect: (a: "portrait" | "landscape") => void;
}) {
  return (
    <>
      <p className="pv-notice">
        Hazır sentetik örnek — seçtiğin dosyalardan üretilmedi. Yerel kaynak
        görsel kurgusu; fotogerçekçi AI yürüyüşü değil.
      </p>
      <video
        key={clip}
        className={`pv-result ${aspect}`}
        src={clip}
        controls
        preload="metadata"
        aria-label="Hazır yerel sentetik video önizlemesi"
      />
      <label className="pv-label">
        Video biçimi
        <select
          aria-label="Video biçimi"
          value={aspect}
          onChange={(e) => onAspect(e.target.value as typeof aspect)}
        >
          <option value="portrait">Dikey · 360 × 640 · MP4</option>
          <option value="landscape">Yatay · 640 × 360 · MP4</option>
        </select>
      </label>
      <p>
        4 saniye · H.264 MP4 · sessiz. Yalnız hazır örnek dosya indirilir. Kendi
        içeriğini üretme ve üçüncü taraf hesaplarına paylaşım kapalıdır.
      </p>
      <a className="pv-primary" href={clip} download>
        <Download size={18} aria-hidden="true" />
        Örnek MP4'ü indir
      </a>
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw Error("PREVIEW_ROOT_REQUIRED");
createRoot(root).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
