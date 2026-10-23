"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  Check,
  Plus,
  X,
  MoveUp,
  MoveDown,
  Play,
  Download,
  Settings2,
  Box,
  ShieldCheck,
  LoaderCircle,
  FolderOpen,
} from "lucide-react";
import type {
  AssetView,
  Bootstrap,
  JobView,
  PropertyView,
  WorkspaceView,
} from "@/contracts/platform-ui";
import {
  EXPORT_PRESETS,
  TEMPLATE_LABELS,
  VIDEO_STYLES,
  UploadSelection,
} from "@/domain/media-intake";
import {
  DISCLOSURE,
  RIGHTS,
  STUDIO_TR,
  friendlyMediaError as friendly,
} from "./studio-copy";
import { api, localRequest, saveBlob } from "./client";

type Draft = { property: PropertyView; assets: AssetView[] };
type Pending = {
  key: string;
  file: File;
  url: string;
  state: "ready" | "uploading" | "error";
  error?: string | undefined;
  replaceId?: string | undefined;
};
type Mode = "pov" | "cinematic" | "hybrid" | "interactive-3d";
function MediaThumbnail({
  url,
  video,
  label,
}: {
  url: string | undefined;
  video: boolean;
  label: string;
}) {
  if (!url)
    return (
      <span className="ux-thumb-empty">
        <Play aria-hidden="true" />
      </span>
    );
  return video ? (
    <video src={url} muted preload="metadata" aria-label={label} />
  ) : (
    <img src={url} alt={label} />
  );
}

