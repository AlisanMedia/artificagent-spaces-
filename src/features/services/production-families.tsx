"use client";
import { useState } from "react";
import {
  Armchair,
  Box,
  Eraser,
  Film,
  ImagePlus,
  PaintRoller,
  ScanLine,
  Sun,
  View,
} from "lucide-react";
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
  mediaMode = "playable",
}: {
  onSelect?: (id: ProductionServiceId) => void;
  disabled?: boolean;
  isolated?: boolean;
  mediaMode?: "playable" | "cover";
}) {
  const [concepts, setConcepts] = useState(false);
  const icons = {
    video: Film,
    enhance: ImagePlus,
    furnish: Armchair,
    empty: Box,
    remove: Eraser,
    sky: Sun,
    "tour-360": View,
    renovate: PaintRoller,
    "ai-3d": ScanLine,
  };
  return (
    <section
      className={`pe-families pe-media-${mediaMode}`}
      aria-label="Üretim hizmetleri"
    >
      <div className="pe-family-grid">
        {SERVICE_FAMILIES.filter((f) => !f.concept || concepts)
          .sort((a, b) => Number(!!b.example) - Number(!!a.example))
          .map((f) => {
            const Icon = icons[f.id];
            return (
              <article
                key={f.id}
                aria-label={f.label}
                className={`pe-family pe-family-${f.id} ${f.example ? "has-example" : "is-pending"} ${f.concept ? "pe-concept" : ""}`}
              >
                <header className="pe-family-heading">
                  <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
                  <h3>{f.label}</h3>
                </header>
                {f.example && (
                  <div className="pe-family-media">
                    {f.example === "video" ? (
                      mediaMode === "playable" ? (
                        <VideoExample style="premium" compact />
                      ) : (
                        (() => {
                          const cover = sampleAsset(
                            showcaseMedia.samples.find(
                              (s) => s.style === "premium",
                            )?.posterId ?? "",
                          );
                          return cover ? (
                            <img
                              className="pe-family-poster"
                              src={cover.url}
                              width={cover.width!}
                              height={cover.height!}
                              alt="Oynatılabilen yerel emlak videosunun örnek karesi; canlı AI çıktısı değil"
                              loading="lazy"
                            />
                          ) : (
                            <p>Doğrulanmış kapak hazır değil.</p>
                          );
                        })()
                      )
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
                        <small>
                          Yerel dosya örneği; canlı hizmet sonucu değil.
                        </small>
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
                  </div>
                )}
                <div className="pe-family-copy">
                  <p>{f.benefit}</p>
                  <small>
                    {f.concept
                      ? "Konsept / Deneysel · Canlı üretim kapalı"
                      : "Canlı üretim henüz açık değil"}
                  </small>
                </div>
                <div className="pe-family-actions">
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
                </div>
              </article>
            );
          })}
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
