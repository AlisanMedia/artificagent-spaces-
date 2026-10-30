"use client";

import { ProviderReadinessPanel } from "./provider-readiness-panel";
import { AdminServiceResearch } from "../services/admin-service-research";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  Box,
  CheckCircle2,
  Clapperboard,
  Eye,
  Layers3,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type {
  AnalyticsView,
  AssetView,
  Bootstrap,
  JobView,
  PartnerView,
  PropertyView,
  WorkspaceView,
} from "@/contracts/platform-ui";
import type { BrandTheme } from "@/domain/platform";
import { api, localRequest, modeLabels, saveBlob, stateLabels } from "./client";

const Viewer = dynamic(
  () => import("./scene-viewer").then((m) => m.SceneViewer),
  { ssr: false, loading: () => <p>3D görüntüleyici yükleniyor…</p> },
);
const tabs = [
  { id: "properties", label: "Mülkler" },
  { id: "studio", label: "Üretim stüdyosu" },
  { id: "review", label: "Kalite & inceleme" },
  { id: "analytics", label: "Etkileşim" },
  { id: "brand", label: "Marka" },
  { id: "partner", label: "Partner" },
  { id: "operations", label: "Operasyon" },
] as const;
type Tab = (typeof tabs)[number]["id"];
const modeIcons = {
  pov: Eye,
  cinematic: Clapperboard,
  hybrid: Layers3,
  "interactive-3d": Box,
};

