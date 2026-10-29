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
import { EXPORT_PRESETS, TEMPLATE_LABELS } from "@/domain/media-intake";
import {
  DISCLOSURE,
  RIGHTS,
  STUDIO_TR,
  friendlyMediaError as friendly,
} from "./studio-copy";
import { api, localRequest, saveBlob } from "./client";
import {
  MEDIA_CAPABILITIES,
  MEDIA_PICKER_ACCEPT,
  MEDIA_UPLOAD_HELP_TR,
} from "@/domain/media-capabilities";
import { preflightSelection } from "./media-preflight";
import { useStudioFunnel } from "./use-studio-funnel";
import { StudioStyleCards } from "./studio-presentation";
import {
  PROPERTY_STYLE_CARDS,
  type PropertyVideoStyle,
  type StudioProduct,
} from "@/domain/real-estate-styles";
import type { StudioPlanView } from "@/contracts/studio-ui";
import { ApiFirstControls, StudioProductSelector } from "./api-first-controls";
import { StudioPreviewRail } from "./studio-preview-rail";
import { ServiceCards } from "../showcase/customer-showcase";
import { CustomerSteps, OrderSummary } from "./customer-journey";

type Draft = { property: PropertyView; assets: AssetView[] };
type Pending = {
  key: string;
  file: File;
  url: string;
  state: "ready" | "uploading" | "error" | "blocked";
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
  const {
    record: recordFunnel,
    consent: consentFunnel,
    enabled: funnelEnabled,
    snapshot: funnelSnapshot,
  } = useStudioFunnel();
  const funnelJobState = useRef("");
  const funnelOrg = useRef<string | null>(null);
  const compositionLock = useRef(false);
  const [product, setProduct] = useState<StudioProduct>("video"),
    [cameraStyle, setCameraStyle] = useState<PropertyVideoStyle>("natural"),
    [panoramaConfirmed, setPanoramaConfirmed] = useState(false),
    [targetSeconds, setTargetSeconds] = useState<30 | 45 | 60>(30),
    [studioPlan, setStudioPlan] = useState<StudioPlanView | null>(null);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null),
    [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [view, setView] = useState<"create" | "projects" | "archive">("create"),
    [step, setStep] = useState(1),
    [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "service",
    );
    if (
      requested === "video" ||
      requested === "ai-3d" ||
      requested === "tour-360"
    ) {
      setProduct(requested);
      setStep(2);
    }
  }, []);
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
  useEffect(() => {
    const picker = fileInput.current;
    const cancelled = () => {
      replaceTarget.current = null;
    };
    picker?.addEventListener("cancel", cancelled);
    return () => picker?.removeEventListener("cancel", cancelled);
  }, [view]);
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
    const service = new URLSearchParams(window.location.search).get("service");
    const hasService =
      service === "video" || service === "ai-3d" || service === "tour-360";
    setJob(hasService ? null : (jobs[0] ?? null));
    if (jobs[0]) {
      const c = jobs[0].command;
      setMode(c.mode as Mode);
      setDuration(c.photoComposition ? 8 : c.durationSeconds);
      if (c.photoComposition) {
        setCameraStyle(c.photoComposition.styleId);
        setTargetSeconds(c.photoComposition.requestedDurationSeconds);
      }
      setPreset(c.aspectRatio === "16:9" ? "youtube" : "reels");
    }
    setStep(hasService ? 2 : jobs.length ? 5 : 2);
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
  useEffect(() => {
    const org = workspace?.actor.organizationId ?? null;
    if (funnelOrg.current !== null && funnelOrg.current !== org)
      consentFunnel(false);
    funnelOrg.current = org;
  }, [workspace?.actor.organizationId, consentFunnel]);
  const jobId = job?.id,
    jobState = job?.state;
  useEffect(() => {
    const marker = `${jobId ?? ""}:${jobState ?? ""}`;
    if (funnelJobState.current === marker) return;
    funnelJobState.current = marker;
    if (jobState === "awaiting-review") recordFunnel("review_pending");
    if (jobState === "approved") recordFunnel("approval_observed");
  }, [jobId, jobState, recordFunnel]);
  useEffect(() => {
    if (
      !jobId ||
      !jobState ||
      !["queued", "processing", "awaiting-review"].includes(jobState)
    )
      return;
    let active = true,
      sequence = 0,
      lastApplied = 0;
    const sync = () => {
      const requested = ++sequence;
      void api<JobView>(`/jobs/${jobId}`)
        .then((j) => {
          if (active && requested > lastApplied) {
            lastApplied = requested;
            setJob(j);
          }
        })
        .catch(() => {
          if (active)
            setError(
              "Durum alınamadı. Projen kaydedildi; bağlantını kontrol et.",
            );
        });
    };
    const resume = () => {
      if (document.visibilityState === "visible") sync();
    };
    const timer = setInterval(sync, 1800);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    sync();
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
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
        if (active) {
          setPreview(objectUrl(b));
          recordFunnel("preview_opened");
        }
      })
      .catch(() => {
        if (active)
          setError("Önizleme açılamadı. Projelerim’den yeniden açabilirsin.");
      });
    return () => {
      active = false;
    };
  }, [jobId, jobState, objectUrl, recordFunnel]);
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
  async function selectFiles(files: File[]) {
    // Cancelling the native picker must not discard the current draft/result or advance the wizard.
    if (!files.length) {
      replaceTarget.current = null;
      return;
    }
    setError("");
    setNotice("");
    setJob(null);
    setPreview("");
    setShare("");
    setStudioPlan(null);
    const target = replaceTarget.current;
    replaceTarget.current = null;
    if (target) files = files.slice(0, 1);
    const list: Pending[] = [];
    // Sequential bounded header inspection; no network, transcoder, storage or quote.
    for (const file of files.slice(0, MEDIA_CAPABILITIES.maxSelection)) {
      let advice;
      try {
        advice = await preflightSelection(file);
        if (product !== "video" && file.type === "video/mp4")
          advice = {
            supported: false,
            message:
              "Bu seçenek için fotoğraf ekle. 360° turda gerçek 2:1 panorama gerekir.",
          };
      } catch {
        advice = {
          supported: false,
          message:
            "Dosya cihazından okunamadı. Başka bir kopyayı seç; yükleme başlamadı.",
        };
      }
      if (
        !advice.supported &&
        ["video/quicktime", "video/webm"].includes(file.type)
      )
        setError(
          "MOV/WebM desteklenmiyor. Desteklenmeyen seçimin korunuyor; dosya kartındaki dönüşüm önerisini izleyebilirsin.",
        );
      recordFunnel(
        advice.supported ? "selection_supported" : "selection_unsupported",
      );
      list.push({
        key: crypto.randomUUID(),
        file,
        url: advice.supported ? objectUrl(file) : "",
        state: advice.supported ? "ready" : "blocked",
        error: advice.supported ? undefined : advice.message,
        replaceId: target ?? undefined,
      });
    }
    setPending((v) =>
      [...v, ...list].slice(
        0,
        target
          ? 1
          : MEDIA_CAPABILITIES.maxSelection - (draft?.assets.length ?? 0),
      ),
    );
    setStep(2);
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
        if (item.state === "blocked") continue;
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
          recordFunnel("upload_succeeded");
          setPending((v) => v.filter((p) => p.key !== item.key));
        } catch (e) {
          recordFunnel("upload_failed");
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
      recordFunnel("quote_returned");
      const j = await api<JobView>("/jobs", command);
      recordFunnel("job_started");
      setJob(j);
      setStep(5);
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
      recordFunnel("download_completed");
      saveBlob(
        await r.blob(),
        `spaces-${job.command.aspectRatio === "9:16" ? "dikey" : "yatay"}.${job.output?.extension ?? "mp4"}`,
      );
    });
  }
  async function checkStudioPlan() {
    if (!draft) throw new Error("INSUFFICIENT_EVIDENCE");
    const photoIds = draft.assets
      .filter((a) => a.kind === "photo" || a.kind === "panorama")
      .map((a) => a.id);
    const planned = await api<StudioPlanView>("/studio/plan", {
      propertyId: draft.property.id,
      revision: draft.property.revision,
      product,
      styleId: cameraStyle,
      requestedDurationSeconds: targetSeconds,
      aspectRatio: EXPORT_PRESETS[preset].aspect,
      sourceAssetIds: photoIds,
      panoramaConfirmed,
    });
    setStudioPlan(planned);
    return planned;
  }
  async function generatePhotoEdit() {
    if (compositionLock.current) return;
    compositionLock.current = true;
    try {
      await run(async () => {
        const plan = await checkStudioPlan();
        if (!plan.localSourceAssetIds.length)
          throw new Error("INSUFFICIENT_EVIDENCE");
        const style = PROPERTY_STYLE_CARDS.find((s) => s.id === cameraStyle)!;
        const value = {
          propertyId: plan.propertyId,
          revision: plan.revision,
          mode: style.legacyMode,
          template,
          captions,
          branding,
          aspectRatio: EXPORT_PRESETS[preset].aspect,
          durationSeconds: plan.suggestedDurationSeconds,
          sourceAssetIds: plan.localSourceAssetIds,
          photoComposition: {
            version: "property-video-v1",
            styleId: cameraStyle,
            requestedDurationSeconds: targetSeconds,
          },
        };
        const fingerprint = JSON.stringify(value);
        if (submission.current?.fingerprint !== fingerprint)
          submission.current = { fingerprint, key: crypto.randomUUID() };
        const command = { ...value, idempotencyKey: submission.current.key };
        await api("/quote", command);
        recordFunnel("quote_returned");
        const created = await api<JobView>("/jobs", command);
        recordFunnel("job_started");
        setMode(style.legacyMode);
        setJob(created);
        setPreview("");
        setShare("");
        setStep(5);
        await refresh();
        section.current?.focus();
      });
    } finally {
      compositionLock.current = false;
    }
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
    <div
      className={`ux-studio v54-studio v55-studio ${step === 1 ? "v55-step-one" : ""}`}
      style={brandStyle}
    >
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
            ["create", "Yeni Çalışma"],
            ["projects", "Projelerim"],
            ["archive", "Medya Arşivi"],
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
      </nav>
      {view === "create" ? (
        <>
          <div className={`ux-studio-heading ${step > 1 ? "is-compact" : ""}`}>
            <div>
              <span className="ux-kicker">EMLAK STÜDYOSU</span>
              <h1>
                Bir fotoğraftan
                <br />
                <em>daha fazlası.</em>
              </h1>
              <p>Mekânınızı anlatan bir içerik hazırlayın.</p>
            </div>
            <span className="ux-studio-caption">
              Bir mekân. Size ait bir anlatım.
            </span>
          </div>
          {step !== 1 && (
            <StudioProductSelector
              value={product}
              disabled={busy}
              onSelect={(p) => {
                setProduct(p);
                setStudioPlan(null);
                setPanoramaConfirmed(false);
                setError("");
                setJob(null);
                setPreview("");
                setShare("");
                if (step > 1) setStep(ready ? 3 : 2);
              }}
            />
          )}
          <div className="v54-workspace">
            <div className="v54-main-column">
              <CustomerSteps
                step={step}
                onStep={setStep}
                canAdvance={ready}
                disabled={busy}
              />
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
                    <Link href="/spaces/manage">
                      İnceleme ve hesap alanını aç
                    </Link>
                  </p>
                )}
                <input
                  ref={fileInput}
                  className="ux-file-input"
                  type="file"
                  multiple
                  accept={
                    product === "video"
                      ? MEDIA_PICKER_ACCEPT
                      : "image/jpeg,image/png,image/webp"
                  }
                  aria-label="Fotoğraf veya video seç"
                  tabIndex={-1}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    void selectFiles(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
                {step === 1 && (
                  <>
                    <div className="v55-service-heading">
                      <div>
                        <h2>
                          Nasıl bir çalışma <em>istersin?</em>
                        </h2>
                        <p>Örneğine bak, ihtiyacına uygun hizmeti seç.</p>
                      </div>
                    </div>
                    <div className="v55-quick-start">
                      <span>
                        Video ile hemen başla. Yalnız sentetik dosyalarla yerel
                        deneme.
                      </span>
                      <button
                        type="button"
                        className="ux-primary"
                        disabled={!bootstrap || busy || !canEdit}
                        onClick={() => {
                          setProduct("video");
                          replaceTarget.current = null;
                          recordFunnel("picker_opened");
                          fileInput.current?.click();
                        }}
                      >
                        <Upload size={17} aria-hidden="true" />
                        Fotoğraf veya video ekle
                      </button>
                    </div>
                    <ServiceCards
                      compact
                      selected={product}
                      disabled={busy || !canEdit}
                      onSelect={(p) => {
                        setProduct(p);
                        setStudioPlan(null);
                        setPanoramaConfirmed(false);
                        setJob(null);
                        setPreview("");
                        setStep(2);
                      }}
                    />
                    <button
                      type="button"
                      className="ux-sample"
                      disabled={!bootstrap || busy || !canEdit}
                      onClick={() =>
                        void run(async () => {
                          const d = await ensureDraft();
                          await api(`/properties/${d.property.id}/fixture`, {});
                          setDraft(
                            await api<Draft>(`/properties/${d.property.id}`),
                          );
                          setProduct("video");
                          setJob(null);
                          setPreview("");
                          setShare("");
                          submission.current = null;
                          await refresh();
                          setStep(3);
                          setNotice(
                            "Örnek mülk eklendi. Yalnız sentetik kaynaklar kullanılır; oluşturulan çıktı ayrıca incelenir.",
                          );
                        })
                      }
                    >
                      Örnek mülkle dene{" "}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </>
                )}
                {step === 2 && (
                  <>
                    {product !== "video" && (
                      <p className="ux-note">
                        {product === "tour-360"
                          ? "360° tur için gerçek 2:1 oranında equirectangular panorama gerekir. Normal oda fotoğrafı uygun değildir; oran, kaynak kontrolünde ayrıca doğrulanır."
                          : "AI 3D hazırlığında 1–4 fotoğraf kullanılır. Gerçek üretim kapalıdır; fotoğraflar görünmeyen alanların ölçüsünü kanıtlamaz."}
                      </p>
                    )}
                    <div
                      className="ux-upload-stage"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!busy && canEdit)
                          void selectFiles(Array.from(e.dataTransfer.files));
                      }}
                    >
                      <span className="ux-upload-symbol">
                        <Upload size={27} aria-hidden="true" />
                      </span>
                      <h2>İyi bir hikâye burada başlar.</h2>
                      <p>Fotoğraf ve videolarınızı buraya bırakın.</p>
                      <button
                        className="ux-primary"
                        disabled={!bootstrap || busy || !canEdit}
                        onClick={() => {
                          replaceTarget.current = null;
                          recordFunnel("picker_opened");
                          fileInput.current?.click();
                        }}
                      >
                        <Upload size={18} aria-hidden="true" />
                        {STUDIO_TR.upload}
                        <ArrowRight size={17} aria-hidden="true" />
                      </button>
                      {!draft?.assets.length && !pending.length && (
                        <button
                          className="ux-sample"
                          disabled={!bootstrap || busy || !canEdit}
                          onClick={() =>
                            void run(async () => {
                              const d = await ensureDraft();
                              await api(
                                `/properties/${d.property.id}/fixture`,
                                {},
                              );
                              setDraft(
                                await api<Draft>(
                                  `/properties/${d.property.id}`,
                                ),
                              );
                              setJob(null);
                              setPreview("");
                              setShare("");
                              submission.current = null;
                              await refresh();
                              setStep(3);
                              setNotice(
                                "Örnek mülk eklendi. Yalnız sentetik kaynaklar kullanılır; oluşturulan çıktı ayrıca incelenir.",
                              );
                            })
                          }
                        >
                          Örnek mülkle dene
                          <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      )}
                      <span className="ux-upload-privacy">
                        <ShieldCheck size={14} aria-hidden="true" />
                        Özel yerel alan · Canlı servisler kapalı
                      </span>
                      <details className="ux-format-help">
                        <summary>Desteklenen biçimler</summary>
                        <p>{MEDIA_UPLOAD_HELP_TR.photos}</p>
                        <p>{MEDIA_UPLOAD_HELP_TR.videos}</p>
                        <p>
                          En fazla {MEDIA_CAPABILITIES.maxSelection} dosya. MOV
                          / WebM desteklenmiyor.
                        </p>
                      </details>
                    </div>
                    <details className="ux-property-details">
                      <summary>iPhone ve video biçimleri hakkında</summary>
                      <p>{MEDIA_UPLOAD_HELP_TR.iphone}</p>
                      <p>{MEDIA_UPLOAD_HELP_TR.caveat}</p>
                    </details>
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
                              {a.kind === "floor-plan"
                                ? "Plan"
                                : a.kind === "panorama"
                                  ? "Panorama"
                                  : a.mime === "video/mp4"
                                    ? "Video"
                                    : "Fotoğraf"}{" "}
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
                                recordFunnel("picker_opened");
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
                                : p.state === "blocked"
                                  ? "Bu biçim yüklenmeyecek"
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
                              setPending((v) =>
                                v.filter((x) => x.key !== p.key),
                              )
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
                            onChange={(e) => {
                              setRights(e.target.checked);
                              if (e.target.checked)
                                recordFunnel("rights_accepted");
                            }}
                            disabled={busy}
                          />
                          <span>{RIGHTS}</span>
                        </label>
                        <div className="ux-actions">
                          <button
                            className="ux-primary"
                            disabled={
                              !rights ||
                              busy ||
                              !canEdit ||
                              !pending.some((p) => p.state !== "blocked")
                            }
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
                      <span>
                        Yüklediklerin yalnız bu proje için kullanılır.
                      </span>
                      <button
                        className="ux-primary"
                        disabled={!ready || busy || !canEdit}
                        onClick={() => {
                          setStep(3);
                          section.current?.focus();
                        }}
                      >
                        Tarzını seç
                        <ArrowRight size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}
                {step === 3 && (
                  <>
                    <div className="ux-section-heading">
                      <div>
                        <span className="ux-kicker">03 / TARZ</span>
                        <h2>
                          {product === "video"
                            ? "Nasıl bir video istersin?"
                            : product === "ai-3d"
                              ? "AI 3D deneyimini hazırla"
                              : "360° turunu hazırla"}
                        </h2>
                        <p>
                          {product === "video"
                            ? "Tek bir tarz seç; her fotoğraf ayrı bir sahne olsun."
                            : "İçerik türüne uygun kaynakları kontrol edelim."}
                        </p>
                      </div>
                    </div>
                    <ApiFirstControls
                      product={product}
                      styleId={cameraStyle}
                      onStyle={(style) => {
                        setCameraStyle(style);
                        setStudioPlan(null);
                        recordFunnel("style_selected");
                      }}
                      aspect={EXPORT_PRESETS[preset].aspect}
                      onAspect={(aspect) => {
                        setPreset(aspect === "9:16" ? "reels" : "listing");
                        setStudioPlan(null);
                      }}
                      duration={targetSeconds}
                      onDuration={(seconds) => {
                        setTargetSeconds(seconds);
                        setStudioPlan(null);
                      }}
                      photoCount={
                        draft?.assets.filter(
                          (a) => a.kind === "photo" || a.kind === "panorama",
                        ).length ?? 0
                      }
                      plan={
                        studioPlan?.revision === draft?.property.revision &&
                        studioPlan?.product === product
                          ? studioPlan
                          : null
                      }
                      busy={busy}
                      canEdit={canEdit}
                      panoramaConfirmed={panoramaConfirmed}
                      onPanoramaConfirmed={setPanoramaConfirmed}
                      onPlan={() =>
                        void run(async () => {
                          await checkStudioPlan();
                        })
                      }
                      onContinue={() => setStep(4)}
                      onCreateLocal={() => void generatePhotoEdit()}
                    />
                    <details className="v54-legacy">
                      <summary>
                        Önceki yerel kurgu ve ölçülü 3D seçenekleri
                      </summary>
                      <StudioStyleCards
                        value={mode}
                        examples="illustration"
                        disabled={busy || !canEdit}
                        onSelect={(selected) => {
                          setMode(selected);
                          recordFunnel("style_selected");
                        }}
                      />
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
                            {Object.entries(TEMPLATE_LABELS).map(
                              ([id, label]) => (
                                <option key={id} value={id}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                          <small>
                            Başlığı ve hafif renk düzenini değiştirir.
                          </small>
                        </label>
                        <label>
                          Nerede kullanacaksın?
                          <select
                            value={preset}
                            onChange={(e) =>
                              setPreset(
                                e.target.value as keyof typeof EXPORT_PRESETS,
                              )
                            }
                          >
                            {Object.entries(EXPORT_PRESETS).map(([id, p]) => (
                              <option key={id} value={id}>
                                {p.label} ·{" "}
                                {p.aspect === "9:16" ? "Dikey" : "Yatay"}
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
                            onChange={(e) =>
                              setDuration(Number(e.target.value))
                            }
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
                          <h3>3D turu keşfet</h3>
                          <p>
                            İçinde serbestçe dolaşılabilen ayrı bir deneyim.
                            Ölçülü plan, doğrulanmış odalar ve kapı bağlantıları
                            gerekir. Birkaç fotoğraftan gerçek ev oluşturulduğu
                            iddia edilmez.
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
                          3D seçeneklerini aç
                        </button>
                      </div>
                      <div className="ux-actions">
                        <button className="subtle" onClick={() => setStep(2)}>
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
                        Yerel demoda ücret alınmaz. İndirme ve paylaşım
                        öncesinde ayrı bir incelemeci onayı gerekir.
                      </p>
                    </details>
                  </>
                )}
                {step === 4 && (
                  <OrderSummary
                    product={product}
                    style={cameraStyle}
                    count={
                      draft?.assets.filter(
                        (a) => a.kind === "photo" || a.kind === "panorama",
                      ).length ?? 0
                    }
                    aspect={EXPORT_PRESETS[preset].aspect}
                    duration={targetSeconds}
                    plan={
                      studioPlan?.revision === draft?.property.revision &&
                      studioPlan?.product === product
                        ? studioPlan
                        : null
                    }
                    busy={busy}
                    canEdit={canEdit}
                    onCreate={() => void generatePhotoEdit()}
                    onCheck={() =>
                      void run(async () => {
                        await checkStudioPlan();
                      })
                    }
                    onBack={() => setStep(3)}
                  />
                )}
                {step === 5 && (
                  <>
                    <div className="ux-section-heading">
                      <div>
                        <span className="ux-kicker">PROJE SONUCU</span>
                        <h2>
                          {!job
                            ? "İçeriğin burada görünecek"
                            : job.state === "queued" ||
                                job.state === "processing"
                              ? "Videon hazırlanıyor"
                              : job.state === "approved"
                                ? "İçeriğin indirmeye hazır"
                                : "Önizle ve son kontrolleri tamamla"}
                        </h2>
                        <p>{draft?.property.title}</p>
                      </div>
                    </div>
                    {!job ? (
                      <button className="ux-primary" onClick={() => setStep(3)}>
                        Tarzını seç
                      </button>
                    ) : (
                      <>
                        <p className="v55-order-link">
                          <Link href={`/spaces/projects/${job.id}`}>
                            Proje sonuç sayfasını aç →
                          </Link>
                        </p>
                        {(["queued", "processing"] as string[]).includes(
                          job.state,
                        ) && (
                          <div className="ux-progress" role="status">
                            <LoaderCircle
                              className="ux-spin"
                              aria-hidden="true"
                            />
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
                        {preview && (
                          <p className="ux-note">
                            {job.output?.extension === "mp4"
                              ? "Gerçek dosyan medya alanında oynatılabilir. Kaynak sırası ve örnek açıklaması yanında korunur."
                              : "Ölçülü sentetik 3D dosyan medya alanında serbest gezilebilir; gerçek mülk rekonstrüksiyonu değildir."}
                          </p>
                        )}
                        {job.state === "awaiting-review" && (
                          <p className="ux-review-note" role="status">
                            <ShieldCheck size={20} aria-hidden="true" />
                            Önizlemen hazır. İndirme ve paylaşım için yetkili
                            başka bir incelemeci son kontrolleri tamamlamalı.{" "}
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
                        {(
                          ["failed", "cancelled", "rejected"] as string[]
                        ).includes(job.state) && (
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
                                setStep(3);
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
                          <button className="subtle" onClick={() => setStep(2)}>
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
                              Bağlantı 1 saat geçerli. Yalnız bu makinede
                              açılır; sosyal medyaya gönderilmedi.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
            </div>
            <StudioPreviewRail
              product={product}
              styleId={cameraStyle}
              job={job}
              preview={preview}
              property={draft?.property ?? null}
              assets={draft?.assets ?? []}
              thumbnails={thumbs}
              aspect={EXPORT_PRESETS[preset].aspect}
            />
          </div>
        </>
      ) : (
        <section className="ux-workbench">
          <div className="ux-section-heading">
            <div>
              <span className="ux-kicker">ÇALIŞMALARIN</span>
              <h1>{view === "projects" ? "Projelerim" : "Medya Arşivi"}</h1>
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
            {workspace?.properties.map((p) => (
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
                  onClick={() =>
                    void run(async () => {
                      await openProject(p.id, workspace);
                      if (view === "archive") setStep(2);
                    })
                  }
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
      <details className="ux-property-details">
        <summary>Gizlilik ve demo ölçümü</summary>
        <label className="ux-checkbox">
          <input
            type="checkbox"
            checked={funnelEnabled}
            onChange={(e) => consentFunnel(e.target.checked)}
          />
          <span>
            Yalnız bu sekmede anonim demo adım sayılarını ölçmeyi kabul ediyorum
            (isteğe bağlı).
          </span>
        </label>
        <p>
          Dosya adı, mülk bilgisi, kişi bilgisi veya ses kaydedilmez; sayılar
          sunucuya gönderilmez. İzni kapatınca veya sayfayı yenileyince silinir.
          Satış ve gerçek dönüşüm kanıtı değildir.
        </p>
        <output aria-label="Yerel demo adım sayısı">
          {funnelSnapshot.total} yerel adım
        </output>
      </details>
      <details className="ux-developer">
        <summary>Yerel demo ve gelişmiş araçlar</summary>
        <p>
          Opt-in UX sayıları yalnız bu sekmeye aittir; sunucu/CRM dönüşümü
          değildir.
        </p>
        <pre aria-label="Yerel sentetik huni özeti">
          {JSON.stringify(funnelSnapshot, null, 2)}
        </pre>

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
