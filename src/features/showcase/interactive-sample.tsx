"use client";
import { lazy, Suspense, useRef, useState } from "react";
import source from "../../../fixtures/golden-v5/source.json";
import type { GoldenPlan } from "../../domain/golden-property";
import { sampleAsset, showcaseMedia } from "./media";
const SceneViewer = lazy(() =>
  import("../platform/scene-viewer").then((m) => ({ default: m.SceneViewer })),
);
const PanoramaViewer = lazy(() =>
  import("./panorama-viewer").then((m) => ({ default: m.PanoramaViewer })),
);
const plan = source as unknown as GoldenPlan;
const camera = plan.cameras.find((c) => c.id === "camera-entrance")!;
const initialYaw = Math.atan2(
  camera.position[0] - camera.target[0],
  camera.position[2] - camera.target[2],
);
export function InteractiveSample({ kind }: { kind: "ai-3d" | "tour-360" }) {
  const [active, setActive] = useState(false),
    [error, setError] = useState(""),
    host = useRef<HTMLDivElement>(null);
  const asset = sampleAsset(
    kind === "ai-3d" ? showcaseMedia.modelId : showcaseMedia.panoramaId,
  );
  if (!asset)
    return (
      <p role="alert">Bu hizmet için doğrulanmış örnek henüz hazır değil.</p>
    );
  return (
    <div className="sc-interactive" ref={host}>
      {!active ? (
        <div className="sc-tour-poster">
          <img
            src={kind === "ai-3d" ? "/golden-v5/living.png" : asset.url}
            width="640"
            height="360"
            loading="lazy"
            alt={
              kind === "ai-3d"
                ? "Örnek mülkün salonu; sentetik 3D tasarım"
                : "Sentetik salonun equirectangular panorama kaynağı"
            }
          />
          <button
            type="button"
            className="ux-primary"
            onClick={() => setActive(true)}
          >
            {kind === "ai-3d" ? "3D örneğini başlat" : "360° örneğini başlat"}
          </button>
        </div>
      ) : (
        <Suspense fallback={<p role="status">Etkileşimli örnek yükleniyor…</p>}>
          {kind === "ai-3d" ? (
            <SceneViewer
              scene={(source as unknown as GoldenPlan).scene}
              modelUrl={asset.url}
              initialQuality="low"
              initialYaw={initialYaw}
            />
          ) : (
            <PanoramaViewer asset={asset} />
          )}
        </Suspense>
      )}
      <div className="sc-viewer-toolbar">
        <span>
          {kind === "ai-3d"
            ? "Sentetik ölçülü tasarım · gerçek konut değil"
            : "Sentetik 2:1 panorama · gerçek konut değil"}
        </span>
        {active && (
          <>
            <button
              type="button"
              className="subtle"
              onClick={() => {
                setActive(false);
                setError("");
              }}
            >
              Örneği kapat
            </button>
            <button
              type="button"
              className="subtle"
              onClick={() => {
                if (!host.current?.requestFullscreen) {
                  setError(
                    "Bu tarayıcı tam ekranı desteklemiyor. Sayfa içinde gezinebilirsin.",
                  );
                  return;
                }
                void host.current
                  .requestFullscreen()
                  .catch(() =>
                    setError(
                      "Tam ekran açılamadı. Sayfa içinde gezinebilirsin.",
                    ),
                  );
              }}
            >
              Tam ekran
            </button>
          </>
        )}
      </div>
      {error && <p role="status">{error}</p>}
    </div>
  );
}
