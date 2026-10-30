"use client";
import { lazy, Suspense, useState } from "react";
import { api } from "../platform/client";
const Catalog = lazy(() =>
  import("./service-explorer").then((m) => ({ default: m.ServiceExplorer })),
);
export function AdminServiceResearch() {
  const [allowed, setAllowed] = useState(false),
    [error, setError] = useState("");
  return (
    <section
      className="studio-theme pe-admin-research"
      aria-label="Yetkili hizmet araştırması"
    >
      <h3>Hizmet araştırması ve üretim hazırlığı</h3>
      <p>
        75 başlık ürün araştırmasıdır; canlı üretim hizmetleri listesi değildir.
      </p>
      <button
        className="subtle"
        type="button"
        onClick={async () => {
          try {
            await api("/production/readiness");
            setAllowed(true);
          } catch {
            setAllowed(false);
            setError("Bu alan yalnız yönetici hesabına açıktır.");
          }
        }}
      >
        Araştırma kataloğunu aç
      </button>
      {error && <p role="alert">{error}</p>}
      {allowed && (
        <Suspense fallback={<p>Araştırma yükleniyor…</p>}>
          <Catalog />
        </Suspense>
      )}
    </section>
  );
}
