"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  canMove,
  roomAt,
  validateViewerCommand,
  type DaypartState,
  type Position,
  type Scene,
  type ViewerAction,
} from "@/domain/platform";

export interface SceneController {
  cancelNavigation(): void;
  execute(command: ViewerAction): Promise<{ completed: true; roomId: string }>;
  currentRoom(): string;
}
interface SceneProps {
  scene: Scene;
  modelUrl?: string;
  onRoom?: (id: string) => void;
  onDaypart?: (value: DaypartState) => void;
  onTool?: (accepted: boolean) => void;
}
type Engine = {
  camera: THREE.PerspectiveCamera;
  yaw: number;
  pitch: number;
  position: Position;
  currentRoom: string;
  daypart: DaypartState;
  route: Position[];
  resolveRoute: ((value: { completed: true; roomId: string }) => void) | null;
  rejectRoute: ((reason: Error) => void) | null;
  marker: THREE.Mesh;
  ambient: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  scene: THREE.Scene;
  beam: THREE.Mesh;
  dust: THREE.Points;
  keys: Set<string>;
};
const daypartLabels: Record<DaypartState, string> = {
  morning: "Sabah",
  noon: "Öğle",
  evening: "Akşam",
  night: "Gece",
};

/** Fixed geometry from an E2 manifest. No model-generated code, external assets or unknown rooms. */
function addGeometry(world: THREE.Scene, scene: Scene) {
  const wall = new THREE.MeshStandardMaterial({
    color: "#c4c0b6",
    roughness: 0.86,
  });
  const walls = new Set<string>();
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.MeshStandardMaterial,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    world.add(mesh);
  };
  for (const room of scene.rooms.filter((r) => r.truth === "E2")) {
    const floor = new THREE.MeshStandardMaterial({
      color: room.material === "stone" ? "#9d9e99" : "#ab8c64",
      roughness: room.material === "stone" ? 0.3 : 0.65,
      metalness: 0.04,
    });
    box(
      room.width,
      0.12,
      room.depth,
      room.x + room.width / 2,
      -0.06,
      room.z + room.depth / 2,
      floor,
    );
    for (const [axis, at, low, high] of [
      ["x", room.x, room.z, room.z + room.depth],
      ["x", room.x + room.width, room.z, room.z + room.depth],
      ["z", room.z, room.x, room.x + room.width],
      ["z", room.z + room.depth, room.x, room.x + room.width],
    ] as const) {
      const key = [axis, at, low, high].join(":");
      if (walls.has(key)) continue;
      walls.add(key);
      const doors = scene.doors
        .filter(
          (d) =>
            d.axis === axis &&
            d.at === at &&
            (d.from === room.id || d.to === room.id),
        )
        .sort((a, b) => a.center - b.center);
      let cursor = low;
      const segment = (
        start: number,
        end: number,
        height: number,
        bottom: number,
      ) => {
        if (end <= start) return;
        box(
          axis === "x" ? 0.12 : end - start,
          height,
          axis === "x" ? end - start : 0.12,
          axis === "x" ? at : (start + end) / 2,
          bottom + height / 2,
          axis === "x" ? (start + end) / 2 : at,
          wall,
        );
      };
      for (const door of doors) {
        const start = door.center - door.width / 2,
          end = door.center + door.width / 2;
        segment(cursor, start, room.height, 0);
        segment(start, end, room.height - 2.2, 2.2);
        cursor = end;
      }
      segment(cursor, high, room.height, 0);
    }
  }
}