export function CreationStudio() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null),
    [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [view, setView] = useState<"create" | "projects" | "shares">("create"),
    [step, setStep] = useState(1),
    [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState<Pending[]>([]),
    [thumbs, setThumbs] = useState<Record<string, string>>({}),
    [rights, setRights] = useState(false);
  const [mode, setMode] = useState<Mode>("cinematic"),
    [template, setTemplate] = useState<keyof typeof TEMPLATE_LABELS>("modern"),
    [preset, setPreset] = useState<keyof typeof EXPORT_PRESETS>("reels"),
    [duration, setDuration] = useState(8),
    [captions, setCaptions] = useState(true),
    [branding, setBranding] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [job, setJob] = useState<JobView | null>(null),
    [preview, setPreview] = useState(""),
    [share, setShare] = useState("");
  const replaceTarget = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    editor = useRef<HTMLDialogElement>(null),
    section = useRef<HTMLElement>(null),
    controller = useRef<AbortController | null>(null),
    urls = useRef(new Set<string>()),
    restored = useRef(""),
    submission = useRef<{ fingerprint: string; key: string } | null>(null),
    titleInput = useRef<HTMLInputElement>(null);
  const objectUrl = useCallback((blob: Blob) => {
    const u = URL.createObjectURL(blob);
    urls.current.add(u);
    return u;
  }, []);
  const refresh = useCallback(async () => {
    const b = await api<Bootstrap>("/bootstrap");
    setBootstrap(b);
    if (b.actor) {
      const w = await api<WorkspaceView>("/workspace");
      setWorkspace(w);
      return w;
    }
    setWorkspace(null);
    return null;
  }, []);
  const openProject = useCallback(async (id: string, w?: WorkspaceView) => {
    const d = await api<Draft>(`/properties/${id}`);
    setDraft(d);
    setPending([]);
    setThumbs({});
    setError("");
    setPreview("");
    setShare("");
    setView("create");
    setRights(false);
    const jobs = (w?.jobs ?? []).filter(
      (j) => j.property_id === id && j.revision === d.property.revision,
    );
    setJob(jobs[0] ?? null);
    if (jobs[0]) {
      const c = jobs[0].command;
      setMode(c.mode as Mode);
      setDuration(c.durationSeconds);
      setPreset(c.aspectRatio === "16:9" ? "youtube" : "reels");
    }
    setStep(jobs.length ? 3 : 1);
  }, []);
  useEffect(() => {
    let active = true;
    const ownedUrls = urls.current;
    void refresh()
      .then((w) => {
        if (!active || !w) return;
        const key = `spaces-v3:${w.actor.userId}:${w.actor.organizationId}`;
        const id = localStorage.getItem(key);
        if (id && restored.current !== key) {
          restored.current = key;
          void openProject(id, w).catch(() => localStorage.removeItem(key));
        }
      })
      .catch(() => {
        if (active)
          setError("Stüdyo açılamadı. Sayfayı yenileyip tekrar dene.");
      });
    return () => {
      active = false;
      controller.current?.abort();
      for (const u of ownedUrls) URL.revokeObjectURL(u);
    };
  }, [refresh, openProject]);
  useEffect(() => {
    if (draft && workspace)
      localStorage.setItem(
        `spaces-v3:${workspace.actor.userId}:${workspace.actor.organizationId}`,
        draft.property.id,
      );
  }, [draft, workspace]);
  useEffect(() => {
    let active = true;
    const allocated: string[] = [];
    const ownedUrls = urls.current;
    void Promise.all(
      (draft?.assets ?? []).map(async (asset) => {
        const g = await api<{ token: string }>(`/assets/${asset.id}/grant`, {});
        const r = await localRequest(`/assets/${asset.id}`, {
          headers: { "x-spaces-grant": g.token },
        });
        const blob = await r.blob();
        if (!active) return null;
        const u = objectUrl(blob);
        allocated.push(u);
        return [asset.id, u] as const;
      }),
    )
      .then((entries) => {
        if (active)
          setThumbs(Object.fromEntries(entries.filter((e) => e !== null)));
      })
      .catch(() => {});
    return () => {
      active = false;
      for (const u of allocated) {
        URL.revokeObjectURL(u);
        ownedUrls.delete(u);
      }
    };
  }, [draft, objectUrl]);
  const jobId = job?.id,
    jobState = job?.state;
  useEffect(() => {
    if (
      !jobId ||
      !jobState ||
      !["queued", "processing", "awaiting-review"].includes(jobState)
    )
      return;
    let active = true;
    const timer = setInterval(() => {
      void api<JobView>(`/jobs/${jobId}`)
        .then((j) => {
          if (active) setJob(j);
        })
        .catch(() => {
          if (active)
            setError(
              "Durum alınamadı. Projen kaydedildi; bağlantını kontrol et.",
            );
        });
    }, 1800);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [jobId, jobState]);
  useEffect(() => {
    if (
      !jobId ||
      !jobState ||
      !["awaiting-review", "approved"].includes(jobState)
    )
      return;
    let active = true;
    void api<{ token: string }>(
      `/jobs/${jobId}/${jobState === "approved" ? "download-grant" : "preview-grant"}`,
      {},
    )
      .then((g) =>
        localRequest(`/jobs/${jobId}/output`, {
          headers: { "x-spaces-grant": g.token },
        }),
      )
      .then((r) => r.blob())
      .then((b) => {
        if (active) setPreview(objectUrl(b));
      })
      .catch(() => {
        if (active)
          setError("Önizleme açılamadı. Projelerim’den yeniden açabilirsin.");
      });
    return () => {
      active = false;
    };
  }, [jobId, jobState, objectUrl]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };
  async function ensureDraft() {
    if (draft) return draft;
    let w = workspace;
    if (!bootstrap) throw new Error("LOADING");
    if (!bootstrap.actor) {
      await api("/session", { identityId: "demo-admin-a" });
      w = await refresh();
    }
    if (!w || !["admin", "editor"].includes(w.actor.role))
      throw new Error("ROLE_DENIED");
    const p = await api<PropertyView>("/properties", {
      title: titleInput.current?.value.trim() || "Yeni mülk projem",
      syntheticOnly: true,
    });
    const d = await api<Draft>(`/properties/${p.id}`);
    setDraft(d);
    return d;
  }
  function selectFiles(files: File[]) {
    setError("");
    setNotice("");
    const target = replaceTarget.current;
    replaceTarget.current = null;
    if (target) files = files.slice(0, 1);
    const list: Pending[] = [];
    for (const file of files) {
      const checked = UploadSelection.safeParse({
        filename: file.name,
        mime: file.type,
        byteLength: file.size,
        revision: 1,
      });
      if (!checked.success) {
        setError(
          "JPEG, PNG veya WebP fotoğraf (5 MB) ya da MP4 video (20 MB) seç. MOV/WebM desteklenmiyor; dosya adında klasör işareti olmasın.",
        );
        continue;
      }
      list.push({
        key: crypto.randomUUID(),
        file,
        url: objectUrl(file),
        state: "ready",
        replaceId: target ?? undefined,
      });
    }
    setPending((v) =>
      [...v, ...list].slice(0, target ? 1 : 12 - (draft?.assets.length ?? 0)),
    );
    setStep(1);
    setView("create");
    requestAnimationFrame(() => {
      section.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      section.current?.focus({ preventScroll: true });
    });
  }
  async function uploadAll() {
    if (!rights) return;
    await run(async () => {
      const d = await ensureDraft();
      const ctl = new AbortController();
      controller.current = ctl;
      for (const item of pending) {
        if (ctl.signal.aborted) break;
        setPending((v) =>
          v.map((p) =>
            p.key === item.key
              ? { ...p, state: "uploading", error: undefined }
              : p,
          ),
        );
        try {
          const latest = await api<Draft>(`/properties/${d.property.id}`);
          const g = await api<{ token: string }>(
            `/properties/${d.property.id}/media-grant`,
            {
              filename: item.file.name,
              mime: item.file.type,
              byteLength: item.file.size,
              revision: latest.property.revision,
              ...(item.replaceId ? { replaceAssetId: item.replaceId } : {}),
            },
          );
          await localRequest(`/properties/${d.property.id}/media-upload`, {
            method: "POST",
            body: item.file,
            signal: ctl.signal,
            headers: {
              "Content-Type": item.file.type,
              "x-spaces-grant": g.token,
              "x-spaces-rights": "synthetic-owned-metadata-v1",
            },
          });
          setPending((v) => v.filter((p) => p.key !== item.key));
        } catch (e) {
          setPending((v) =>
            v.map((p) =>
              p.key === item.key
                ? {
                    ...p,
                    state: "error",
                    error: ctl.signal.aborted
                      ? "Yükleme durduruldu. Tekrar deneyebilirsin."
                      : friendly(e),
                  }
                : p,
            ),
          );
          if (ctl.signal.aborted) break;
        } finally {
          setDraft(await api<Draft>(`/properties/${d.property.id}`));
        }
      }
      controller.current = null;
      await refresh();
    });
  }
  async function changeMedia(ids: string[]) {
    if (!draft) return;
    await run(async () => {
      await api(
        `/properties/${draft.property.id}/media`,
        { revision: draft.property.revision, assetIds: ids },
        "PATCH",
      );
      setDraft(await api<Draft>(`/properties/${draft.property.id}`));
      setJob(null);
      setPreview("");
      setShare("");
      submission.current = null;
    });
  }
  async function generate() {
    await run(async () => {
      if (!draft) throw new Error("INSUFFICIENT_EVIDENCE");
      const value = {
        propertyId: draft.property.id,
        revision: draft.property.revision,
        mode,
        template,
        branding,
        captions,
        aspectRatio: EXPORT_PRESETS[preset].aspect,
        durationSeconds: duration,
        sourceAssetIds: draft.assets
          .filter((a) => a.kind !== "floor-plan")
          .map((a) => a.id),
      };
      if (mode === "interactive-3d")
        delete (value as { sourceAssetIds?: string[] }).sourceAssetIds;
      const fingerprint = JSON.stringify(value);
      if (submission.current?.fingerprint !== fingerprint)
        submission.current = { fingerprint, key: crypto.randomUUID() };
      const command = { ...value, idempotencyKey: submission.current.key };
      await api("/quote", command);
      const j = await api<JobView>("/jobs", command);
      setJob(j);
      setStep(3);
      setPreview("");
      await refresh();
      section.current?.focus();
    });
  }
  async function download() {
    if (!job || job.state !== "approved") return;
    await run(async () => {
      const g = await api<{ token: string }>(
        `/jobs/${job.id}/download-grant`,
        {},
      );
      const r = await localRequest(`/jobs/${job.id}/output`, {
        headers: { "x-spaces-grant": g.token },
      });
      saveBlob(
        await r.blob(),
        `spaces-${job.command.aspectRatio === "9:16" ? "dikey" : "yatay"}.${job.output?.extension ?? "mp4"}`,
      );
    });
  }
  const canEdit =
      !workspace || ["admin", "editor"].includes(workspace.actor.role),
    ready = (draft?.assets.length ?? 0) > 0 && !pending.length;
  const brandStyle = workspace
    ? ({
        "--ux-accent": workspace.brand.accent,
        "--ux-accent-text": workspace.brand.accentText,
      } as CSSProperties)
    : undefined;
  return (
    <div className="ux-studio" style={brandStyle}>
      <div className="ux-demo-note">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>
          Yerel demo · Yalnız sentetik örnek yükle. Gerçek mülk veya müşteri
          verisi kullanma. Canlı servisler kapalı.
        </span>
      </div>
      <nav className="ux-navigation" aria-label="Stüdyo bölümleri">
        {(
          [
            ["create", "Oluştur"],
            ["projects", "Projelerim"],
            ["shares", "Paylaşımlar / Sonuçlar"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            aria-current={view === id ? "page" : undefined}
            onClick={() => {
              setView(id);
              void refresh().catch(() =>
                setError("Projeler alınamadı. Tekrar dene."),
              );
            }}
          >
            {label}
          </button>
        ))}
        <Link className="ux-manage" href="/spaces/manage">
          <Settings2 size={16} aria-hidden="true" />
          Hesap ve yönetim
        </Link>
      </nav>
      {view === "create" ? (
        <>
          <section className="ux-hero" aria-label="Mülkün için içerik oluştur">
            <div className="ux-hero-copy">
              <span className="ux-kicker">MÜLKÜNÜN HİKÂYESİNİ GÖSTER</span>
              <h1>
                Bir mekân.
                <br />
                <em>Güçlü bir ilk izlenim.</em>
              </h1>
              <p>
                Fotoğraf veya videolarını ekle. Tarzını seç.
                <br />
                Mülkünü anlatan içeriği önizle ve indir.
              </p>
              <button
                className="ux-primary"
                disabled={!bootstrap || busy || !canEdit}
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={19} aria-hidden="true" />
                {STUDIO_TR.upload}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <span className="ux-hero-detail">
                Fotoğraf + MP4 video · Özel dosyalar · Kolay önizleme
              </span>
            </div>
            <div className="ux-hero-art">
              <img
                src="/spaces-examples/interior.svg"
                alt="Sıcak nötr tonlarda özgün sentetik salon illüstrasyonu"
              />
              <span>Temsilî sentetik görsel · Gerçek bir ilan değil</span>
              <div className="ux-art-label">
                <span>SPACES COLLECTION</span>
                <strong>Mekânı hissettir.</strong>
              </div>
            </div>
          </section>
          <ol className="ux-stepper" aria-label="İçerik oluşturma adımları">
            {STUDIO_TR.steps.map((label, i) => (
              <li
                key={label}
                aria-current={step === i + 1 ? "step" : undefined}
              >
                <button
                  disabled={(i > 0 && !ready) || busy}
                  onClick={() => setStep(i + 1)}
                >
                  <span>
                    {step > i + 1 ? (
                      <Check size={15} aria-hidden="true" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
          <section
            className="ux-workbench"
            ref={section}
            tabIndex={-1}
            aria-label="İçerik stüdyosu"
          >
            {error && (
              <p className="ux-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="ux-note" role="status">
                {notice}
              </p>
            )}
            {!canEdit && (
              <p className="ux-note">
                Bu hesap görüntüleme veya inceleme için yetkili. Yükleme ve
                oluşturma için düzenleme yetkisi gerekir.{" "}
                <Link href="/spaces/manage">İnceleme ve hesap alanını aç</Link>
              </p>
            )}
            <input
              ref={fileInput}
              className="ux-file-input"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,.mp4"
              aria-label="Fotoğraf veya video seç"
              tabIndex={-1}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                selectFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            {step === 1 && (
              <>
                <div className="ux-section-heading">
                  <div>
                    <span className="ux-kicker">01 / MEDYA</span>
                    <h2>Fotoğraf ve videolarını ekle</h2>
                    <p>
                      En iyi açılarını bir araya getir. Sıralamayı dilediğin
                      gibi değiştir.
                    </p>
                  </div>
                  <button
                    className="subtle"
                    disabled={busy || !canEdit}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Plus size={17} aria-hidden="true" />
                    Dosya ekle
                  </button>
                </div>
                <button
                  className="ux-dropzone"
                  disabled={busy || !canEdit}
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!busy && canEdit)
                      selectFiles(Array.from(e.dataTransfer.files));
                  }}
                >
                  <span className="ux-upload-symbol">
                    <Upload size={27} aria-hidden="true" />
                  </span>
                  <strong>Dosyalarını buraya bırak veya seç</strong>
                  <span>Galerinden ya da cihazından fotoğraf / MP4 seç</span>
                  <small>
                    Fotoğraf: JPEG, PNG, WebP · 5 MB
                    <br />
                    Video: H.264 MP4 · 20 MB · 30 sn · En fazla 1080p (dikey /
                    yatay)
                    <br />
                    MOV ve WebM şu anda desteklenmiyor. En fazla 12 dosya.
                  </small>
                </button>
                <div
                  className="ux-media-grid"
                  role="group"
                  aria-label="Seçilen medya"
                >
                  {draft?.assets.map((a, i) => (
                    <article className="ux-media-card" key={a.id}>
                      <MediaThumbnail
                        url={thumbs[a.id]}
                        video={a.mime === "video/mp4"}
                        label={`Kaynak ${i + 1}`}
                      />
                      <div>
                        <strong>
                          {a.mime === "video/mp4" ? "Video" : "Fotoğraf"}{" "}
                          {i + 1}
                        </strong>
                        <span>
                          <Check size={14} aria-hidden="true" />
                          Özel alana kaydedildi
                        </span>
                      </div>
                      <div className="ux-media-tools">
                        <button
                          className="subtle"
                          aria-label={`Kaynak ${i + 1} yukarı`}
                          disabled={busy || i === 0}
                          onClick={() => {
                            const ids = draft.assets.map((v) => v.id);
                            [ids[i - 1], ids[i]] = [ids[i]!, ids[i - 1]!];
                            void changeMedia(ids);
                          }}
                        >
                          <MoveUp size={16} />
                        </button>
                        <button
                          className="subtle"
                          aria-label={`Kaynak ${i + 1} aşağı`}
                          disabled={busy || i === draft.assets.length - 1}
                          onClick={() => {
                            const ids = draft.assets.map((v) => v.id);
                            [ids[i + 1], ids[i]] = [ids[i]!, ids[i + 1]!];
                            void changeMedia(ids);
                          }}
                        >
                          <MoveDown size={16} />
                        </button>
                        <button
                          className="subtle"
                          disabled={busy}
                          aria-label={`Kaynak ${i + 1} değiştir`}
                          onClick={() => {
                            replaceTarget.current = a.id;
                            fileInput.current?.click();
                          }}
                        >
                          Değiştir
                        </button>
                        <button
                          className="subtle"
                          disabled={busy}
                          aria-label={`Kaynak ${i + 1} kaldır`}
                          onClick={() =>
                            void changeMedia(
                              draft.assets
                                .filter((v) => v.id !== a.id)
                                .map((v) => v.id),
                            )
                          }
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                  {pending.map((p, i) => (
                    <article className="ux-media-card" key={p.key}>
                      <MediaThumbnail
                        url={p.url}
                        video={p.file.type === "video/mp4"}
                        label={`Seçim ${i + 1}`}
                      />
                      <div>
                        <strong title={p.file.name}>{p.file.name}</strong>
                        <span>
                          {p.state === "uploading"
                            ? "Yükleniyor ve kontrol ediliyor…"
                            : p.state === "error"
                              ? "Tekrar denenebilir"
                              : "Yüklemeye hazır"}
                        </span>
                        {p.error && <p role="status">{p.error}</p>}
                      </div>
                      <button
                        className="subtle"
                        disabled={busy}
                        aria-label={`Seçim ${i + 1} kaldır`}
                        onClick={() =>
                          setPending((v) => v.filter((x) => x.key !== p.key))
                        }
                      >
                        <X size={16} />
                      </button>
                    </article>
                  ))}
                </div>
                {pending.length > 0 && (
                  <div className="ux-upload-confirm">
                    <label className="ux-checkbox">
                      <input
                        type="checkbox"
                        checked={rights}
                        onChange={(e) => setRights(e.target.checked)}
                        disabled={busy}
                      />
                      <span>{RIGHTS}</span>
                    </label>
                    <div className="ux-actions">
                      <button
                        className="ux-primary"
                        disabled={!rights || busy || !canEdit}
                        onClick={() => void uploadAll()}
                      >
                        {busy ? (
                          <LoaderCircle
                            size={17}
                            className="ux-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Upload size={17} aria-hidden="true" />
                        )}
                        Dosyaları güvenle yükle
                      </button>
                      {busy && (
                        <button
                          className="subtle"
                          onClick={() => controller.current?.abort()}
                        >
                          Yüklemeyi durdur
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <details className="ux-property-details">
                  <summary>Mülk bilgileri</summary>
                  <label>
                    Proje adı
                    <input
                      ref={titleInput}
                      defaultValue={draft?.property.title ?? ""}
                      placeholder="Örn. Bahçeli daire"
                      maxLength={120}
                      key={draft?.property.id ?? "new"}
                    />
                  </label>
                  {draft && (
                    <button
                      className="subtle"
                      disabled={busy || !canEdit}
                      onClick={() =>
                        void run(async () => {
                          const title = titleInput.current?.value.trim();
                          if (!title) return;
                          await api(
                            `/properties/${draft.property.id}`,
                            {
                              expectedRevision: draft.property.revision,
                              title,
                            },
                            "PATCH",
                          );
                          setDraft(
                            await api<Draft>(
                              `/properties/${draft.property.id}`,
                            ),
                          );
                          setJob(null);
                          setPreview("");
                          await refresh();
                        })
                      }
                    >
                      Adı kaydet
                    </button>
                  )}
                </details>
                <div className="ux-actions ux-next">
                  <span>Yüklediklerin yalnız bu proje için kullanılır.</span>
                  <button
                    className="ux-primary"
                    disabled={!ready || busy || !canEdit}
                    onClick={() => {
                      setStep(2);
                      section.current?.focus();
                    }}
                  >
                    Tarzını seç
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div className="ux-section-heading">
                  <div>
                    <span className="ux-kicker">02 / TARZ</span>
                    <h2>Nasıl bir video istersin?</h2>
                    <p>
                      Bir tarz seç. Diğer tercihleri senin için sade tuttuk.
                    </p>
                  </div>
                </div>
                <fieldset className="ux-style-grid">
                  <legend className="sr-only">Video tarzı</legend>
                  {VIDEO_STYLES.map((s, i) => (
                    <article
                      key={s.id}
                      className={`ux-style-card ${mode === s.id ? "selected" : ""}`}
                    >
                      <video
                        controls
                        playsInline
                        preload="none"
                        poster="/spaces-examples/interior.svg"
                        src={`/spaces-examples/${["natural", "cinematic", "hybrid"][i]}.mp4`}
                        aria-label={`${s.label} yerel örneği`}
                      />
                      <label>
                        <input
                          type="radio"
                          name="video-style"
                          checked={mode === s.id}
                          onChange={() => setMode(s.id)}
                        />
                        <span>
                          <strong>{s.label}</strong>
                          <small>{s.description}</small>
                        </span>
                      </label>
                      <span className="ux-example-label">
                        Sentetik kaynaklardan gerçek örnek kurgu
                      </span>
                    </article>
                  ))}
                </fieldset>
                <p className="ux-honesty">{DISCLOSURE}</p>
                <div className="ux-options">
                  <label>
                    Sunum şablonu
                    <select
                      value={template}
                      onChange={(e) =>
                        setTemplate(
                          e.target.value as keyof typeof TEMPLATE_LABELS,
                        )
                      }
                    >
                      {Object.entries(TEMPLATE_LABELS).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <small>Başlığı ve hafif renk düzenini değiştirir.</small>
                  </label>
                  <label>
                    Nerede kullanacaksın?
                    <select
                      value={preset}
                      onChange={(e) =>
                        setPreset(e.target.value as keyof typeof EXPORT_PRESETS)
                      }
                    >
                      {Object.entries(EXPORT_PRESETS).map(([id, p]) => (
                        <option key={id} value={id}>
                          {p.label} · {p.aspect === "9:16" ? "Dikey" : "Yatay"}
                        </option>
                      ))}
                    </select>
                    <small>
                      {EXPORT_PRESETS[preset].aspect === "9:16"
                        ? "Dikey (Reels / Story) · 360 × 640"
                        : "Yatay (YouTube / İlan) · 640 × 360"}
                    </small>
                  </label>
                  <label>
                    Video uzunluğu
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                    >
                      <option value={8}>Kısa · 8 saniye</option>
                      <option value={16}>Standart · 16 saniye</option>
                      <option value={4}>Hızlı örnek · 4 saniye</option>
                    </select>
                  </label>
                </div>
                <div className="ux-premium">
                  <Box size={29} aria-hidden="true" />
                  <div>
                    <h3>3D Sanal Tur — Premium / Beta</h3>
                    <p>
                      İçinde serbestçe dolaşılabilen ayrı bir deneyim. Ölçülü
                      plan, doğrulanmış odalar ve kapı bağlantıları gerekir.
                      Birkaç fotoğraftan gerçek ev oluşturulduğu iddia edilmez.
                    </p>
                    {mode === "interactive-3d" && (
                      <p role="status">
                        {draft?.property.manifest.measuredBy
                          ? "Ölçülü sentetik plan hazır. Gerçek mülk rekonstrüksiyonu değil."
                          : "Bu projede doğrulanmış ölçülü plan yok. Önce plan incelemesi gerekir."}
                      </p>
                    )}
                  </div>
                  <button
                    className="subtle"
                    aria-pressed={mode === "interactive-3d"}
                    onClick={() => setMode("interactive-3d")}
                  >
                    3D seçeneğini incele
                  </button>
                </div>
                <div className="ux-actions">
                  <button className="subtle" onClick={() => setStep(1)}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Medyanı düzenle
                  </button>
                  <button
                    className="subtle"
                    onClick={() => editor.current?.showModal()}
                  >
                    <Settings2 size={16} aria-hidden="true" />
                    Marka ve altyazı
                  </button>
                  <button
                    className="ux-primary"
                    disabled={
                      busy ||
                      !canEdit ||
                      (mode === "interactive-3d" &&
                        !draft?.property.manifest.measuredBy)
                    }
                    onClick={() => void generate()}
                  >
                    {busy ? "Başlatılıyor…" : "İçeriği oluştur"}
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </div>
                <p className="ux-small">
                  Yerel demoda ücret alınmaz. İndirme ve paylaşım öncesinde ayrı
                  bir incelemeci onayı gerekir.
                </p>
              </>
            )}
            {step === 3 && (
              <>
                <div className="ux-section-heading">
                  <div>
                    <span className="ux-kicker">03 / SONUÇ</span>
                    <h2>
                      {!job
                        ? "İçeriğin burada görünecek"
                        : job.state === "queued" || job.state === "processing"
                          ? "Videon hazırlanıyor"
                          : job.state === "approved"
                            ? "İçeriğin indirmeye hazır"
                            : "Önizle ve son kontrolleri tamamla"}
                    </h2>
                    <p>{draft?.property.title}</p>
                  </div>
                </div>
                {!job ? (
                  <button className="ux-primary" onClick={() => setStep(2)}>
                    Tarzını seç
                  </button>
                ) : (
                  <>
                    {(["queued", "processing"] as string[]).includes(
                      job.state,
                    ) && (
                      <div className="ux-progress" role="status">
                        <LoaderCircle className="ux-spin" aria-hidden="true" />
                        <strong>
                          {job.state === "queued"
                            ? "Sıranı hazırlıyoruz…"
                            : "Görüntüler düzenleniyor, dosya kontrol ediliyor…"}
                        </strong>
                        <p>
                          Bu pencereyi kapatsan da projen Projelerim’de
                          saklanır.
                        </p>
                        <button
                          className="subtle"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api(`/jobs/${job.id}/cancel`, {});
                              setJob(await api<JobView>(`/jobs/${job.id}`));
                            })
                          }
                        >
                          Oluşturmayı iptal et
                        </button>
                      </div>
                    )}
                    {preview &&
                      (job.output?.extension === "mp4" ? (
                        <div className="ux-result-comparison">
                          <div>
                            <span>Yüklediğin kaynak</span>
                            <MediaThumbnail
                              url={
                                draft?.assets[0]
                                  ? thumbs[draft.assets[0].id]
                                  : undefined
                              }
                              video={draft?.assets[0]?.mime === "video/mp4"}
                              label="Yüklenen ilk kaynak"
                            />
                          </div>
                          <div>
                            <span>Gerçek çıktı önizlemesi</span>
                            <video
                              controls
                              playsInline
                              src={preview}
                              aria-label="Oluşturulan video önizlemesi"
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="ux-note">
                          Gerçek gezilebilir 3D dosyan hazır. İnceleme ve onay
                          sonrası sanal tur bağlantısını açabilirsin.
                        </p>
                      ))}
                    {job.state === "awaiting-review" && (
                      <p className="ux-review-note" role="status">
                        <ShieldCheck size={20} aria-hidden="true" />
                        Önizlemen hazır. İndirme ve paylaşım için yetkili başka
                        bir incelemeci son kontrolleri tamamlamalı.{" "}
                        <Link
                          href={`/spaces/manage?property=${draft?.property.id ?? ""}`}
                        >
                          İnceleme alanı
                        </Link>
                      </p>
                    )}
                    {job.output && (
                      <p className="ux-small">
                        {job.output.width &&
                          `${job.output.width} × ${job.output.height} · `}
                        {job.output.durationSeconds &&
                          `${job.output.durationSeconds.toFixed(2)} sn · `}
                        {job.output.extension.toUpperCase()} ·{" "}
                        {mode === "interactive-3d"
                          ? "Ölçülü sentetik model; gerçek mülk değil."
                          : DISCLOSURE}
                      </p>
                    )}
                    {(["failed", "cancelled", "rejected"] as string[]).includes(
                      job.state,
                    ) && (
                      <div className="ux-note" role="status">
                        <p>
                          {job.state === "cancelled"
                            ? "Oluşturma iptal edildi."
                            : job.state === "rejected"
                              ? "İncelemeci düzenleme istedi."
                              : "İçerik oluşturulamadı."}{" "}
                          Yüklediğin dosyalar saklandı.
                        </p>
                        <button
                          className="ux-primary"
                          onClick={() => {
                            submission.current = null;
                            setStep(2);
                          }}
                        >
                          Düzenle ve tekrar dene
                        </button>
                      </div>
                    )}
                    <div className="ux-actions">
                      <button
                        className="ux-primary"
                        disabled={busy || job.state !== "approved"}
                        onClick={() => void download()}
                      >
                        <Download size={17} aria-hidden="true" />
                        İndir
                      </button>
                      <button
                        className="subtle"
                        disabled={busy || job.state !== "approved"}
                        onClick={() =>
                          void run(async () => {
                            const p = await api<{ token: string }>(
                              `/jobs/${job.id}/publish`,
                              {},
                            );
                            setShare(`/tour/${p.token}`);
                          })
                        }
                      >
                        Yerel paylaşım bağlantısı oluştur
                      </button>
                      <button className="subtle" onClick={() => setStep(1)}>
                        Kaynakları düzenle
                      </button>
                    </div>
                    {share && (
                      <div className="ux-note">
                        <Link href={share} target="_blank" rel="noreferrer">
                          Onaylı yerel turu aç
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                        <p>
                          Bağlantı 1 saat geçerli. Yalnız bu makinede açılır;
                          sosyal medyaya gönderilmedi.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </>
      ) : (
        <section className="ux-workbench">
          <div className="ux-section-heading">
            <div>
              <span className="ux-kicker">ÇALIŞMALARIN</span>
              <h1>
                {view === "projects" ? "Projelerim" : "Paylaşımlar / Sonuçlar"}
              </h1>
              <p>
                Kaldığın yerden devam et. Yalnız hesabının yetkili olduğu
                projeler gösterilir.
              </p>
            </div>
            <button
              className="ux-primary"
              onClick={() => {
                setDraft(null);
                setJob(null);
                setPending([]);
                setPreview("");
                setShare("");
                setThumbs({});
                setStep(1);
                setView("create");
              }}
            >
              Yeni içerik
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="ux-project-grid">
            {workspace?.properties
              .filter(
                (p) =>
                  view === "projects" ||
                  workspace.jobs.some(
                    (j) => j.property_id === p.id && j.state === "approved",
                  ),
              )
              .map((p) => (
                <article key={p.id}>
                  <FolderOpen size={28} aria-hidden="true" />
                  <h2>{p.title}</h2>
                  <p>
                    {workspace.jobs.some(
                      (j) => j.property_id === p.id && j.state === "approved",
                    )
                      ? "Onaylı çıktı hazır"
                      : "Taslak ve çalışmalar"}
                  </p>
                  <button
                    className="subtle"
                    onClick={() => void run(() => openProject(p.id, workspace))}
                  >
                    Devam et
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </article>
              ))}
          </div>
          {!workspace?.properties.length && (
            <div className="ux-empty">
              <FolderOpen size={42} aria-hidden="true" />
              <h2>İlk projen burada yerini alacak.</h2>
              <p>Oluştur bölümünden medyanı ekleyerek başla.</p>
            </div>
          )}
        </section>
      )}
      <dialog
        className="ux-dialog"
        ref={editor}
        aria-labelledby="ux-edit-title"
      >
        <div className="ux-section-heading">
          <h2 id="ux-edit-title">Küçük dokunuşlar</h2>
          <button
            className="subtle"
            aria-label="Düzenleme panelini kapat"
            onClick={() => editor.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <label className="ux-checkbox">
          <input
            type="checkbox"
            checked={captions}
            onChange={(e) => setCaptions(e.target.checked)}
          />
          Şablon başlığını videoya ekle
        </label>
        <label className="ux-checkbox">
          <input
            type="checkbox"
            checked={branding}
            onChange={(e) => setBranding(e.target.checked)}
          />
          Hesabımdaki marka adını ve varsa logosunu ekle
        </label>
        <p>
          Marka ve logo ayarları hesap yönetiminde tutulur. Müzik / ses ekleme
          bu demoda desteklenmiyor; yüklenen videonun sesi de kaldırılır.
        </p>
        <Link href="/spaces/manage">Marka ayarlarını aç</Link>
        <button className="ux-primary" onClick={() => editor.current?.close()}>
          Tercihleri kaydet
        </button>
      </dialog>
      <details className="ux-developer">
        <summary>Yerel demo ve gelişmiş araçlar</summary>
        <p>
          Bu deneyim yalnız bu makinede, sentetik dosyalarla çalışır. İlk
          yüklemede hazır demo hesabıyla açılır; gerçek giriş sistemi değildir.
          Canlı AI, ElevenLabs, ödeme ve bulut bağlı değildir.
        </p>
        <Link href="/spaces/manage">
          Test hesapları, inceleme, analitik, marka, bayi ve kullanım
        </Link>
        <Link href="/">Foundation arşivi</Link>
        {draft && (
          <button
            className="subtle"
            disabled={busy || !canEdit}
            onClick={() =>
              void run(async () => {
                await api(`/properties/${draft.property.id}/fixture`, {});
                setDraft(await api<Draft>(`/properties/${draft.property.id}`));
                await refresh();
                setNotice(
                  "Ölçülü sentetik 3D örneği eklendi. Gerçek konut planı değildir.",
                );
              })
            }
          >
            Ölçülü sentetik 3D örneği ekle
          </button>
        )}
      </details>
    </div>
  );
}
