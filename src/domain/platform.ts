import { z } from "zod";

export const Id = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
export const Truth = z.enum(["E0", "E1", "E2"]);
export const Role = z.enum(["admin", "editor", "viewer", "reviewer"]);
export type PlatformRole = z.infer<typeof Role>;
export const Mode = z.enum(["pov", "cinematic", "hybrid", "interactive-3d"]);
export const Daypart = z.enum(["morning", "noon", "evening", "night"]);
export type DaypartState = z.infer<typeof Daypart>;
export const safeLabel = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(
    (s) => !/[<>]/.test(s) && !Array.from(s).some((c) => c.charCodeAt(0) < 32),
    "Kontrol karakteri/HTML kabul edilmez",
  );
export const Point = z.tuple([z.number().finite(), z.number().finite()]);
export const Room = z
  .object({
    id: Id,
    label: safeLabel,
    x: z.number().min(-100).max(100),
    z: z.number().min(-100).max(100),
    width: z.number().min(1).max(40),
    depth: z.number().min(1).max(40),
    height: z.number().min(2).max(8),
    truth: Truth,
    evidenceIds: z.array(Id).min(1),
    material: z.enum(["oak", "stone", "plaster"]).default("oak"),
  })
  .strict();
export const Door = z
  .object({
    id: Id,
    from: Id,
    to: Id,
    axis: z.enum(["x", "z"]),
    at: z.number().finite(),
    center: z.number().finite(),
    width: z.number().min(0.8).max(3),
    evidenceIds: z.array(Id).min(1),
  })
  .strict();
export const Fact = z
  .object({
    id: Id,
    roomId: Id.optional(),
    label: safeLabel,
    value: z.union([z.number().finite(), z.string().max(300)]),
    truth: Truth,
    evidenceIds: z.array(Id).min(1),
    staged: z.boolean().default(false),
  })
  .strict();
export const Poi = z
  .object({
    id: Id,
    roomId: Id,
    label: safeLabel,
    x: z.number().finite(),
    z: z.number().finite(),
    truth: Truth,
    evidenceIds: z.array(Id).min(1),
  })
  .strict();
export const SceneManifest = z
  .object({
    schemaVersion: z.literal(1),
    organizationId: Id,
    propertyId: Id,
    revision: z.number().int().positive(),
    source: z.literal("synthetic"),
    measuredBy: Id.nullable(),
    evidenceIds: z.array(Id),
    rooms: z.array(Room).max(30),
    doors: z.array(Door).max(50),
    facts: z.array(Fact).max(100),
    pois: z.array(Poi).max(100),
    unknownRegions: z.array(safeLabel),
    dayparts: z.array(Daypart),
    calibratedLighting: z.literal(false),
  })
  .strict();
export type Scene = z.infer<typeof SceneManifest>;
export type SceneRoom = z.infer<typeof Room>;
export type Position = z.infer<typeof Point>;

