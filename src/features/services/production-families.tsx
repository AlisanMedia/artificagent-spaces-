"use client";
import { useState } from "react";
import { sampleAsset, showcaseMedia } from "../showcase/media";
import { VideoExample } from "../showcase/video-example";
import {
  SERVICE_FAMILIES,
  type ProductionServiceId,
} from "@/domain/production-services";

export function ProductionFamilyCards({
  onSelect,
  disabled = false,
  isolated = false,
}: {
  onSelect?: (id: ProductionServiceId) => void;
  disabled?: boolean;
  isolated?: boolean;
}) {
  const [concepts, setConcepts] = useState(false);
  return (
    <section className="pe-families" aria-label="Üretim hizmetleri">
      <div className="pe-family-grid">
        {SERVICE_FAMILIES.filter((f) => !f.concept || concepts).map((f) => (
          <article
            key={f.id}
            aria-label={f.label}
            className={f.concept ? "pe-concept" : ""}
          >
            {f.example === "video" ? (
              <VideoExample style="premium" compact />
            ) : f.example === "photo-local" ? (
              <div className="pe-local-pair">
                {[
                  showcaseMedia.comparison.beforeId,
                  showcaseMedia.comparison.afterId,
                ].map((id, i) => {
                  const a = sampleAsset(id);
                  return a ? (
                    <figure key={id}>
                      <img
                        src={a.url}
                        width={a.width!}
                        height={a.height!}
                        loading="lazy"
                        alt={
                          i === 0
                            ? "Aynı kamera açısındaki sentetik kaynak"
                            : "Aynı kaynağın yerel ton ve netlik düzenlemesi"
                        }
                      />
                      <figcaption>
                        {i === 0 ? "Kaynak" : "Yerel düzenleme"}
                      </figcaption>
                    </figure>
                  ) : null;
                })}
                <small>Yerel dosya örneği; canlı hizmet sonucu değil.</small>
              </div>
            ) : f.example ? (
              (() => {
                const a = sampleAsset(
                  f.example === "tour-360"
                    ? (showcaseMedia.panoramaPosterId ??
                        showcaseMedia.panoramaId)
                    : (showcaseMedia.modelPosterId ?? "living-source"),
                );
                return a ? (
                  <img
                    className="pe-family-poster"
                    src={a.url}
                    width={a.width!}
                    height={a.height!}
                    loading="lazy"
                    alt={
                      f.example === "tour-360"
                        ? "Gezilebilir lisanslı panorama örneğinin görünümü"
                        : "Açılabilen sentetik modelin görünümü; gerçek mülk değil"
                    }
                  />
                ) : (
                  <p>Doğrulanmış kapak hazır değil.</p>
                );
              })()
            ) : null}
            <span className="pe-service-mark" aria-hidden="true">
              {f.id === "video"
                ? "▶"
                : f.id === "tour-360"
                  ? "360°"
                  : f.concept
                    ? "◇"
                    : "▧"}
            </span>
            <h3>{f.label}</h3>
            <p>{f.benefit}</p>
            <small>
              {f.concept
                ? "Konsept / Deneysel · Canlı üretim kapalı"
                : "Canlı üretim henüz açık değil"}
            </small>
            {isolated ? (
              <p className="pe-example-pending">
                Bu statik gösterimde istek oluşturulamaz.
              </p>
            ) : onSelect ? (
              <button
                className="subtle"
                type="button"
                disabled={disabled}
                onClick={() => onSelect(f.serviceId)}
              >
                Tercihleri hazırla
                <span className="studio-sr-only">: {f.label}</span>
              </button>
            ) : (
              <a
                className="subtle"
                href={`/spaces?productionService=${f.serviceId}`}
              >
                Tercihleri hazırla
                <span className="studio-sr-only">: {f.label}</span>
              </a>
            )}
            {f.example ? (
              <a
                href={
                  f.example === "photo-local"
                    ? "#foto-ornek"
                    : `${isolated ? "/showcase/" : "/spaces/showcase"}?product=${f.example}#ornekler`
                }
              >
                Mevcut yerel örneği gör
              </a>
            ) : (
              <p className="pe-example-pending">
                Doğrulanmış hizmet sonucu henüz yok.
              </p>
            )}
          </article>
        ))}
      </div>
      <button
        className="subtle"
        type="button"
        aria-expanded={concepts}
        onClick={() => setConcepts((x) => !x)}
      >
        {concepts
          ? "Konsept seçeneklerini gizle"
          : "Konsept ve deneysel seçenekler"}
      </button>
      <p className="ux-small">
        Hazır videolar yerel kurgudur. Fotoğraf düzenleme için gösterilen yerel
        örnek, canlı AI hizmetinin sonucu veya kalite garantisi değildir.
      </p>
    </section>
  );
}
