import { canMove, invariant, type Position, type Scene } from "./platform";

/** Bounded elapsed-time movement; each segment still crosses the unchanged collision gate. */
export function advanceRoute(
  scene: Scene,
  start: Position,
  route: readonly Position[],
  elapsedSeconds: number,
) {
  invariant(
    Number.isFinite(elapsedSeconds) &&
      elapsedSeconds >= 0 &&
      route.length <= 200 &&
      route.every((p) => p.every(Number.isFinite)),
    "INVALID_NAVIGATION_STEP",
  );
  let position: Position = [...start];
  const remaining = route.map((p): Position => [...p]);
  let budget = Math.min(0.5, elapsedSeconds) * 1.4;
  let yaw: number | null = null,
    blocked = false,
    operations = 0;
  while (budget > 1e-8 && remaining.length && operations++ < 256) {
    const goal = remaining[0]!;
    const distance = Math.hypot(goal[0] - position[0], goal[1] - position[1]);
    if (distance < 1e-6) {
      remaining.shift();
      continue;
    }
    const step = Math.min(distance, budget, 0.07);
    const dx = ((goal[0] - position[0]) / distance) * step;
    const dz = ((goal[1] - position[1]) / distance) * step;
    const end: Position = [position[0] + dx, position[1] + dz];
    if (!canMove(scene, position, end)) {
      blocked = true;
      remaining.length = 0;
      break;
    }
    yaw = Math.atan2(-dx, -dz);
    position = end;
    budget -= step;
    if (step === distance) remaining.shift();
  }
  return { position, remaining, yaw, blocked };
}