export class PlatformError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
  ) {
    super(code);
    this.name = "PlatformError";
  }
}
export function invariant(
  condition: unknown,
  code: string,
  status = 400,
): asserts condition {
  if (!condition) throw new PlatformError(code, status);
}
export function permits(
  role: PlatformRole,
  action: "read" | "edit" | "review" | "admin",
) {
  return (
    action === "read" ||
    role === "admin" ||
    (action === "edit" && role === "editor") ||
    (action === "review" && role === "reviewer")
  );
}
export function validateScene(input: unknown): Scene {
  const scene = SceneManifest.parse(input);
  const ids = [
    ...scene.rooms,
    ...scene.doors,
    ...scene.facts,
    ...scene.pois,
  ].map((x) => x.id);
  invariant(new Set(ids).size === ids.length, "DUPLICATE_SCENE_ID");
  invariant(
    [...scene.rooms, ...scene.doors, ...scene.facts, ...scene.pois].every((x) =>
      x.evidenceIds.every((id) => scene.evidenceIds.includes(id)),
    ),
    "MISSING_EVIDENCE",
  );
  for (const room of scene.rooms)
    invariant(
      room.truth !== "E2" || scene.measuredBy !== null,
      "UNVERIFIED_MEASUREMENT",
    );
  for (const poi of scene.pois)
    invariant(
      scene.rooms.some(
        (r) => r.id === poi.roomId && contains(r, [poi.x, poi.z], 0),
      ),
      "POI_OUTSIDE_ROOM",
    );
  for (const fact of scene.facts)
    invariant(
      !fact.roomId || scene.rooms.some((r) => r.id === fact.roomId),
      "UNKNOWN_FACT_ROOM",
    );
  for (const door of scene.doors) {
    const a = scene.rooms.find((r) => r.id === door.from),
      b = scene.rooms.find((r) => r.id === door.to);
    invariant(
      a && b && a !== b && a.truth === "E2" && b.truth === "E2",
      "UNKNOWN_DOOR_ROOM",
    );
    const near = (x: number, y: number) => Math.abs(x - y) < 0.001;
    const half = door.width / 2;
    invariant(
      door.axis === "x"
        ? ((near(a.x + a.width, door.at) && near(b.x, door.at)) ||
            (near(b.x + b.width, door.at) && near(a.x, door.at))) &&
            door.center - half >= Math.max(a.z, b.z) &&
            door.center + half <= Math.min(a.z + a.depth, b.z + b.depth)
        : ((near(a.z + a.depth, door.at) && near(b.z, door.at)) ||
            (near(b.z + b.depth, door.at) && near(a.z, door.at))) &&
            door.center - half >= Math.max(a.x, b.x) &&
            door.center + half <= Math.min(a.x + a.width, b.x + b.width),
      "INVALID_DOOR_GEOMETRY",
    );
  }
  for (let i = 0; i < scene.rooms.length; i++)
    for (const b of scene.rooms.slice(i + 1)) {
      const a = scene.rooms[i]!;
      invariant(
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) <= 0.001 ||
          Math.min(a.z + a.depth, b.z + b.depth) - Math.max(a.z, b.z) <= 0.001,
        "OVERLAPPING_ROOMS",
      );
    }
  return scene;
}
export function contains(room: SceneRoom, point: Position, margin = 0.18) {
  return (
    point[0] >= room.x + margin &&
    point[0] <= room.x + room.width - margin &&
    point[1] >= room.z + margin &&
    point[1] <= room.z + room.depth - margin
  );
}
export function roomAt(scene: Scene, position: Position) {
  return scene.rooms.find((r) => r.truth === "E2" && contains(r, position, 0));
}
export function canMove(scene: Scene, start: Position, end: Position): boolean {
  const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
  if (!Number.isFinite(distance) || distance > 2) return false;
  const steps = Math.max(1, Math.ceil(distance / 0.04));
  let previous = start;
  for (let i = 1; i <= steps; i++) {
    const point: Position = [
      start[0] + ((end[0] - start[0]) * i) / steps,
      start[1] + ((end[1] - start[1]) * i) / steps,
    ];
    const a = roomAt(scene, previous),
      b = roomAt(scene, point);
    if (!a || !b) return false;
    if (a.id !== b.id) {
      const door = scene.doors.find(
        (d) =>
          ((d.from === a.id && d.to === b.id) ||
            (d.from === b.id && d.to === a.id)) &&
          Math.abs((d.axis === "x" ? point[1] : point[0]) - d.center) <=
            d.width / 2 - 0.18,
      );
      if (!door) return false;
    }
    if (a.id === b.id && !contains(b, point)) {
      const opening = scene.doors.some(
        (d) =>
          (d.from === b.id || d.to === b.id) &&
          Math.abs((d.axis === "x" ? point[0] : point[1]) - d.at) < 0.2 &&
          Math.abs((d.axis === "x" ? point[1] : point[0]) - d.center) <=
            d.width / 2 - 0.18,
      );
      if (!opening) return false;
    }
    previous = point;
  }
  return true;
}
export function routeToRoom(
  scene: Scene,
  from: string,
  to: string,
): Position[] {
  invariant(
    scene.rooms.some((r) => r.id === from && r.truth === "E2") &&
      scene.rooms.some((r) => r.id === to && r.truth === "E2"),
    "UNKNOWN_OR_UNVERIFIED_ROOM",
  );
  const queue: { id: string; points: Position[] }[] = [
      { id: from, points: [] },
    ],
    seen = new Set([from]);
  while (queue.length) {
    const next = queue.shift()!;
    if (next.id === to) {
      const r = scene.rooms.find((r) => r.id === to)!;
      return [...next.points, [r.x + r.width / 2, r.z + r.depth / 2]];
    }
    for (const door of scene.doors) {
      const id =
        door.from === next.id
          ? door.to
          : door.to === next.id
            ? door.from
            : null;
      if (id && !seen.has(id)) {
        seen.add(id);
        queue.push({
          id,
          points: [
            ...next.points,
            door.axis === "x" ? [door.at, door.center] : [door.center, door.at],
          ],
        });
      }
    }
  }
  throw new PlatformError("NO_VERIFIED_ROUTE");
}
export const ViewerCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("focus_room"), roomId: Id }).strict(),
  z.object({ type: z.literal("highlight_feature"), poiId: Id }).strict(),
  z.object({ type: z.literal("show_property_fact"), factId: Id }).strict(),
  z.object({ type: z.literal("set_daypart"), daypart: Daypart }).strict(),
  z.object({ type: z.literal("reset_view") }).strict(),
]);
export type ViewerAction = z.infer<typeof ViewerCommand>;
export function validateViewerCommand(
  scene: Scene,
  input: unknown,
  currentRoom: string,
): { command: ViewerAction; route: Position[] } {
  const command = ViewerCommand.parse(input);
  if (command.type === "focus_room")
    return { command, route: routeToRoom(scene, currentRoom, command.roomId) };
  if (command.type === "highlight_feature")
    invariant(
      scene.pois.some((p) => p.id === command.poiId && p.truth === "E2"),
      "UNKNOWN_POI",
    );
  if (command.type === "show_property_fact")
    invariant(
      scene.facts.some((f) => f.id === command.factId && f.truth !== "E0"),
      "UNKNOWN_FACT",
    );
  if (command.type === "set_daypart")
    invariant(scene.dayparts.includes(command.daypart), "UNSUPPORTED_DAYPART");
  return { command, route: [] };
}
export const GenerationInput = z
  .object({
    propertyId: Id,
    revision: z.number().int().positive(),
    mode: Mode,
    durationSeconds: z
      .union([z.literal(4), z.literal(8), z.literal(16)])
      .default(4),
    aspectRatio: z.enum(["16:9", "9:16"]).default("16:9"),
    idempotencyKey: z.string().min(8).max(80),
    captions: z.boolean().default(true),
    localSource: z.literal("image-motion").default("image-motion"),
    sourceAssetIds: z.array(Id).min(1).max(12).optional(),
    template: z.enum(["modern","luxury","warm","hotel","investment"]).default("modern"),
    branding: z.boolean().default(false),
  })
  .strict();
