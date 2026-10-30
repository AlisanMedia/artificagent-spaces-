"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "./client";
import type { PropertyView, AssetView } from "@/contracts/platform-ui";
interface Readiness {
  available: boolean;
  resumeJobId?: string | null;
  mode: "offline-fixture" | "fal-live-test" | null;
  durationSeconds: number;
  aspectRatio: string;
  message: string;
}
export function V01Action({
  property,
  source,
  disabled,
}: {
  property: PropertyView;
  source: AssetView | undefined;
  disabled: boolean;
}) {
  const [status, setStatus] = useState<Readiness | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sourceId = source?.id;
  const lock = useRef(false),
    key = useRef("");
  const router = useRouter();
  useEffect(() => {
    let active = true;
    if (sourceId)
      void api<Readiness>(
        `/v01/readiness?propertyId=${encodeURIComponent(property.id)}&revision=${property.revision}&assetId=${encodeURIComponent(sourceId)}`,
      )
        .then((r) => {
          if (active) setStatus(r);
        })
        .catch(() => {
          if (active) setStatus(null);
        });
    return () => {
      active = false;
    };
  }, [property.id, property.revision, sourceId]);
  async function start() {
    if (lock.current || !source || !status?.available || disabled) return;
    lock.current = true;
    setBusy(true);
    setError("");
    key.current ||= crypto.randomUUID();
    try {
      const request = await api<{ id: string }>("/production/requests", {
        propertyId: property.id,
        revision: property.revision,
        serviceId: "V01",
        sourceAssetIds: [source.id],
        options: {
          durationSeconds: status.durationSeconds,
          aspectRatio: status.aspectRatio,
        },
        rights: {
          syntheticOnly: true,
          ownedOrLicensed: true,
          conceptAccepted: false,
        },
        idempotencyKey: key.current,
        maxCostMicroUsd: 0,
      });
      const run = await api<{ jobId: string }>(
        `/production/requests/${request.id}/v01-start`,
        {},
      );
      router.push(`/spaces/projects/${run.jobId}`);
    } catch {
      setError(
        "Aynı kayıt korunuyor. Kaynak, test izni veya iş durumu değişmiş olabilir; yeniden kontrol et. Yeni ücretli istek otomatik gönderilmez.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="studio-note" aria-label="Doğal Tur sağlayıcı testi">
      <h3>Doğal Tur · Sınırlandırılmış sağlayıcı testi</h3>
      <p>
        {status?.message ??
          "Kaynak ve test yetkisi kontrol ediliyor; üretim henüz açık değil."}
      </p>
      <p>
        Tek onaylı fotoğraf · {status?.durationSeconds ?? 4} sn ·{" "}
        {status?.aspectRatio === "9:16" ? "Dikey 9:16" : "Yatay 16:9"} · 1080p
        hedefi. Bu dar testin ayarları yerel kurgu hedefinden ayrıdır. Gerçek
        dosya ölçülür; düşük çözünürlüklü örnek videoyla değiştirilmez. Bağımsız
        inceleme gerekir.
      </p>
      {error && <p role="alert">{error}</p>}
      {status?.resumeJobId && (
        <p>
          <Link href={`/spaces/projects/${status.resumeJobId}`}>
            Kayıtlı V01 çalışmasını aç
          </Link>
        </p>
      )}
      <button
        className="ux-primary"
        disabled={disabled || busy || !status?.available || !source}
        onClick={() => void start()}
      >
        {busy
          ? "İstek kaydediliyor…"
          : status?.mode === "offline-fixture"
            ? "Offline V01 akışını dene"
            : "İzinli V01 testini başlat"}
      </button>
    </section>
  );
}