export const SceneViewer = forwardRef<SceneController, SceneProps>(
  function SceneViewer({ scene, modelUrl, onRoom, onDaypart, onTool }, ref) {
    const host = useRef<HTMLDivElement>(null),
      engine = useRef<Engine | null>(null);
    const callbacks = useRef({ onRoom, onDaypart, onTool });
    const daypartValue = useRef<DaypartState>("noon");
    const preservedView = useRef<{
      scope: string;
      position: Position;
      yaw: number;
      pitch: number;
    } | null>(null);
    const [quality, setQuality] = useState<"balanced" | "low">(() =>
        typeof window !== "undefined" && window.innerWidth < 760
          ? "low"
          : "balanced",
      ),
      [status, setStatus] = useState("3D motoru yükleniyor"),
      [fps, setFps] = useState<number | null>(null),
      [room, setRoom] = useState(
        scene.rooms[0]?.label ?? "Doğrulanmış oda yok",
      ),
      [daypart, setDaypart] = useState<DaypartState>("noon"),
      [fact, setFact] = useState<string | null>(null);
    useEffect(() => {
      callbacks.current = { onRoom, onDaypart, onTool };
    }, [onRoom, onDaypart, onTool]);
    const applyDaypart = useCallback(
      (value: DaypartState, active: Engine, notify = true) => {
        daypartValue.current = value;
        active.daypart = value;
        const night = value === "night",
          evening = value === "evening";
        active.sun.intensity = night ? 0.12 : evening ? 2.5 : 3.5;
        active.sun.color.set(
          evening ? "#ffb56a" : night ? "#7190bb" : "#fff6dc",
        );
        active.sun.position.set(
          value === "morning" ? -3 : 8,
          evening ? 4 : 10,
          4,
        );
        active.ambient.intensity = night ? 0.45 : 1.6;
        active.scene.background = new THREE.Color(
          night ? "#111b2b" : evening ? "#837265" : "#c1c9c8",
        );
        active.beam.visible = !night && quality !== "low";
        active.dust.visible =
          !night &&
          quality !== "low" &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        setDaypart(value);
        if (notify) callbacks.current.onDaypart?.(value);
      },
      [quality],
    );
    useImperativeHandle(
      ref,
      () => ({
        cancelNavigation: () => {
          const active = engine.current;
          if (active) {
            active.route = [];
            active.keys.clear();
            active.rejectRoute?.(new Error("USER_STOPPED"));
            active.resolveRoute = null;
            active.rejectRoute = null;
          }
        },
        currentRoom: () =>
          engine.current?.currentRoom ?? scene.rooms[0]?.id ?? "",
        async execute(input) {
          const active = engine.current;
          if (!active) throw new Error("VIEWER_NOT_READY");
          try {
            const { command, route } = validateViewerCommand(
              scene,
              input,
              active.currentRoom,
            );
            if (command.type === "focus_room") {
              host.current?.scrollIntoView({
                block: "center",
                behavior: "auto",
              });
              active.rejectRoute?.(new Error("ROUTE_SUPERSEDED"));
              active.route = route;
              return await new Promise<{ completed: true; roomId: string }>(
                (resolve, reject) => {
                  active.resolveRoute = resolve;
                  active.rejectRoute = reject;
                },
              );
            }
            if (command.type === "set_daypart")
              applyDaypart(command.daypart, active);
            if (command.type === "highlight_feature") {
              const poi = scene.pois.find((p) => p.id === command.poiId)!;
              active.marker.position.set(poi.x, 0.04, poi.z);
              active.marker.visible = true;
              setFact(poi.label);
            }
            if (command.type === "show_property_fact") {
              const entry = scene.facts.find((f) => f.id === command.factId)!;
              setFact(`${entry.label}: ${entry.value} (${entry.truth})`);
            }
            if (command.type === "reset_view") {
              active.rejectRoute?.(new Error("ROUTE_RESET"));
              active.route = [];
              const first = scene.rooms.find((r) => r.truth === "E2")!;
              active.position = [
                first.x + first.width / 2,
                first.z + first.depth / 2,
              ];
              active.currentRoom = first.id;
              setRoom(first.label);
              callbacks.current.onRoom?.(first.id);
              active.yaw = Math.PI;
              active.pitch = 0;
              active.marker.visible = false;
            }
            callbacks.current.onTool?.(true);
            return { completed: true, roomId: active.currentRoom };
          } catch (error) {
            callbacks.current.onTool?.(false);
            throw error;
          }
        },
      }),
      [scene, applyDaypart],
    );

    useEffect(() => {
      const element = host.current;
      if (!element) return;
      let disposed = false,
        frame = 0;
      let renderer: THREE.WebGLRenderer | null = null,
        world: THREE.Scene | null = null,
        observer: ResizeObserver | null = null,
        environment: THREE.WebGLRenderTarget | null = null;
      const keys = new Set<string>();
      let pointer: { x: number; y: number } | null = null;
      const keyDown = (event: KeyboardEvent) => {
        if (
          event.target instanceof HTMLElement &&
          /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName)
        )
          return;
        if (/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(event.code)) {
          event.preventDefault();
          keys.add(event.code);
        }
      };
      const keyUp = (event: KeyboardEvent) => keys.delete(event.code);
      const blur = () => keys.clear();
      const down = (event: PointerEvent) => {
        pointer = { x: event.clientX, y: event.clientY };
        element.setPointerCapture(event.pointerId);
        element.focus();
      };
      const move = (event: PointerEvent) => {
        const active = engine.current;
        if (pointer && active) {
          active.yaw -= (event.clientX - pointer.x) * 0.004;
          active.pitch = THREE.MathUtils.clamp(
            active.pitch - (event.clientY - pointer.y) * 0.004,
            -1.2,
            1.2,
          );
          pointer = { x: event.clientX, y: event.clientY };
        }
      };
      const up = () => {
        pointer = null;
      };
      const lost = (event: Event) => {
        event.preventDefault();
        setStatus(
          "WebGL bağlantısı kesildi. Kaliteyi değiştirerek yeniden yükleyin.",
        );
      };
      void Promise.resolve().then(() => {
        if (disposed) return;
        try {
          const first = scene.rooms.find((r) => r.truth === "E2");
          if (!first) throw new Error("Doğrulanmış geometri yok");
          renderer = new THREE.WebGLRenderer({
            antialias: quality === "balanced",
            powerPreference: "low-power",
          });
          renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, quality === "low" ? 1 : 1.5),
          );
          renderer.shadowMap.enabled = quality === "balanced";
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.1;
          element.appendChild(renderer.domElement);
          world = new THREE.Scene();
          world.background = new THREE.Color("#c1c9c8");
          const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 150);
          camera.rotation.order = "YXZ";
          const ambient = new THREE.HemisphereLight("#e5efff", "#756048", 1.6),
            sun = new THREE.DirectionalLight("#fff6dc", 3.5);
          sun.position.set(8, 10, 4);
          sun.castShadow = true;
          sun.shadow.mapSize.set(1024, 1024);
          sun.shadow.camera.left = -12;
          sun.shadow.camera.right = 12;
          sun.shadow.camera.top = 12;
          sun.shadow.camera.bottom = -12;
          world.add(ambient, sun);
          if (quality === "balanced") {
            const pmrem = new THREE.PMREMGenerator(renderer);
            const roomEnvironment = new RoomEnvironment();
            environment = pmrem.fromScene(roomEnvironment);
            world.environment = environment.texture;
            roomEnvironment.dispose();
            pmrem.dispose();
          }
          if (modelUrl)
            new GLTFLoader().load(
              modelUrl,
              (gltf) => {
                if (disposed || !world) return;
                gltf.scene.traverse((object) => {
                  if (object instanceof THREE.Mesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                  }
                });
                world.add(gltf.scene);
                setStatus("Blender mesh · serbest gezinme hazır");
              },
              undefined,
              () => setStatus("GLB yüklenemedi; çıktıyı yeniden açın"),
            );
          else {
            addGeometry(world, scene);
            setStatus(
              "Ölçülü manifest mesh önizlemesi · serbest gezinme hazır",
            );
          }
          const marker = new THREE.Mesh(
            new THREE.RingGeometry(0.18, 0.3, 32),
            new THREE.MeshBasicMaterial({
              color: "#d4ee8c",
              side: THREE.DoubleSide,
            }),
          );
          marker.rotation.x = -Math.PI / 2;
          marker.visible = false;
          world.add(marker);
          const beam = new THREE.Mesh(
            new THREE.ConeGeometry(0.8, 3.2, 12, 1, true),
            new THREE.MeshBasicMaterial({
              color: "#ffe4a2",
              transparent: true,
              opacity: 0.035,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          );
          beam.position.set(2, 1.6, 2);
          beam.visible = quality !== "low";
          world.add(beam);
          const dustGeometry = new THREE.BufferGeometry(),
            dustVertices: number[] = [];
          for (let i = 0; i < 65; i++)
            dustVertices.push(
              1.3 + ((i * 37) % 97) / 70,
              ((i * 31) % 89) / 30,
              1.3 + ((i * 29) % 83) / 60,
            );
          dustGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(dustVertices, 3),
          );
          const dust = new THREE.Points(
            dustGeometry,
            new THREE.PointsMaterial({
              size: 0.016,
              color: "#fff1be",
              transparent: true,
              opacity: 0.5,
              depthWrite: false,
            }),
          );
          dust.visible =
            quality !== "low" &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          world.add(dust);
          const scope = [
            scene.organizationId,
            scene.propertyId,
            scene.revision,
          ].join(":");
          const saved = preservedView.current,
            restorable =
              saved?.scope === scope && roomAt(scene, saved.position);
          const position: Position =
            restorable && saved
              ? [...saved.position]
              : [first.x + first.width / 2, first.z + first.depth / 2];
          const current = roomAt(scene, position)!;
          const active: Engine = {
            camera,
            yaw: restorable && saved ? saved.yaw : Math.PI,
            pitch: restorable && saved ? saved.pitch : 0,
            position,
            currentRoom: current.id,
            daypart: "noon",
            route: [],
            resolveRoute: null,
            rejectRoute: null,
            marker,
            ambient,
            sun,
            scene: world,
            beam,
            dust,
            keys,
          };
          engine.current = active;
          setRoom(current.label);
          setFact(null);
          element.dataset["quality"] = quality;
          applyDaypart(daypartValue.current, active, false);
          const resize = () => {
            if (!renderer) return;
            const width = Math.max(1, element.clientWidth),
              height = Math.max(1, element.clientHeight);
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
          };
          observer = new ResizeObserver(resize);
          observer.observe(element);
          resize();
          window.addEventListener("keydown", keyDown);
          window.addEventListener("keyup", keyUp);
          window.addEventListener("blur", blur);
          element.addEventListener("pointerdown", down);
          element.addEventListener("pointermove", move);
          element.addEventListener("pointerup", up);
          element.addEventListener("pointercancel", up);
          renderer.domElement.addEventListener("webglcontextlost", lost);
          let last = performance.now(),
            fpsStart = last,
            frames = 0;
          const tick = (now: number) => {
            if (disposed || !renderer || !world) return;
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            frames++;
            let dx = 0,
              dz = 0;
            const goal = active.route[0];
            if (goal) {
              const distance = Math.hypot(
                goal[0] - active.position[0],
                goal[1] - active.position[1],
              );
              if (distance < 0.06) active.route.shift();
              else {
                dx = ((goal[0] - active.position[0]) / distance) * dt * 1.4;
                dz = ((goal[1] - active.position[1]) / distance) * dt * 1.4;
                active.yaw = Math.atan2(-dx, -dz);
              }
            } else {
              const forward =
                Number(keys.has("KeyW") || keys.has("ArrowUp")) -
                Number(keys.has("KeyS") || keys.has("ArrowDown"));
              const sideways =
                Number(keys.has("KeyD") || keys.has("ArrowRight")) -
                Number(keys.has("KeyA") || keys.has("ArrowLeft"));
              dx =
                (-Math.sin(active.yaw) * forward +
                  Math.cos(active.yaw) * sideways) *
                dt *
                1.8;
              dz =
                (-Math.cos(active.yaw) * forward -
                  Math.sin(active.yaw) * sideways) *
                dt *
                1.8;
              if (active.resolveRoute) {
                active.resolveRoute({
                  completed: true,
                  roomId: active.currentRoom,
                });
                active.resolveRoute = null;
                active.rejectRoute = null;
                callbacks.current.onTool?.(true);
              }
            }
            const end: Position = [
              active.position[0] + dx,
              active.position[1] + dz,
            ];
            if (canMove(scene, active.position, end)) active.position = end;
            else if (goal) {
              active.route = [];
              active.rejectRoute?.(new Error("COLLISION_ROUTE_REJECTED"));
              active.resolveRoute = null;
              active.rejectRoute = null;
              callbacks.current.onTool?.(false);
            }
            const current = roomAt(scene, active.position);
            if (current && current.id !== active.currentRoom) {
              active.currentRoom = current.id;
              setRoom(current.label);
              callbacks.current.onRoom?.(current.id);
            }
            camera.position.set(active.position[0], 1.65, active.position[1]);
            camera.rotation.set(active.pitch, active.yaw, 0);
            renderer.render(world, camera);
            element.dataset["room"] = active.currentRoom;
            element.dataset["position"] = active.position
              .map((x) => x.toFixed(2))
              .join(",");
            element.dataset["ready"] = "true";
            if (now - fpsStart > 2000) {
              const measuredFps =
                Math.round((frames * 10000) / (now - fpsStart)) / 10;
              setFps(measuredFps);
              element.dataset["fps"] = String(measuredFps);
              element.dataset["fpsSampleAt"] = String(now);
              frames = 0;
              fpsStart = now;
            }
            frame = requestAnimationFrame(tick);
          };
          frame = requestAnimationFrame(tick);
        } catch {
          setStatus(
            "WebGL kullanılamıyor. Bu cihazda 3D doğrulanmadı; başka tarayıcı deneyin.",
          );
        }
      });
      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        engine.current?.rejectRoute?.(new Error("VIEWER_UNMOUNTED"));
        const active = engine.current;
        if (active)
          preservedView.current = {
            scope: [
              scene.organizationId,
              scene.propertyId,
              scene.revision,
            ].join(":"),
            position: [...active.position],
            yaw: active.yaw,
            pitch: active.pitch,
          };
        engine.current = null;
        delete element.dataset["ready"];
        delete element.dataset["fpsSampleAt"];
        observer?.disconnect();
        window.removeEventListener("keydown", keyDown);
        window.removeEventListener("keyup", keyUp);
        window.removeEventListener("blur", blur);
        element.removeEventListener("pointerdown", down);
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerup", up);
        element.removeEventListener("pointercancel", up);
        if (renderer) {
          renderer.domElement.removeEventListener("webglcontextlost", lost);
          renderer.dispose();
          renderer.domElement.remove();
        }
        world?.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            materials.forEach((m) => m.dispose());
          }
        });
        environment?.dispose();
      };
    }, [scene, modelUrl, quality, applyDaypart]);

    function command(value: ViewerAction) {
      const active = engine.current;
      if (!active) return;
      try {
        const validated = validateViewerCommand(
          scene,
          value,
          active.currentRoom,
        );
        if (value.type === "set_daypart") applyDaypart(value.daypart, active);
        if (value.type === "focus_room") active.route = validated.route;
        callbacks.current.onTool?.(true);
      } catch {
        callbacks.current.onTool?.(false);
      }
    }
    return (
      <section
        className="scene-viewer"
        aria-label="Serbest gezilen sentetik 3D mülk"
      >
        <div
          className="scene-canvas"
          ref={host}
          tabIndex={0}
          role="application"
          aria-label="3D gezinme alanı. WASD veya ok tuşlarıyla yürü, sürükleyerek bak."
        />
        <div className="scene-hud">
          <span>{room} · 1,65 m göz hizası</span>
          <span>
            {fps === null ? "FPS ölçülüyor" : `${fps} FPS · bu cihaz`}
          </span>
        </div>
        <div className="scene-controls">
          <label>
            Görünüm
            <select
              aria-label="Günün zamanı"
              value={daypart}
              onChange={(e) =>
                command({
                  type: "set_daypart",
                  daypart: e.target.value as DaypartState,
                })
              }
            >
              {scene.dayparts.map((d) => (
                <option key={d} value={d}>
                  {daypartLabels[d]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kalite
            <select
              aria-label="3D kalite"
              value={quality}
              onChange={(e) => setQuality(e.target.value as typeof quality)}
            >
              <option value="balanced">Dengeli · gölge/ışık huzmesi</option>
              <option value="low">
                Hafif · yansıma/gölge/huzme/toz kapalı
              </option>
            </select>
          </label>
          <label>
            Oda rotası
            <select
              aria-label="Odaya git"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value)
                  command({ type: "focus_room", roomId: e.target.value });
              }}
            >
              <option value="">Seçin</option>
              {scene.rooms
                .filter((r) => r.truth === "E2")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="scene-touch" aria-label="Dokunmatik hareket">
          <button
            aria-label="İleri yürü"
            onPointerDown={() => engine.current?.keys.add("KeyW")}
            onPointerUp={() => engine.current?.keys.delete("KeyW")}
            onPointerCancel={() => engine.current?.keys.clear()}
            onPointerLeave={() => engine.current?.keys.clear()}
          >
            ↑
          </button>
          <button
            aria-label="Sola yürü"
            onPointerDown={() => engine.current?.keys.add("KeyA")}
            onPointerUp={() => engine.current?.keys.delete("KeyA")}
            onPointerCancel={() => engine.current?.keys.clear()}
            onPointerLeave={() => engine.current?.keys.clear()}
          >
            ←
          </button>
          <button
            aria-label="Geri yürü"
            onPointerDown={() => engine.current?.keys.add("KeyS")}
            onPointerUp={() => engine.current?.keys.delete("KeyS")}
            onPointerCancel={() => engine.current?.keys.clear()}
            onPointerLeave={() => engine.current?.keys.clear()}
          >
            ↓
          </button>
          <button
            aria-label="Sağa yürü"
            onPointerDown={() => engine.current?.keys.add("KeyD")}
            onPointerUp={() => engine.current?.keys.delete("KeyD")}
            onPointerCancel={() => engine.current?.keys.clear()}
            onPointerLeave={() => engine.current?.keys.clear()}
          >
            →
          </button>
        </div>
        <p role="status">{status}</p>
        {fact && <p className="spaces-notice">{fact}</p>}
        <p className="spaces-muted">
          WASD / oklar · sürükle ve bak · dokunmatik yön tuşları. Ölçülü
          sentetik plan, açık çatı kesiti. Yansımalar çevre haritasından; ışık
          huzmesi/toz yaklaşık efekt. Gerçek güneş, dış manzara veya hacimsel
          fizik doğrulaması değildir.
        </p>
      </section>
    );
  },
);