export function ManagementDashboard({
  initialPropertyId,
}: { initialPropertyId?: string | undefined } = {}) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null),
    [workspace, setWorkspace] = useState<WorkspaceView | null>(null),
    [tab, setTab] = useState<Tab>("properties"),
    [selected, setSelected] = useState<{
      property: PropertyView;
      assets: AssetView[];
    } | null>(null);
  const [identity, setIdentity] = useState("demo-admin-a"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState<keyof typeof modeLabels>("pov"),
    [duration, setDuration] = useState(4),
    [aspect, setAspect] = useState("16:9"),
    [quote, setQuote] = useState<{
      simulatedCreditMicroUsd: number;
      disclosure: string;
    } | null>(null),
    [rights, setRights] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsView | null>(null),
    [partner, setPartner] = useState<PartnerView | null>(null),
    [brand, setBrand] = useState<BrandTheme | null>(null),
    [reviewJob, setReviewJob] = useState<JobView | null>(null),
    [clipChecks, setClipChecks] = useState<Record<string, boolean>>({}),
    [viewedClips, setViewedClips] = useState<Record<string, boolean>>({}),
    [preview, setPreview] = useState(""),
    [sourcePreview, setSourcePreview] = useState(""),
    [sourceVideo, setSourceVideo] = useState(false),
    [publication, setPublication] = useState(""),
    [checks, setChecks] = useState({
      rights: false,
      evidence: false,
      continuity: false,
      disclosure: false,
    });
  const urls = useRef<string[]>([]);
  const [publicationId, setPublicationId] = useState("");
  const [organizations, setOrganizations] = useState<
    { id: string; name: string; role: string }[]
  >([]);
  const load = useCallback(async () => {
    const state = await api<Bootstrap>("/bootstrap");
    setBootstrap(state);
    if (state.actor) {
      const data = await api<WorkspaceView>("/workspace");
      setWorkspace(data);
      setBrand(data.brand);
      setOrganizations(await api("/organizations"));
    } else setWorkspace(null);
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active)
        void load().catch((e: unknown) =>
          setError(e instanceof Error ? e.message : "LOAD_FAILED"),
        );
    });
    return () => {
      active = false;
    };
  }, [load]);
  const managementUser = bootstrap?.actor?.userId,
    managementOrg = bootstrap?.actor?.organizationId;
  useEffect(() => {
    if (!managementUser || !initialPropertyId) return;
    let active = true;
    void api<{ property: PropertyView; assets: AssetView[] }>(
      "/properties/" + encodeURIComponent(initialPropertyId),
    )
      .then((d) => {
        if (active) {
          setSelected(d);
          setTab("review");
        }
      })
      .catch(() => {
        if (active) setError("Proje bulunamadı veya erişim yetkiniz yok.");
      });
    return () => {
      active = false;
    };
  }, [managementUser, managementOrg, initialPropertyId]);
  useEffect(
    () => () => urls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  useEffect(() => {
    if (
      !workspace?.jobs.some(
        (j) => j.state === "queued" || j.state === "processing",
      )
    )
      return;
    const timer = setInterval(() => {
      void load().catch(() => setError("İş durumu alınamadı. Yenileyin."));
    }, 2000);
    return () => clearInterval(timer);
  }, [workspace?.jobs, load]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "LOCAL_ACTION_FAILED");
    } finally {
      setBusy(false);
    }
  }
  async function selectProperty(id: string) {
    const detail = await api<{ property: PropertyView; assets: AssetView[] }>(
      "/properties/" + id,
    );
    setSelected(detail);
    setQuote(null);
    setSourcePreview("");
    setReviewJob(null);
    setPreview("");
    setPublication("");
  }
  function objectUrl(blob: Blob) {
    const url = URL.createObjectURL(blob);
    urls.current.push(url);
    return url;
  }
  function generationInput() {
    if (!selected) throw new Error("Önce bir mülk seçin");
    return {
      propertyId: selected.property.id,
      revision: selected.property.revision,
      mode,
      aspectRatio: aspect,
      durationSeconds: duration,
      idempotencyKey: crypto.randomUUID(),
      captions: true,
      localSource: "image-motion",
    };
  }
  async function openJob(job: JobView) {
    setReviewJob(job);
    setClipChecks({});
    setViewedClips({});
    setPreview("");
    setPublication("");
    setChecks({
      rights: false,
      evidence: false,
      continuity: false,
      disclosure: false,
    });
    const grant = await api<{ token: string }>(
      `/jobs/${job.id}/${job.state === "approved" ? "download-grant" : "review-grant"}`,
      {},
    );
    const response = await localRequest(`/jobs/${job.id}/output`, {
      headers: { "x-spaces-grant": grant.token },
    });
    setPreview(objectUrl(await response.blob()));
  }
  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get("title") ?? "");
    await action(async () => {
      const property = await api<PropertyView>("/properties", {
        title,
        syntheticOnly: true,
      });
      await load();
      await selectProperty(property.id);
      setNotice(
        "Mülk ve değiştirilemez ilk revizyon kaydedildi. Ölçü/evidence henüz bilinmiyor.",
      );
    });
  }
  async function loadAnalytics() {
    setAnalytics(
      await api<AnalyticsView>(
        "/analytics" + (selected ? "?propertyId=" + selected.property.id : ""),
      ),
    );
  }
  const canEdit =
      workspace?.actor.role === "admin" || workspace?.actor.role === "editor",
    canReview =
      workspace?.actor.role === "admin" || workspace?.actor.role === "reviewer";
  const style = workspace
    ? ({
        "--spaces-accent": workspace.brand.accent,
        "--spaces-accent-text": workspace.brand.accentText,
      } as CSSProperties)
    : undefined;
  return (
    <div className="spaces-page" style={style}>
      <div className="spaces-eyebrow">
        AI PROPERTY EXPERIENCE PLATFORM / LOCAL LAB
      </div>
      <div className="spaces-title-row">
        <div>
          <h1>{workspace?.brand.displayName ?? "Mekânın bir sonraki hâli."}</h1>
          <p className="spaces-lede">
            Dört üretim biçimi. Kanıta dayalı bir mülk deneyimi.
          </p>
        </div>
        <span className="spaces-orbit" aria-hidden="true">
          ⌑
        </span>
      </div>
      <div className="spaces-safety">
        <ShieldCheck size={19} aria-hidden="true" />
        <p>
          <strong>Sentetik yerel çalışma alanı.</strong> PostgreSQL RLS ve özel
          dosyalar bu makinede çalışır. Gerçek müşteri verisi yüklemeyin. Canlı
          auth, AI, ElevenLabs, ödeme ve bulut bağlı değildir.
        </p>
      </div>
      {error && (
        <p role="alert" className="spaces-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="spaces-notice">
          {notice}
        </p>
      )}
      <section className="spaces-session" aria-label="Yerel sentetik oturum">
        {workspace && (
          <label>
            Organizasyon
            <select
              aria-label="Organizasyon"
              value={workspace.actor.organizationId}
              disabled={busy}
              onChange={(e) => {
                const organizationId = e.target.value;
                void action(async () => {
                  await api("/organizations/switch", { organizationId });
                  setSelected(null);
                  setReviewJob(null);
                  setPreview("");
                  setAnalytics(null);
                  setPartner(null);
                  await load();
                });
              }}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name} / {organization.role}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Test kimliği
          <select
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
          >
            {bootstrap?.identities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={busy || !bootstrap}
          onClick={() =>
            void action(async () => {
              await api("/session", { identityId: identity });
              setSelected(null);
              setReviewJob(null);
              setPreview("");
              setAnalytics(null);
              setPartner(null);
              await load();
              setNotice(
                "Sentetik oturum açıldı. Kimlik seçimi yalnız loopback test içindir; gerçek giriş değildir.",
              );
            })
          }
        >
          {workspace ? "Test kimliğini değiştir" : "Yerel oturumu aç"}
        </button>
        {workspace && (
          <>
            <span className="spaces-muted">
              {workspace.actor.organizationId} / {workspace.actor.role}
            </span>
            <button
              className="subtle"
              onClick={() =>
                void action(async () => {
                  await api("/session", undefined, "DELETE");
                  setSelected(null);
                  await load();
                })
              }
            >
              Çıkış
            </button>
          </>
        )}
      </section>
      {!bootstrap && <p role="status">Özel yerel veritabanı hazırlanıyor…</p>}
      {workspace && (
        <>
          <div className="spaces-metrics">
            <div>
              <span>MÜLKLER</span>
              <strong>
                {workspace.properties.length.toString().padStart(2, "0")}
              </strong>
              <small>Bu organizasyon</small>
            </div>
            <div>
              <span>ÇALIŞMALAR</span>
              <strong>
                {workspace.jobs.length.toString().padStart(2, "0")}
              </strong>
              <small>Kalıcı, sınırlı iş kuyruğu</small>
            </div>
            <div>
              <span>İNCELEME</span>
              <strong>
                {workspace.jobs
                  .filter((j) => j.state === "awaiting-review")
                  .length.toString()
                  .padStart(2, "0")}
              </strong>
              <small>İkinci kimlik onayı gerekir</small>
            </div>
            <div>
              <span>DIŞ HARCAMA</span>
              <strong>$0</strong>
              <small>
                {workspace.accounts[0]
                  ? `${workspace.accounts[0].available.toLocaleString("tr-TR")} sanal µUSD`
                  : "Kredi rolünüzle gizli"}
              </small>
            </div>
          </div>
          <nav className="spaces-tabs" aria-label="Çalışma alanı bölümleri">
            {tabs
              .filter(
                (item) =>
                  item.id === "properties" ||
                  (item.id === "studio" && canEdit) ||
                  (item.id === "review" && canReview) ||
                  (item.id === "analytics" && canEdit) ||
                  (["brand", "partner", "operations"].includes(item.id) &&
                    workspace.actor.role === "admin"),
              )
              .map((item) => (
                <button
                  key={item.id}
                  aria-current={tab === item.id ? "page" : undefined}
                  onClick={() => {
                    setTab(item.id);
                    if (item.id === "analytics") void action(loadAnalytics);
                    if (item.id === "partner")
                      void action(async () =>
                        setPartner(await api<PartnerView>("/partner")),
                      );
                  }}
                >
                  {item.label}
                </button>
              ))}
          </nav>
          {(tab === "properties" || tab === "studio" || tab === "review") && (
            <div className="spaces-two-column">
              <aside className="spaces-panel spaces-property-list">
                <div className="spaces-section-label">
                  PORTFÖY / {workspace.actor.organizationId}
                </div>
                <h2>Bir mekân seçin</h2>
                {workspace.properties.map((property) => (
                  <button
                    className={
                      selected?.property.id === property.id
                        ? "spaces-property active"
                        : "spaces-property"
                    }
                    key={property.id}
                    onClick={() =>
                      void action(() => selectProperty(property.id))
                    }
                  >
                    <span className="property-art" aria-hidden="true">
                      <Box size={36} strokeWidth={0.8} />
                    </span>
                    <span>
                      <strong>{property.title}</strong>
                      <small>Revizyon {property.revision} · sentetik</small>
                    </span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                ))}
                {workspace.properties.length === 0 && (
                  <p className="spaces-muted">Bu organizasyonda mülk yok.</p>
                )}
                {canEdit && (
                  <form
                    onSubmit={(e) => void createProperty(e)}
                    className="spaces-form"
                  >
                    <label>
                      Yeni sentetik mülk adı
                      <input
                        name="title"
                        required
                        maxLength={120}
                        placeholder="Örn. Atrium çalışma evi"
                      />
                    </label>
                    <button disabled={busy}>
                      <Plus size={16} aria-hidden="true" />
                      Mülk oluştur
                    </button>
                  </form>
                )}
              </aside>
              <section className="spaces-panel">
                {!selected ? (
                  <div className="spaces-empty">
                    <Box size={56} strokeWidth={0.7} aria-hidden="true" />
                    <h2>Mekândan deneyime.</h2>
                    <p>
                      Portföyden bir mülk seçin veya yeni bir sentetik kayıt
                      oluşturun.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="spaces-section-label">
                      {selected.property.id} / REV {selected.property.revision}
                    </div>
                    <h2>{selected.property.title}</h2>
                    <p className="spaces-muted">
                      {selected.property.description}
                    </p>
                    {tab === "properties" && (
                      <>
                        <div className="spaces-facts">
                          <span>
                            {selected.property.manifest.rooms.length}{" "}
                            doğrulanmış sentetik oda
                          </span>
                          <span>
                            {
                              selected.assets.filter(
                                (a) => a.status === "clean",
                              ).length
                            }{" "}
                            temiz dosya
                          </span>
                          <span>
                            {selected.property.manifest.measuredBy
                              ? "E2 · ölçülü fixture"
                              : "E0 · geometri bilinmiyor"}
                          </span>
                        </div>
                        <p className="spaces-notice">
                          {selected.property.manifest.unknownRegions.join(
                            " · ",
                          )}
                        </p>
                        <div className="spaces-actions">
                          <button onClick={() => setTab("studio")}>
                            <Sparkles size={16} aria-hidden="true" />
                            Üretime geç
                          </button>
                          {canEdit && (
                            <button
                              className="subtle"
                              onClick={() =>
                                void action(async () => {
                                  const title = window.prompt(
                                    "Yeni sentetik mülk başlığı",
                                    selected.property.title,
                                  );
                                  if (title) {
                                    await api(
                                      `/properties/${selected.property.id}`,
                                      {
                                        expectedRevision:
                                          selected.property.revision,
                                        title,
                                      },
                                      "PATCH",
                                    );
                                    await selectProperty(selected.property.id);
                                    await load();
                                  }
                                })
                              }
                            >
                              Başlığı revize et
                            </button>
                          )}
                          {canEdit && (
                            <button
                              className="subtle"
                              onClick={() =>
                                void action(async () => {
                                  await api(
                                    `/properties/${selected.property.id}`,
                                    {
                                      expectedRevision:
                                        selected.property.revision,
                                      archived: true,
                                    },
                                    "PATCH",
                                  );
                                  setSelected(null);
                                  await load();
                                  setNotice(
                                    "Mülk arşivlendi; geçmiş silinmedi, eski tur erişimi kapandı.",
                                  );
                                })
                              }
                            >
                              Arşivle
                            </button>
                          )}
                        </div>
                        <h3>Kaynak ve hak kontrolü</h3>
                        <ul className="spaces-asset-list">
                          {selected.assets.map((asset) => (
                            <li key={asset.id}>
                              <span>
                                {asset.kind} · {asset.status}
                                <small>
                                  {asset.width ?? "?"} × {asset.height ?? "?"} ·{" "}
                                  {Math.round(asset.bytes / 1024)} KB
                                </small>
                              </span>
                              {asset.status === "clean" && (
                                <button
                                  className="subtle"
                                  onClick={() =>
                                    void action(async () => {
                                      const grant = await api<{
                                        token: string;
                                      }>(`/assets/${asset.id}/grant`, {});
                                      const response = await localRequest(
                                        `/assets/${asset.id}`,
                                        {
                                          headers: {
                                            "x-spaces-grant": grant.token,
                                          },
                                        },
                                      );
                                      setSourceVideo(
                                        asset.mime === "video/mp4",
                                      );
                                      setSourcePreview(
                                        objectUrl(await response.blob()),
                                      );
                                    })
                                  }
                                >
                                  Kaynağı incele
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                        {sourcePreview && (
                          <div className="spaces-source">
                            {sourceVideo ? (
                              <video
                                src={sourcePreview}
                                controls
                                aria-label="Özel kaynak videosu"
                              />
                            ) : (
                              <img
                                src={sourcePreview}
                                alt="Yetkili özel sentetik kaynak görseli"
                              />
                            )}
                          </div>
                        )}
                        {canEdit && (
                          <div className="spaces-form">
                            <label className="spaces-checkbox">
                              <input
                                type="checkbox"
                                checked={rights}
                                onChange={(e) => setRights(e.target.checked)}
                              />
                              Yalnız sentetik / hakları bana ait test görseli;
                              EXIF/GPS silinmesini kabul ediyorum.
                            </label>
                            <label>
                              JPEG / PNG / WebP, en fazla 5 MiB
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                disabled={!rights || busy}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = "";
                                  if (!file) return;
                                  void action(async () => {
                                    const grant = await api<{ token: string }>(
                                      `/properties/${selected.property.id}/upload-grant`,
                                      {},
                                    );
                                    await localRequest(
                                      `/properties/${selected.property.id}/upload`,
                                      {
                                        method: "POST",
                                        body: file,
                                        headers: {
                                          "x-spaces-grant": grant.token,
                                          "x-spaces-rights":
                                            "synthetic-owned-metadata-v1",
                                          "x-asset-kind": "photo",
                                        },
                                      },
                                    );
                                    await selectProperty(selected.property.id);
                                    setNotice(
                                      "Dosya karantinadan decode/hash/metadata kontrolüyle geçti; özel alana kaydedildi.",
                                    );
                                  });
                                }}
                              />
                            </label>
                            {selected.property.manifest.rooms.length === 0 && (
                              <button
                                className="subtle"
                                onClick={() =>
                                  void action(async () => {
                                    await api(
                                      `/properties/${selected.property.id}/fixture`,
                                      {},
                                    );
                                    await selectProperty(selected.property.id);
                                    setNotice(
                                      "Sabit sentetik ölçülü plan ve görsel oluşturuldu; bu gerçek mülk ölçümü değildir.",
                                    );
                                  })
                                }
                              >
                                Ölçülü sentetik fixture ekle
                              </button>
                            )}
                          </div>
                        )}
                        {selected.property.manifest.rooms.length > 0 && (
                          <>
                            <h3>Ölçülü planın gezilebilir önizlemesi</h3>
                            <Viewer scene={selected.property.manifest} />
                          </>
                        )}
                      </>
                    )}
                    {tab === "studio" && (
                      <>
                        <p>
                          Gerçek yerel dosya üretimi. Video modları kaynak
                          görsel pan/zoom/kesme demosudur; AI kamera yürüyüşü
                          değildir. 3D, E2 sentetik ölçülerden Blender mesh
                          üretir.
                        </p>
                        <div className="spaces-mode-grid">
                          {(
                            Object.keys(
                              modeLabels,
                            ) as (keyof typeof modeLabels)[]
                          ).map((key) => {
                            const Icon = modeIcons[key];
                            return (
                              <button
                                key={key}
                                className={mode === key ? "active" : ""}
                                aria-pressed={mode === key}
                                onClick={() => {
                                  setMode(key);
                                  setQuote(null);
                                }}
                              >
                                <Icon
                                  size={25}
                                  strokeWidth={1.2}
                                  aria-hidden="true"
                                />
                                <strong>{modeLabels[key]}</strong>
                                <small>
                                  {key === "interactive-3d"
                                    ? "GLB + bağımsız gezinme"
                                    : "Gerçek MP4 · yerel hareket"}
                                </small>
                              </button>
                            );
                          })}
                        </div>
                        <div className="spaces-form-row">
                          <label>
                            Süre
                            <select
                              value={duration}
                              onChange={(e) =>
                                setDuration(Number(e.target.value))
                              }
                              disabled={mode === "interactive-3d"}
                            >
                              {[4, 8, 16].map((n) => (
                                <option key={n} value={n}>
                                  {n} saniye
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Oran
                            <select
                              value={aspect}
                              onChange={(e) => setAspect(e.target.value)}
                              disabled={mode === "interactive-3d"}
                            >
                              <option>16:9</option>
                              <option>9:16</option>
                            </select>
                          </label>
                        </div>
                        <p className="spaces-muted">
                          Tahmini süre: ölçülene kadar UNKNOWN. Dış maliyet: 0
                          USD. Yerel CPU işlemi; sanal kredi ticari fiyat
                          değildir.
                        </p>
                        <div className="spaces-actions">
                          <button
                            disabled={busy || !canEdit}
                            onClick={() =>
                              void action(async () =>
                                setQuote(
                                  await api("/quote", generationInput()),
                                ),
                              )
                            }
                          >
                            Teklifi göster
                          </button>
                          {quote && (
                            <button
                              disabled={busy || !canEdit}
                              onClick={() =>
                                void action(async () => {
                                  const job = await api<JobView>(
                                    "/jobs",
                                    generationInput(),
                                  );
                                  await load();
                                  setNotice(
                                    `İş kaydedildi: ${job.id}. Tamamlanınca bağımsız incelemeciye geçin.`,
                                  );
                                  setTab("review");
                                })
                              }
                            >
                              Sınırlı işi başlat
                            </button>
                          )}
                        </div>
                        {quote && (
                          <p className="spaces-notice">
                            {quote.simulatedCreditMicroUsd} sanal µUSD rezerve
                            edilir. {quote.disclosure}
                          </p>
                        )}
                      </>
                    )}
                    {tab === "review" && (
                      <>
                        <p>
                          Önce kaynak/çıktı, hak, süreklilik ve açıklamayı
                          kontrol edin. İşi başlatan kimlik kendi çıktısını
                          onaylayamaz.
                        </p>
                        <div className="spaces-job-list">
                          {workspace.jobs
                            .filter(
                              (j) => j.property_id === selected.property.id,
                            )
                            .map((job) => (
                              <div className="spaces-job" key={job.id}>
                                <div>
                                  <strong>
                                    {
                                      modeLabels[
                                        job.command
                                          .mode as keyof typeof modeLabels
                                      ]
                                    }{" "}
                                    · {stateLabels[job.state]}
                                  </strong>
                                  <small>
                                    {job.id.slice(0, 8)} · rev {job.revision} ·
                                    deneme {job.attempt}
                                    {job.error_code
                                      ? ` · ${job.error_code}`
                                      : ""}
                                  </small>
                                </div>
                                <div className="spaces-actions">
                                  {(job.state === "approved" ||
                                    (job.state === "awaiting-review" &&
                                      canReview)) && (
                                    <button
                                      className="subtle"
                                      onClick={() =>
                                        void action(() => openJob(job))
                                      }
                                    >
                                      İncele
                                    </button>
                                  )}
                                  {canEdit &&
                                    ["queued", "processing"].includes(
                                      job.state,
                                    ) && (
                                      <button
                                        className="subtle"
                                        onClick={() =>
                                          void action(async () => {
                                            await api(
                                              `/jobs/${job.id}/cancel`,
                                              {},
                                            );
                                            await load();
                                          })
                                        }
                                      >
                                        İptal et
                                      </button>
                                    )}
                                </div>
                              </div>
                            ))}
                        </div>
                        {reviewJob?.output && (
                          <div className="spaces-review">
                            <h3>Çıktı kanıtı</h3>
                            <p className="spaces-notice">
                              {reviewJob.output.qa.disclosure}
                            </p>
                            <p>
                              {reviewJob.output.codec ?? "GLB 2.0"} ·{" "}
                              {reviewJob.output.durationSeconds ??
                                "Süre uygulanmaz"}{" "}
                              {reviewJob.output.durationSeconds ? "s" : ""} ·{" "}
                              {Math.round(reviewJob.output.bytes / 1024)} KB ·{" "}
                              {reviewJob.output.wallTimeMs} ms yerel işlem
                            </p>
                            {preview &&
                              (reviewJob.output.extension === "mp4" ? (
                                <video
                                  src={preview}
                                  controls
                                  preload="metadata"
                                  aria-label={
                                    reviewJob.execution_kind === "fal-v01"
                                      ? "V01 özel sağlayıcı video adayı"
                                      : "Gerçek yerel video çıktısı"
                                  }
                                />
                              ) : (
                                <Viewer
                                  scene={selected.property.manifest}
                                  modelUrl={preview}
                                />
                              ))}
                            <div className="spaces-actions">
                              {selected.assets
                                .filter((a) => a.status === "clean")
                                .map((asset) => (
                                  <button
                                    className="subtle"
                                    key={asset.id}
                                    onClick={() =>
                                      void action(async () => {
                                        const grant = await api<{
                                          token: string;
                                        }>(`/assets/${asset.id}/grant`, {});
                                        setSourceVideo(
                                          asset.mime === "video/mp4",
                                        );
                                        setSourcePreview(
                                          objectUrl(
                                            await (
                                              await localRequest(
                                                `/assets/${asset.id}`,
                                                {
                                                  headers: {
                                                    "x-spaces-grant":
                                                      grant.token,
                                                  },
                                                },
                                              )
                                            ).blob(),
                                          ),
                                        );
                                      })
                                    }
                                  >
                                    Kaynak: {asset.kind}
                                  </button>
                                ))}
                            </div>
                            {sourcePreview && (
                              <div className="spaces-source">
                                {sourceVideo ? (
                                  <video
                                    src={sourcePreview}
                                    controls
                                    aria-label="İnceleme kaynak videosu"
                                  />
                                ) : (
                                  <img
                                    src={sourcePreview}
                                    alt="İnceleme için sentetik kaynak; çıktı ile karşılaştırın"
                                  />
                                )}
                              </div>
                            )}
                            {reviewJob.state === "awaiting-review" &&
                              canReview && (
                                <>
                                  {reviewJob.output.photoComposition && (
                                    <fieldset aria-label="Sahne incelemeleri">
                                      <legend>
                                        Her sahneyi kaynağıyla karşılaştır
                                      </legend>
                                      <p>
                                        Yerel kaynak-görsel klipleri. Sağlayıcı
                                        modeli yalnız planlanmıştır; AI üretimi
                                        yapılmadı.
                                      </p>
                                      {reviewJob.output.photoComposition.clips.map(
                                        (clip) => (
                                          <div
                                            key={clip.artifactId}
                                            className="spaces-actions"
                                          >
                                            <button
                                              className="subtle"
                                              disabled={busy}
                                              onClick={() =>
                                                void action(async () => {
                                                  const grant = await api<{
                                                    token: string;
                                                  }>(
                                                    `/jobs/${reviewJob.id}/review-grant`,
                                                    {},
                                                  );
                                                  const result =
                                                    await localRequest(
                                                      `/jobs/${reviewJob.id}/clips/${clip.order}`,
                                                      {
                                                        headers: {
                                                          "x-spaces-grant":
                                                            grant.token,
                                                        },
                                                      },
                                                    );
                                                  const sourceGrant =
                                                    await api<{
                                                      token: string;
                                                    }>(
                                                      `/assets/${clip.sourceAssetId}/grant`,
                                                      {},
                                                    );
                                                  const source =
                                                    await localRequest(
                                                      `/assets/${clip.sourceAssetId}`,
                                                      {
                                                        headers: {
                                                          "x-spaces-grant":
                                                            sourceGrant.token,
                                                        },
                                                      },
                                                    );
                                                  setPreview(
                                                    objectUrl(
                                                      await result.blob(),
                                                    ),
                                                  );
                                                  setSourcePreview(
                                                    objectUrl(
                                                      await source.blob(),
                                                    ),
                                                  );
                                                  setSourceVideo(false);
                                                  setViewedClips((v) => ({
                                                    ...v,
                                                    [clip.artifactId]: true,
                                                  }));
                                                })
                                              }
                                            >
                                              Sahne {clip.order + 1} ve
                                              kaynağını aç
                                            </button>
                                            <label className="spaces-checkbox">
                                              <input
                                                type="checkbox"
                                                disabled={
                                                  !viewedClips[
                                                    clip.artifactId
                                                  ] || busy
                                                }
                                                checked={
                                                  !!clipChecks[clip.artifactId]
                                                }
                                                onChange={(e) =>
                                                  setClipChecks((v) => ({
                                                    ...v,
                                                    [clip.artifactId]:
                                                      e.target.checked,
                                                  }))
                                                }
                                              />
                                              Sahne {clip.order + 1} kaynağıyla
                                              tutarlı
                                            </label>
                                          </div>
                                        ),
                                      )}
                                    </fieldset>
                                  )}
                                  <fieldset>
                                    <legend>İnsan kalite kontrolü</legend>
                                    {(
                                      Object.keys(
                                        checks,
                                      ) as (keyof typeof checks)[]
                                    ).map((key) => (
                                      <label
                                        className="spaces-checkbox"
                                        key={key}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checks[key]}
                                          onChange={(e) =>
                                            setChecks((old) => ({
                                              ...old,
                                              [key]: e.target.checked,
                                            }))
                                          }
                                        />
                                        {
                                          {
                                            rights: "Hak ve sentetik kaynak",
                                            evidence:
                                              "Mimari kanıt / bilinmeyen alanlar",
                                            continuity:
                                              "Süreklilik / dosya bütünlüğü",
                                            disclosure:
                                              "Demo ve sınırlamalar açık",
                                          }[key]
                                        }
                                      </label>
                                    ))}
                                  </fieldset>
                                  <div className="spaces-actions">
                                    {(
                                      [
                                        "approved",
                                        "rejected",
                                        "retake",
                                      ] as const
                                    ).map((decision) => (
                                      <button
                                        key={decision}
                                        disabled={
                                          busy ||
                                          (decision === "approved" &&
                                            (!Object.values(checks).every(
                                              Boolean,
                                            ) ||
                                              !!reviewJob.output?.photoComposition?.clips.some(
                                                (c) =>
                                                  !clipChecks[c.artifactId],
                                              )))
                                        }
                                        onClick={() =>
                                          void action(async () => {
                                            await api(
                                              `/jobs/${reviewJob.id}/review`,
                                              {
                                                decision,
                                                ...checks,
                                                ...(reviewJob.execution_kind ===
                                                "fal-v01"
                                                  ? {
                                                      outputSha256:
                                                        reviewJob.output
                                                          ?.sha256,
                                                    }
                                                  : {}),
                                                ...(reviewJob.output
                                                  ?.photoComposition
                                                  ? {
                                                      clipApprovals:
                                                        reviewJob.output.photoComposition.clips
                                                          .filter(
                                                            (c) =>
                                                              clipChecks[
                                                                c.artifactId
                                                              ],
                                                          )
                                                          .map((c) => ({
                                                            artifactId:
                                                              c.artifactId,
                                                            sha256: c.sha256,
                                                            sourceSha256:
                                                              c.sourceSha256,
                                                            decision:
                                                              "approved",
                                                          })),
                                                    }
                                                  : {}),
                                              },
                                            );
                                            await load();
                                            setReviewJob(null);
                                            setPreview("");
                                            setNotice(
                                              "Değiştirilemez inceleme kararı kaydedildi.",
                                            );
                                          })
                                        }
                                      >
                                        {
                                          {
                                            approved: "Bağımsız onay",
                                            rejected: "Reddet",
                                            retake: "Yeniden çekim iste",
                                          }[decision]
                                        }
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            {reviewJob.state === "approved" && (
                              <div className="spaces-actions">
                                <button
                                  onClick={() => {
                                    void action(async () => {
                                      const grant = await api<{
                                        token: string;
                                      }>(
                                        `/jobs/${reviewJob.id}/download-grant`,
                                        {},
                                      );
                                      saveBlob(
                                        await (
                                          await localRequest(
                                            `/jobs/${reviewJob.id}/output`,
                                            {
                                              headers: {
                                                "x-spaces-grant": grant.token,
                                              },
                                            },
                                          )
                                        ).blob(),
                                        `spaces-${reviewJob.id}.${reviewJob.output!.extension}`,
                                      );
                                    });
                                  }}
                                >
                                  Onaylı dosyayı indir
                                </button>
                                {canEdit && (
                                  <button
                                    onClick={() =>
                                      void action(async () => {
                                        const pub = await api<{
                                          token: string;
                                          id: string;
                                        }>(`/jobs/${reviewJob.id}/publish`, {});
                                        setPublication("/tour/" + pub.token);
                                        setPublicationId(pub.id);
                                      })
                                    }
                                  >
                                    1 saatlik yerel tur bağlantısı
                                  </button>
                                )}
                              </div>
                            )}
                            {publication && (
                              <p className="spaces-notice">
                                <Link href={publication}>
                                  İzinli yerel turu aç{" "}
                                  <ArrowUpRight size={14} aria-hidden="true" />
                                </Link>{" "}
                                · İnternette yayınlanmadı.
                                <button
                                  className="subtle"
                                  onClick={() =>
                                    void action(async () => {
                                      await api(
                                        `/publications/${publicationId}/revoke`,
                                        {},
                                      );
                                      setPublication("");
                                      setPublicationId("");
                                      setNotice(
                                        "Yerel yayın iptal edildi. Yeni erişim reddedilir; önceden indirilen dosya geri alınamaz.",
                                      );
                                    })
                                  }
                                >
                                  Bağlantıyı iptal et
                                </button>
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
          {tab === "analytics" && (
            <section className="spaces-panel">
              <div className="spaces-section-label">
                CONSENT-AWARE ANALYTICS / UTC
              </div>
              <h2>İlgiden doğrulanmış talebe.</h2>
              <div className="spaces-actions">
                <button onClick={() => void action(loadAnalytics)}>
                  Son 7 günü yenile
                </button>
                <button
                  className="subtle"
                  onClick={() =>
                    void action(async () =>
                      saveBlob(
                        await (
                          await localRequest(
                            "/analytics/export" +
                              (selected
                                ? "?propertyId=" + selected.property.id
                                : ""),
                          )
                        ).blob(),
                        "spaces-aggregate.csv",
                      ),
                    )
                  }
                >
                  Aggregate CSV indir
                </button>
              </div>
              <p className="spaces-muted">
                Kapsam: {selected?.property.title ?? "Bu organizasyon"}. Ham
                ses/transcript, göz takibi, GPS veya fingerprint yok.
              </p>
              {analytics && (
                <>
                  <div className="spaces-metrics">
                    <div>
                      <span>ONAYLI OTURUMLAR</span>
                      <strong>{analytics.consentedSessions}</strong>
                      <small>Tekil kişi sayısı: {analytics.uniquePeople}</small>
                    </div>
                    <div>
                      <span>OLAYLAR</span>
                      <strong>{analytics.totalEvents}</strong>
                      <small>Dedup + zaman penceresi</small>
                    </div>
                    <div>
                      <span>REHBER</span>
                      <strong>
                        {analytics.voiceStarts} / {analytics.voiceEnds}
                      </strong>
                      <small>Başlangıç / bitiş</small>
                    </div>
                    <div>
                      <span>DOĞRULANMIŞ GÖSTERİM</span>
                      <strong>
                        {analytics.conversionRate === null
                          ? "—"
                          : `${Math.round(analytics.conversionRate * 100)}%`}
                      </strong>
                      <small>Simülasyon; gerçek satış değil</small>
                    </div>
                  </div>
                  {analytics.lowSample && (
                    <p className="spaces-notice">
                      Düşük örneklem. Bu sayılar satış artışı veya nedensellik
                      kanıtı değildir.
                    </p>
                  )}
                  <figure className="spaces-funnel">
                    <figcaption>
                      Oturum temelli huni · UTC · sentetik yerel veri
                    </figcaption>
                    {analytics.steps.map((step) => (
                      <div key={step.key}>
                        <span>{step.label}</span>
                        <div className="spaces-bar-track">
                          <span
                            style={{
                              width: `${analytics.consentedSessions ? Math.min(100, (step.count / analytics.consentedSessions) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <strong>{step.count}</strong>
                      </div>
                    ))}
                  </figure>
                  <h3>Oda etkileşimi</h3>
                  {Object.entries(analytics.dwellSeconds).length ? (
                    <ul>
                      {Object.entries(analytics.dwellSeconds).map(
                        ([id, seconds]) => (
                          <li key={id}>
                            {id}: {Math.round(seconds)} s · sanal oda
                            etkileşimi, fiziksel göz takibi değil
                          </li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p className="spaces-muted">
                      Henüz onaylı oda geçiş verisi yok.
                    </p>
                  )}
                  <p>{analytics.attribution}</p>
                </>
              )}
            </section>
          )}
          {tab === "brand" && brand && (
            <section className="spaces-panel">
              <div className="spaces-section-label">
                WHITE LABEL / PRESENTATION ONLY
              </div>
              <h2>Markanızın sesi, kendi sınırları.</h2>
              <p>
                Marka ayarı yetki vermez. Custom domain yalnız .localhost
                fixture; DNS veya canlı bağlantı kurulmaz.
              </p>
              <form
                className="spaces-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    await api("/brands", {
                      displayName: brand.displayName,
                      accent: brand.accent,
                      language: brand.language,
                      logoAssetId: brand.logoAssetId,
                      domain: brand.domain,
                      voiceName: brand.voiceName,
                    });
                    await load();
                    setNotice(
                      "Organizasyon markası kaydedildi; diğer tenant değişmedi.",
                    );
                  });
                }}
              >
                <label>
                  Görünen marka
                  <input
                    value={brand.displayName}
                    maxLength={120}
                    onChange={(e) =>
                      setBrand({ ...brand, displayName: e.target.value })
                    }
                  />
                </label>
                <div className="spaces-form-row">
                  <label>
                    Vurgu rengi
                    <input
                      type="color"
                      value={brand.accent}
                      onChange={(e) =>
                        setBrand({ ...brand, accent: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Dil
                    <select
                      value={brand.language}
                      onChange={(e) =>
                        setBrand({
                          ...brand,
                          language: e.target.value as "tr" | "en",
                        })
                      }
                    >
                      <option value="tr">Türkçe</option>
                      <option value="en">
                        English (rehber metinleri kısmen TR)
                      </option>
                    </select>
                  </label>
                </div>
                <label>
                  Rehber kimliği
                  <input
                    value={brand.voiceName}
                    maxLength={120}
                    onChange={(e) =>
                      setBrand({ ...brand, voiceName: e.target.value })
                    }
                  />
                </label>
                <label>
                  Yerel alan adı
                  <input
                    value={brand.domain ?? ""}
                    placeholder="marka.localhost"
                    onChange={(e) =>
                      setBrand({ ...brand, domain: e.target.value || null })
                    }
                  />
                </label>
                <button disabled={busy || workspace.actor.role !== "admin"}>
                  Markayı kaydet
                </button>
              </form>
            </section>
          )}
          {tab === "partner" && (
            <section className="spaces-panel">
              <div className="spaces-section-label">
                RESELLER WORKSPACE / ASSIGNED CHILDREN
              </div>
              <h2>Kanal ortaklığı, açık veri sınırları.</h2>
              {workspace.actor.organizationId.startsWith("agency-") && (
                <form
                  className="spaces-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    void action(async () => {
                      const result = await api<{ childOrganizationId: string }>(
                        "/partner/children",
                        {
                          displayName: String(form.get("childName")),
                          ownerSyntheticUserId: "demo-admin-a",
                          syntheticOnly: true,
                        },
                      );
                      setNotice(
                        `Yerel child workspace oluşturuldu: ${result.childOrganizationId}. Parent ham erişimi yok; aggregate için child owner izni bekleniyor.`,
                      );
                      setPartner(await api("/partner"));
                    });
                  }}
                >
                  <label>
                    Yeni sentetik child workspace adı
                    <input name="childName" required maxLength={120} />
                  </label>
                  <button disabled={busy}>
                    Yerel child oluştur · harici kaynak yok
                  </button>
                </form>
              )}
              <p>
                Partner A/B fixture için North/South test kimliğine geçin.
                Atama, ham medya veya müşteri kaydı erişimi sağlamaz.
              </p>
              {partner?.assignedChildren.map((child) => (
                <div className="spaces-job" key={child.childOrganizationId}>
                  <div>
                    <strong>{child.childOrganizationId}</strong>
                    <small>
                      {child.properties} mülk · {child.jobs} iş ·{" "}
                      {child.engagementEvents ?? "Örneklem nedeniyle gizli"}{" "}
                      olay
                    </small>
                  </div>
                  <span className="spaces-pill">HAM VERİ YOK</span>
                </div>
              ))}
              {partner?.assignedChildren.length === 0 && (
                <p>Bu organizasyona atanmış child workspace yok.</p>
              )}
              <p className="spaces-muted">
                Komisyon: NOT_CONTRACTED. Canlı fatura/ödeme veya domain
                aktivasyonu yok.
              </p>
            </section>
          )}
          {tab === "operations" && (
            <section className="spaces-panel">
              <div className="spaces-section-label">
                OPERATIONS / ZERO EXTERNAL SPEND
              </div>
              <h2>Sınırları görünür bir sistem.</h2>
              <form
                className="spaces-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = String(
                    new FormData(e.currentTarget).get("organizationName"),
                  );
                  void action(async () => {
                    const organization = await api<{ id: string }>(
                      "/organizations",
                      { name },
                    );
                    await api("/organizations/switch", {
                      organizationId: organization.id,
                    });
                    setSelected(null);
                    setReviewJob(null);
                    await load();
                    setNotice(
                      "Yeni sentetik organizasyon oluşturuldu; gerçek hesap/servis kurulmadı.",
                    );
                  });
                }}
              >
                <label>
                  Yeni yerel organizasyon adı
                  <input name="organizationName" required maxLength={100} />
                </label>
                <button disabled={busy}>Organizasyon oluştur</button>
              </form>
              {workspace.actor.role === "admin" && (
                <form
                  className="spaces-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void action(async () => {
                      const invitation = await api<{ id: string }>(
                        "/invitations",
                        {
                          userId: String(data.get("inviteUser")),
                          role: String(data.get("inviteRole")),
                        },
                      );
                      setNotice(
                        `Yerel davet: ${invitation.id}. Yalnız seçilen sentetik kullanıcı kabul edebilir; e-posta gönderilmedi.`,
                      );
                    });
                  }}
                >
                  <div className="spaces-form-row">
                    <label>
                      Sentetik davetli
                      <select name="inviteUser">
                        {bootstrap?.identities.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Davet rolü
                      <select name="inviteRole">
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="reviewer">Reviewer</option>
                      </select>
                    </label>
                  </div>
                  <button disabled={busy}>Yerel davet oluştur</button>
                </form>
              )}
              <ul className="spaces-operating-list">
                <li>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  Yerel PostgreSQL · RLS · tenant composite FK
                </li>
                <li>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  Özel nesneler · kısa ömürlü scoped HMAC grant
                </li>
                <li>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  FFmpeg / Blender · iki denemeyle sınırlı iş / fencing
                </li>
                <li>
                  <ShieldCheck size={18} aria-hidden="true" />
                  Canlı Supabase / video AI / ElevenLabs / ödeme kapalı
                </li>
              </ul>
              {workspace.actor.role === "admin" && <ProviderReadinessPanel />}
              {workspace.actor.role === "admin" && <AdminServiceResearch />}
              <p>
                Plan, oran ve sanal kredi gerçek ticari teklif değildir.
                Sonuçlar insan incelemesi olmadan yayımlanamaz. Tur linkleri
                yerel makinede, süreli ve revizyon bağlıdır.
              </p>
              <div className="spaces-actions">
                <button
                  className="subtle"
                  disabled={workspace.actor.role !== "admin"}
                  onClick={() =>
                    void action(async () => {
                      const result = await api<{ deleted: number }>(
                        "/retention/sweep",
                        {},
                      );
                      setNotice(
                        `${result.deleted} süresi dolmuş kayıt silindi.`,
                      );
                    })
                  }
                >
                  Tenant retention temizliği
                </button>
                <button className="subtle" onClick={() => void action(load)}>
                  Durumu yenile
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export { CreationStudio as PlatformDashboard } from "./creation-studio";
