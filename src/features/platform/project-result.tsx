"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { JobView, PropertyView } from "../../contracts/platform-ui";
import { api, localRequest, saveBlob } from "./client";
import {
  canRequestFinal,
  CUSTOMER_JOB_LABELS,
} from "../../domain/customer-project";
const Viewer = dynamic(
  () => import("./scene-viewer").then((m) => m.SceneViewer),
  { ssr: false, loading: () => <p role="status">3D görünümü yükleniyor…</p> },
);
export function ProjectResult({ id }: { id: string }) {
  const [job, setJob] = useState<JobView | null>(null),
    [property, setProperty] = useState<PropertyView | null>(null),
    [sourceUrl, setSourceUrl] = useState(""),
    [previewState, setPreviewState] = useState<{
      key: string;
      url: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [share, setShare] = useState("");
  const readLock = useRef(false),
    actionLock = useRef(false);
  useEffect(() => {
    let active = true;
    readLock.current = false;
    async function refresh() {
      if (readLock.current) return;
      readLock.current = true;
      try {
        let j = await api<JobView>(`/jobs/${id}`);
        if (j.providerRun?.canAdvance) {
          try {
            await api(`/jobs/${id}/v01-poll`, {});
            j = await api<JobView>(`/jobs/${id}`);
          } catch {
            /* Durable run stays visible; never submit again after uncertain acceptance. */
          }
        }
        const p = await api<{ property: PropertyView }>(
          `/properties/${j.property_id}`,
        );
        if (active) {
          setJob(j);
          setProperty(p.property);
          setError("");
        }
      } catch {
        if (active) {
          setJob(null);
          setProperty(null);
          setPreviewState(null);
          setShare("");
          setError(
            "Proje açılamadı veya bu çalışma için erişimin yok. Hesabını kontrol ederek yeniden dene.",
          );
        }
      } finally {
        readLock.current = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 1800);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);
  const sourceAssetId = job?.providerRun?.sourceAssetId;
  useEffect(() => {
    let active = true,
      url = "";
    if (sourceAssetId)
      void api<{ token: string }>(`/assets/${sourceAssetId}/grant`, {})
        .then((g) =>
          localRequest(`/assets/${sourceAssetId}`, {
            headers: { "x-spaces-grant": g.token },
          }),
        )
        .then((r) => r.blob())
        .then((blob) => {
          if (active) {
            url = URL.createObjectURL(blob);
            setSourceUrl(url);
          }
        })
        .catch(() => {
          if (active) setSourceUrl("");
        });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [sourceAssetId, id]);
  const stale = !!job && !!property && job.revision !== property.revision;
  const outputHash = job?.output?.sha256,
    state = job?.state,
    revision = property?.revision;
  useEffect(() => {
    let active = true,
      url = "";
    if (
      stale ||
      !outputHash ||
      !["awaiting-review", "approved"].includes(state ?? "")
    )
      return;
    void api<{ token: string }>(
      `/jobs/${id}/${state === "approved" ? "download-grant" : "preview-grant"}`,
      {},
    )
      .then((g) =>
        localRequest(`/jobs/${id}/output`, {
          headers: { "x-spaces-grant": g.token },
        }),
      )
      .then((r) => r.blob())
      .then((b) => {
        if (active) {
          url = URL.createObjectURL(b);
          setPreviewState({
            key: `${id}:${outputHash}:${state}:${revision}`,
            url,
          });
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Önizleme açılamadı. Kaynaklar veya erişim değişmiş olabilir.",
          );
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, outputHash, state, revision, stale]);
  async function action(kind: "download" | "share") {
    if (
      actionLock.current ||
      !job ||
      !property ||
      !canRequestFinal(job, property.revision)
    )
      return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      if (kind === "download") {
        const g = await api<{ token: string }>(
          `/jobs/${id}/download-grant`,
          {},
        );
        const r = await localRequest(`/jobs/${id}/output`, {
          headers: { "x-spaces-grant": g.token },
        });
        saveBlob(
          await r.blob(),
          `artificagent-spaces.${job.output!.extension}`,
        );
      } else {
        const p = await api<{ token: string }>(`/jobs/${id}/publish`, {});
        setShare(`/tour/${p.token}`);
      }
    } catch {
      setShare("");
      setError(
        "Teslim açılamadı. Bağımsız onay, kaynak sürümü ve erişim yeniden kontrol edilmeli.",
      );
    } finally {
      setBusy(false);
      actionLock.current = false;
    }
  }
  const media =
    previewState?.key === `${id}:${outputHash}:${state}:${revision}`
      ? previewState.url
      : "";
  const allowed =
    !!job && !!property && canRequestFinal(job, property.revision);
  return (
    <section className="v55-result-page">
      <Link href="/spaces">← Çalışmalarına dön</Link>
      <span className="ux-kicker">PROJE SONUCU</span>
      <h1>
        {property?.title ??
          (error ? "Çalışma açılamadı" : "Çalışman yükleniyor")}
      </h1>
      {error && (
        <p role="alert" className="ux-error">
          {error}
        </p>
      )}
      {job && property && (
        <>
          <div className="v55-project-status">
            <span role="status">
              {stale
                ? "Kaynak kontrolü gerekli"
                : CUSTOMER_JOB_LABELS[job.state]}
            </span>
            <span>
              {job.providerRun
                ? job.providerRun.mode === "offline-fixture"
                  ? "Sentetik offline V01 entegrasyon testi · Gerçek fal üretimi değildir"
                  : "İzinli gerçek V01 sağlayıcı testi · Ticari yayın değildir"
                : "Yerel sentetik çalışma · Gerçek AI üretimi kapalı"}
            </span>
          </div>
          {job.providerRun && sourceUrl && (
            <figure>
              <img
                src={sourceUrl}
                width="640"
                height="360"
                alt="Bu V01 isteğine bağlı kaynak fotoğraf"
                style={{ maxWidth: "100%", height: "auto" }}
              />
              <figcaption>
                Bu çalışmanın kaynak fotoğrafı · sürüm {job.revision}
              </figcaption>
            </figure>
          )}
          {stale ? (
            <p className="ux-note">
              Kaynaklar değişti. Eski önizleme ve teslim kullanılamaz; güncel
              kaynaklarla yeni çalışma gerekir.
            </p>
          ) : media && job.output ? (
            <div className="sc-interactive">
              {job.output.extension === "mp4" ? (
                <video
                  className="v55-result-video"
                  src={media}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={
                    job.providerRun
                      ? "V01 özel depoya alınmış doğrulanmış video adayı"
                      : "Projenin gerçek yerel video çıktısı"
                  }
                />
              ) : (
                <Viewer scene={property.manifest} modelUrl={media} />
              )}
            </div>
          ) : (
            <p>
              Önizleme henüz hazır değil. Yalnız gerçek iş durumu gösterilir.
            </p>
          )}
          <p>
            {job.state === "awaiting-review"
              ? "Önizlemen hazır. İndirmeden önce farklı ve yetkili bir incelemeci her sahneyi kontrol etmeli."
              : job.state === "approved" && !stale
                ? "Bağımsız inceleme kaydı mevcut. Offline reviewer hesabı gerçek insan ticari kabulü anlamına gelmez."
                : job.state === "unknown-submission"
                  ? "İstek sonucu kesinleşmedi. Otomatik yeniden üretim veya ücretli yeniden deneme yapılmaz."
                  : "Çalışman kayıtlıdır; bu sayfayı yeniden açarak gerçek durumunu görebilirsin."}
          </p>
          {job.output && (
            <p className="sc-disclosure">
              {job.output.width} × {job.output.height} ·{" "}
              {job.output.durationSeconds?.toFixed(2)} sn ·{" "}
              {job.output.extension.toUpperCase()} · {job.output.qa.disclosure}
            </p>
          )}
          <div className="v55-summary-actions">
            <button
              type="button"
              className="ux-primary"
              disabled={!allowed || busy}
              onClick={() => void action("download")}
            >
              İndir
            </button>
            <button
              type="button"
              className="subtle"
              disabled={!allowed || busy || job.execution_kind === "fal-v01"}
              onClick={() => void action("share")}
            >
              Yerel paylaşım bağlantısı oluştur
            </button>
            <Link href={`/spaces/manage?property=${property.id}`}>
              Yetkili inceleme alanı
            </Link>
          </div>
          {job.execution_kind === "fal-v01" && (
            <p>
              Bu testte public paylaşım kapalıdır. Final indirme farklı yetkili
              reviewer onayından sonra açılır.
            </p>
          )}
          {share && allowed && (
            <p role="status">
              <Link href={share}>Onaylı yerel turu aç</Link> · 1 saatlik yerel
              bağlantı, internet yayını değildir.
            </p>
          )}
          <details className="ux-property-details">
            <summary>Kaynak ve sürüm bilgisi</summary>
            <p>
              Bu çalışmanın kaynak sürümü: {job.revision}. Güncel proje sürümü:{" "}
              {property.revision}. Çıktı SHA256:{" "}
              {job.output?.sha256 ?? "Henüz yok"}.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
