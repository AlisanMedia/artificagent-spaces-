"use client";
import { useState } from "react";
import { api } from "./client";
export function ProviderReadinessPanel() {
  const [value, setValue] = useState<{
    liveEnabled: false;
    approvedExternalSpendMicroUsd: 0;
    requiredGates: string[];
    video: { provider: string; model: string; enabled: false }[];
    ai3d: { provider: string; model: string; enabled: false };
    tour360: { provider: string; enabled: false };
  } | null>(null);
  const [error, setError] = useState("");
  return (
    <section aria-label="Yönetici sağlayıcı hazırlığı">
      <h3>V5.4 sağlayıcı hazırlığı</h3>
      <button
        className="subtle"
        onClick={() => {
          setError("");
          void api<NonNullable<typeof value>>("/studio/provider-readiness")
            .then(setValue)
            .catch(() =>
              setError(
                "Sağlayıcı hazırlığı okunamadı veya bu hesap yetkili değil.",
              ),
            );
        }}
      >
        Sağlayıcı kilitlerini göster
      </button>
      {error && <p role="alert">{error}</p>}
      {value && (
        <>
          <p>
            Canlı transport: KAPALI · Onaylı harici bütçe: 0 USD · Sağlayıcı
            fiyatı: UNKNOWN
          </p>
          <ul>
            {value.video.map((v) => (
              <li key={v.model}>
                {v.provider} · {v.model} · DISABLED
              </li>
            ))}
            <li>
              {value.ai3d.provider} · {value.ai3d.model} · DISABLED
            </li>
            <li>{value.tour360.provider} · 2:1 panorama · DISABLED</li>
          </ul>
          <p>Gerekli kapılar: {value.requiredGates.join(" / ")}</p>
        </>
      )}
    </section>
  );
}