export const CreateProperty = z
  .object({
    title: safeLabel,
    description: z.string().max(500).default(""),
    syntheticOnly: z.literal(true),
  })
  .strict();
export const Brand = z
  .object({
    displayName: safeLabel,
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    language: z.enum(["tr", "en"]),
    logoAssetId: Id.nullable().default(null),
    domain: z
      .string()
      .regex(/^[a-z0-9-]+\.localhost$/)
      .nullable()
      .default(null),
    voiceName: safeLabel.default("Spaces rehberi"),
  })
  .strict();
export type BrandTheme = z.infer<typeof Brand>;
export function accentText(hex: string): "#000000" | "#ffffff" {
  invariant(/^#[0-9a-fA-F]{6}$/.test(hex), "INVALID_COLOR");
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]! > 0.179
    ? "#000000"
    : "#ffffff";
}
export function microUsd(value: number) {
  invariant(Number.isSafeInteger(value) && value >= 0, "INVALID_MICRO_USD");
  return value;
}
export const CLIENT_EVENTS = [
  "listing_viewed",
  "video_started",
  "video_completed",
  "video_quartile",
  "mode_selected",
  "tour_3d_started",
  "tour_3d_ended",
  "room_entered",
  "feature_highlighted",
  "inspection_detail_opened",
  "daypart_changed",
  "voice_session_started",
  "voice_session_ended",
  "voice_question_category",
  "voice_tool_succeeded",
  "voice_tool_rejected",
  "lead_form_opened",
  "contact_clicked",
] as const;
export const EventInput = z
  .object({
    eventId: Id,
    name: z.enum(CLIENT_EVENTS),
    timestamp: z.iso.datetime({ offset: true }),
    roomId: Id.optional(),
    poiId: Id.optional(),
    value: z.number().min(0).max(1800).optional(),
    category: z
      .enum([
        "intro",
        "measurement",
        "navigation",
        "daypart",
        "staging",
        "contact",
        "unknown",
        "security",
      ])
      .optional(),
    campaign: z
      .string()
      .regex(/^[A-Za-z0-9_-]{0,64}$/)
      .default(""),
  })
  .strict();
export type EngagementEvent = z.infer<typeof EventInput>;
export function csvCell(value: string | number) {
  const s = String(value);
  return (
    '"' + (/^[=+\-@\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"'
  );
}
