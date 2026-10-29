"use client";
import dynamic from "next/dynamic";
import { Film, ShieldCheck } from "lucide-react";
import type { AssetView, JobView, PropertyView } from "@/contracts/platform-ui";
import type {
  PropertyVideoStyle,
  StudioProduct,
} from "@/domain/real-estate-styles";
import { VideoExample } from "../showcase/video-example";
import { InteractiveSample } from "../showcase/interactive-sample";
const Viewer = dynamic(
  () => import("./scene-viewer").then((m) => m.SceneViewer),
  { ssr: false, loading: () => <p role="status">3D görünümü yükleniyor…</p> },
);
export function StudioPreviewRail({
  product,
  styleId,
  job,
  preview,
  property,
  assets,
  thumbnails,
  aspect,
}: {
  product: StudioProduct;
  styleId: PropertyVideoStyle;
  job: JobView | null;
  preview: string;
  property: PropertyView | null;
  assets: readonly AssetView[];
  thumbnails: Readonly<Record<string, string>>;
  aspect: "16:9" | "9:16";
}) {
  const hasActual = !!preview && !!job?.output;
  return (
    <aside className="v54-preview-rail" aria-label="Medya ve sahne özeti">
      <div className="v54-preview-heading">
        <span className="ux-kicker">MEDYA ALANI</span>
        <span>{hasActual ? "Özel yerel çıktı" : "Hazır sentetik örnek"}</span>
      </div>
      <div
        className={`v54-cinema ${hasActual && job.output?.extension === "glb" ? "v54-cinema-3d" : ""}`}
        data-orientation={aspect === "9:16" ? "portrait" : "landscape"}
      >
        {hasActual && job.output?.extension === "glb" && property ? (
          <Viewer scene={property.manifest} modelUrl={preview} />
        ) : !hasActual ? (
          product === "video" ? (
            <VideoExample
              key={styleId}
              style={styleId}
              compact
              disclose={false}
            />
          ) : (
            <InteractiveSample key={product} kind={product} />
          )
        ) : (
          <video
            key={preview}
            controls
            playsInline
            preload="metadata"
            src={preview}
            aria-label={
              hasActual
                ? "Oluşturulan video önizlemesi"
                : "Hazır sentetik örnek video"
            }
          />
        )}
      </div>
      <p className="v54-media-truth">
        {hasActual
          ? job.output?.qa.disclosure
          : product === "video"
            ? "Bu hazır örnek videodur; seçtiğin dosyadan oluşturulmadı. Gerçek AI video üretimi henüz etkin değil."
            : product === "ai-3d"
              ? "Hazır ölçülü sentetik GLB tasarımı. Gerçek konut rekonstrüksiyonu veya AI sağlayıcı çıktısı değildir."
              : "Hazır sentetik 2:1 panorama. Yerel örnektir; harici tur oluşturulmadı."}
      </p>
      {product !== "video" && !hasActual && (
        <p className="v54-media-kind">
          {product === "ai-3d"
            ? "AI 3D üretimi etkin değil; örnek tasarımda serbestçe gezinebilirsin."
            : "360° üretimi etkin değil; bu tek panorama içinde etrafına bakabilirsin."}
        </p>
      )}
      <div className="v54-scene-heading">
        <h2>
          <Film size={16} aria-hidden="true" />
          Sahne sırası
        </h2>
        <span>{assets.filter((a) => a.kind === "photo").length} fotoğraf</span>
      </div>
      <ol className="v54-scene-strip" aria-label="Kaynak fotoğraf sırası">
        {assets
          .filter((a) => a.kind === "photo")
          .map((asset, i) => (
            <li key={asset.id}>
              {thumbnails[asset.id] ? (
                <img
                  src={thumbnails[asset.id]}
                  alt={`Sahne ${i + 1} kaynağı`}
                />
              ) : (
                <span>Fotoğraf</span>
              )}
              <b>{String(i + 1).padStart(2, "0")}</b>
            </li>
          ))}
      </ol>
      {!assets.some((a) => a.kind === "photo") && (
        <p className="v54-empty-scenes">
          Fotoğraflarını eklediğinde anlatımın sırası burada oluşacak.
        </p>
      )}
      <p className="v54-review-line">
        <ShieldCheck size={17} aria-hidden="true" />
        İndirmeden önce bağımsız inceleme.
      </p>
    </aside>
  );
}
