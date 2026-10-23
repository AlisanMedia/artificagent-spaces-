import { describe, expect, it } from "vitest";
import { advanceRoute } from "@/domain/navigation-route";
import {
  navigationLeadIn,
  routeToRoom,
  roomAt,
  type Position,
} from "@/domain/platform";
import { validateGoldenSource } from "@/domain/golden-property";
import source from "../../fixtures/golden-v5/source.json";
const scene = validateGoldenSource(source).scene;

describe("elapsed-time route movement preserves collision boundaries at slow frame rates", () => {
  it("moves the same distance at 10 and 60 fps without waypoint overshoot", () => {
    function simulate(fps: number) {
      let position: Position = [1.5, 1];
      let route = routeToRoom(scene, "entrance", "living");
      for (let n = 0; n < fps * 2; n++) {
        const next = advanceRoute(scene, position, route, 1 / fps);
        expect(next.blocked).toBe(false);
        position = next.position;
        route = next.remaining;
      }
      return position;
    }
    const slow = simulate(10),
      fast = simulate(60);
    expect(slow[0]).toBeCloseTo(fast[0], 5);
    expect(slow[1]).toBeCloseTo(fast[1], 5);
    expect(roomAt(scene, slow)?.id).toBe("corridor");
  });
  it("caps a suspended frame and keeps every intermediate step inside approved rooms", () => {
    const start: Position = [3.08, 1.29];
    const route = [
      ...navigationLeadIn(scene, start),
      ...routeToRoom(scene, "corridor", "living"),
    ];
    const first = advanceRoute(scene, start, route, 1000);
    expect(
      Math.hypot(first.position[0] - start[0], first.position[1] - start[1]),
    ).toBeLessThanOrEqual(0.700001);
    expect(first.remaining.length).toBeGreaterThan(0);
    let next = first;
    for (let n = 0; n < 20 && next.remaining.length; n++)
      next = advanceRoute(scene, next.position, next.remaining, 0.5);
    expect(next.blocked).toBe(false);
    expect(next.remaining).toEqual([]);
    expect(roomAt(scene, next.position)?.id).toBe("living");
  });
  it("rejects a shortcut through the bedroom wall and stops rather than teleporting", () => {
    const result = advanceRoute(scene, [1.5, 1.7], [[1.5, 2.7]], 0.5);
    expect(result.blocked).toBe(true);
    expect(roomAt(scene, result.position)?.id).toBe("entrance");
    expect(result.remaining).toEqual([]);
  });
  it("holds on zero time, ends exactly at nearby goals and refuses invalid time/oversized routes", () => {
    expect(advanceRoute(scene, [1.5, 1], [[1.5, 1]], 0).position).toEqual([
      1.5, 1,
    ]);
    const result = advanceRoute(
      scene,
      [1.5, 1],
      [
        [1.5, 1],
        [1.52, 1],
      ],
      0.5,
    );
    expect(result.position).toEqual([1.52, 1]);
    expect(result.remaining).toEqual([]);
    expect(() => advanceRoute(scene, [1.5, 1], [], NaN)).toThrow(
      "INVALID_NAVIGATION_STEP",
    );
    expect(() => advanceRoute(scene, [1.5, 1], [], -1)).toThrow(
      "INVALID_NAVIGATION_STEP",
    );
    expect(() =>
      advanceRoute(
        scene,
        [1.5, 1],
        Array.from({ length: 201 }, (): Position => [1.5, 1]),
        1,
      ),
    ).toThrow("INVALID_NAVIGATION_STEP");
    expect(() => advanceRoute(scene, [1.5, 1], [[NaN, 1]], 1)).toThrow(
      "INVALID_NAVIGATION_STEP",
    );
  });
});
