"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { SampleAsset } from "../../domain/showcase";

/** Static, approved equirectangular source. Rotation only; this is not a free-walk 3D reconstruction. */
export function PanoramaViewer({ asset }: { asset: SampleAsset }) {
  const host = useRef<HTMLDivElement>(null),
    [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const angles = useRef({ yaw: 0, pitch: 0 });
  const redraw = useRef<() => void>(() => {});
  useEffect(() => {
    if (
      !host.current ||
      asset.type !== "panorama" ||
      asset.projection !== "equirectangular" ||
      asset.width !== 2 * (asset.height ?? 0)
    ) {
      return;
    }
    const container = host.current;
    let disposed = false,
      frame = 0,
      renderer: THREE.WebGLRenderer | null = null,
      texture: THREE.Texture | null = null;
    const world = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(70, 1, 0.1, 20),
      geometry = new THREE.SphereGeometry(10, 48, 32);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    world.add(new THREE.Mesh(geometry, material));
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.domElement.setAttribute(
        "aria-label",
        "Sentetik salonun gerçek 360 derece panorama görünümü",
      );
      container.appendChild(renderer.domElement);
    } catch {
      queueMicrotask(() => {
        if (!disposed) setState("error");
      });
      geometry.dispose();
      material.dispose();
      return;
    }
    const resize = () => {
      const w = container.clientWidth,
        h = container.clientHeight;
      renderer?.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      schedule();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    new THREE.TextureLoader().load(
      asset.url,
      (t) => {
        if (disposed) {
          t.dispose();
          return;
        }
        texture = t;
        t.colorSpace = THREE.SRGBColorSpace;
        material.map = t;
        material.needsUpdate = true;
        container.dataset["ready"] = "true";
        schedule();
        setState("ready");
      },
      undefined,
      () => {
        if (!disposed) {
          setState("error");
          cancelAnimationFrame(frame);
          observer.disconnect();
          renderer?.dispose();
          disposed = true;
        }
      },
    );
    function draw() {
      if (disposed) return;
      const a = angles.current;
      camera.lookAt(
        Math.cos(a.pitch) * Math.sin(a.yaw),
        Math.sin(a.pitch),
        -Math.cos(a.pitch) * Math.cos(a.yaw),
      );
      renderer?.render(world, camera);
      container.dataset["yaw"] = String(a.yaw);
    }
    function schedule() {
      if (disposed || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        draw();
      });
    }
    redraw.current = schedule;
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      redraw.current = () => {};
      observer.disconnect();
      texture?.dispose();
      geometry.dispose();
      material.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
  }, [asset]);
  const drag = useRef<{ x: number; y: number; pointer: number } | null>(null);
  if (
    state === "error" ||
    asset.type !== "panorama" ||
    asset.projection !== "equirectangular" ||
    asset.width !== 2 * (asset.height ?? 0)
  )
    return (
      <p role="alert">
        360° örneği açılamadı. Tarayıcıda WebGL desteğini kontrol edip yeniden
        dene.
      </p>
    );
  return (
    <div className="sc-panorama">
      <div
        ref={host}
        className="sc-panorama-canvas"
        tabIndex={0}
        role="region"
        aria-label="360° salon panoraması; sürükle veya ok tuşlarını kullan"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, pointer: e.pointerId };
          redraw.current();
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.pointer !== e.pointerId) return;
          angles.current.yaw -= (e.clientX - d.x) * 0.006;
          angles.current.pitch = Math.max(
            -1.35,
            Math.min(1.35, angles.current.pitch + (e.clientY - d.y) * 0.006),
          );
          drag.current = { x: e.clientX, y: e.clientY, pointer: e.pointerId };
        }}
        onPointerUp={(e) => {
          drag.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={(e) => {
          if (
            ![
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
            ].includes(e.key)
          )
            return;
          e.preventDefault();
          if (e.key === "Home") angles.current = { yaw: 0, pitch: 0 };
          else if (e.key === "ArrowLeft") angles.current.yaw -= 0.12;
          else if (e.key === "ArrowRight") angles.current.yaw += 0.12;
          else
            angles.current.pitch = Math.max(
              -1.35,
              Math.min(
                1.35,
                angles.current.pitch + (e.key === "ArrowUp" ? 0.12 : -0.12),
              ),
            );
          redraw.current();
        }}
      />
      {state === "loading" && (
        <p role="status" className="sc-loading">
          Panorama yükleniyor…
        </p>
      )}
      <p className="sc-panorama-caption">
        Salon · 360° sentetik panorama · Sabit noktadan etrafına bak. Bu örnekte
        oda geçişi yok.
      </p>
    </div>
  );
}
