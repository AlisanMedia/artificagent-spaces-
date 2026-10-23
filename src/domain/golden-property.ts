import { z } from "zod";
import {
  SceneManifest,
  validateScene,
  contains,
  invariant,
  type Scene,
} from "./platform";
import { REVIEW_DIMENSIONS } from "./video-quality";

const Vector = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
export const GoldenSource = z
  .object({
    version: z.literal(1),
    rights: z.literal("PROJECT_AUTHORED_SYNTHETIC"),
    realProperty: z.literal(false),
    scene: SceneManifest,
    windows: z
      .array(
        z
          .object({
            id: z.string(),
            roomId: z.string(),
            axis: z.enum(["x", "z"]),
            at: z.number(),
            center: z.number(),
            width: z.number().positive(),
            sill: z.number().nonnegative(),
            height: z.number().positive(),
            evidenceIds: z.array(z.string()).min(1),
          })
          .strict(),
      )
      .max(20),
    cameras: z
      .array(
        z
          .object({
            id: z.string(),
            roomId: z.string(),
            position: Vector,
            target: Vector,
            verticalFovDegrees: z.number().min(30).max(100),
            aspect: z.number().min(0.5).max(2),
            evidenceIds: z.array(z.string()).min(1),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    materials: z
      .array(
        z
          .object({
            id: z.string(),
            rgb: z.tuple([
              z.number().min(0).max(1),
              z.number().min(0).max(1),
              z.number().min(0).max(1),
            ]),
            roughness: z.number().min(0).max(1),
          })
          .strict(),
      )
      .min(1),
    lighting: z
      .object({
        renderer: z.literal("CYCLES_CPU"),
        samples: z.literal(16),
        seed: z.literal(51),
        exposure: z.literal(0),
      })
      .strict(),
    unknownClaims: z.array(z.string()).min(1),
  })
  .strict();
export type GoldenPlan = z.infer<typeof GoldenSource>;

export function validateGoldenSource(input: unknown): GoldenPlan {
  const plan = GoldenSource.parse(input);
  validateScene(plan.scene);
  invariant(
    plan.scene.rooms.every((r) => r.truth === "E2"),
    "GOLDEN_CAD_ONLY",
  );
  invariant(
    new Set([...plan.windows, ...plan.cameras].map((v) => v.id)).size ===
      plan.windows.length + plan.cameras.length,
    "GOLDEN_DUPLICATE_ID",
  );
  for (const w of plan.windows) {
    const r = plan.scene.rooms.find((r) => r.id === w.roomId);
    invariant(r, "GOLDEN_WINDOW_ROOM");
    const start = w.axis === "x" ? r.z : r.x,
      end = start + (w.axis === "x" ? r.depth : r.width);
    invariant(
      (Math.abs(w.at - (w.axis === "x" ? r.x : r.z)) < 1e-6 ||
        Math.abs(w.at - (w.axis === "x" ? r.x + r.width : r.z + r.depth)) <
          1e-6) &&
        w.center - w.width / 2 >= start &&
        w.center + w.width / 2 <= end &&
        w.sill + w.height <= r.height,
      "GOLDEN_WINDOW_BOUNDS",
    );
    invariant(
      w.evidenceIds.every((id) => plan.scene.evidenceIds.includes(id)),
      "GOLDEN_WINDOW_EVIDENCE",
    );
  }
  for (const c of plan.cameras) {
    const r = plan.scene.rooms.find((r) => r.id === c.roomId);
    invariant(
      r &&
        contains(r, [c.position[0], c.position[2]]) &&
        c.position[1] > 0 &&
        c.position[1] < r.height,
      "GOLDEN_CAMERA_BOUNDS",
    );
    invariant(
      Math.hypot(...c.position.map((v, i) => v - c.target[i]!)) > 0.01,
      "GOLDEN_CAMERA_DIRECTION",
    );
    invariant(
      c.evidenceIds.every((id) => plan.scene.evidenceIds.includes(id)),
      "GOLDEN_CAMERA_EVIDENCE",
    );
  }
  return plan;
}

/** CAD is authored before renders; this comparison is not an LLM's self assessment. */
export function goldenFidelity(
  plan: GoldenPlan,
  candidate: Scene,
  windows: GoldenPlan["windows"],
  claims: readonly string[],
) {
  const errors: string[] = [];
  if (
    candidate.organizationId !== plan.scene.organizationId ||
    candidate.propertyId !== plan.scene.propertyId ||
    candidate.revision !== plan.scene.revision
  )
    errors.push("SOURCE_SCOPE_DRIFT");
  if (JSON.stringify(candidate.rooms) !== JSON.stringify(plan.scene.rooms))
    errors.push("ROOM_GEOMETRY_DRIFT");
  if (JSON.stringify(candidate.doors) !== JSON.stringify(plan.scene.doors))
    errors.push("INVENTED_OR_CHANGED_DOOR");
  if (JSON.stringify(candidate.facts) !== JSON.stringify(plan.scene.facts))
    errors.push("FALSE_MEASUREMENT");
  if (JSON.stringify(windows) !== JSON.stringify(plan.windows))
    errors.push("INVENTED_OR_CHANGED_WINDOW");
  if (
    claims.some(
      (c) =>
        plan.unknownClaims.includes(c) ||
        !plan.scene.facts.some((f) => f.id === c),
    )
  )
    errors.push("UNSUPPORTED_CLAIM");
  return {
    status: errors.length ? ("FAIL" as const) : ("PASS" as const),
    errors,
    photographicRealism: "NOT_VERIFIED" as const,
  };
}

/** Convex-room geometric FOV test only; no claim of visual recognition or exterior visibility. */
export function cameraSeesWindow(
  plan: GoldenPlan,
  cameraId: string,
  windowId: string,
) {
  const c = plan.cameras.find((c) => c.id === cameraId),
    w = plan.windows.find((w) => w.id === windowId);
  invariant(c && w, "UNKNOWN_GOLDEN_REFERENCE");
  if (c.roomId !== w.roomId) return false;
  const target =
    w.axis === "x"
      ? [w.at, w.sill + w.height / 2, w.center]
      : [w.center, w.sill + w.height / 2, w.at];
  const forward = c.target.map((v, i) => v - c.position[i]!);
  const ray = target.map((v, i) => v - c.position[i]!);
  const dot = forward.reduce((n, v, i) => n + v * ray[i]!, 0);
  const horizontal = Math.abs(
    Math.atan2(ray[0]!, ray[2]!) - Math.atan2(forward[0]!, forward[2]!),
  );
  const angle = Math.min(horizontal, 2 * Math.PI - horizontal);
  const vertical = Math.abs(
    Math.atan2(ray[1]!, Math.hypot(ray[0]!, ray[2]!)) -
      Math.atan2(forward[1]!, Math.hypot(forward[0]!, forward[2]!)),
  );
  const half = (c.verticalFovDegrees * Math.PI) / 360;
  return (
    dot > 0 && angle <= Math.atan(Math.tan(half) * c.aspect) && vertical <= half
  );
}

export interface BlindScore {
  reviewer: string | null;
  scores: Partial<Record<(typeof REVIEW_DIMENSIONS)[number], number | null>>;
  criticalFabricatedArchitecture: boolean | null;
}
export function blindDecision(reviews: readonly BlindScore[], creator: string) {
  if (reviews.some((r) => r.criticalFabricatedArchitecture === true))
    return "REJECTED_CRITICAL";
  if (
    reviews.length !== 2 ||
    reviews.some((r) => !r.reviewer || r.reviewer === creator) ||
    new Set(reviews.map((r) => r.reviewer)).size !== 2 ||
    reviews.some(
      (r) =>
        r.criticalFabricatedArchitecture === null ||
        REVIEW_DIMENSIONS.some((k) => r.scores[k] == null),
    )
  )
    return "AWAITING_INDEPENDENT_HUMAN_REVIEW";
  const scores = reviews.flatMap((r) =>
    REVIEW_DIMENSIONS.map((k) => r.scores[k]!),
  );
  invariant(
    scores.every((s) => Number.isFinite(s) && s >= 0 && s <= 5),
    "INVALID_BLIND_SCORE",
  );
  return scores.every((s) => s >= 3) &&
    scores.reduce((a, b) => a + b, 0) / scores.length >= 4
    ? "ACCEPTED_REQUIRES_NORMAL_RELEASE_GATE"
    : "REJECTED_SCORE";
}
