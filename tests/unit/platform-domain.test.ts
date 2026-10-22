import { describe, it, expect } from "vitest";
import {
  validateScene,
  permits,
  canMove,
  roomAt,
  contains,
  routeToRoom,
  validateViewerCommand,
  accentText,
  microUsd,
  csvCell,
  SceneManifest,
  EventInput,
  GenerationInput,
  Brand,
  PlatformError,
  invariant,
} from "@/domain/platform";
import { measuredFixture, emptyManifest } from "@/server/seed";

const fixture = () =>
  measuredFixture("studio", "property-a", 2, "plan-1", "measurer");
describe("evidence and metric navigation contract", () => {
  it("accepts empty unknown drafts, and measures only explicitly verified synthetic geometry", () => {
    expect(validateScene(emptyManifest("studio", "new", 1)).rooms).toEqual([]);
    expect(validateScene(fixture()).facts[0]?.truth).toBe("E2");
  });
  it.each([
    [
      "DUPLICATE_SCENE_ID",
      (s: ReturnType<typeof fixture>) => {
        s.pois[0]!.id = "living";
      },
    ],
    [
      "MISSING_EVIDENCE",
      (s: ReturnType<typeof fixture>) => {
        s.rooms[0]!.evidenceIds = ["absent"];
      },
    ],
    [
      "UNVERIFIED_MEASUREMENT",
      (s: ReturnType<typeof fixture>) => {
        s.measuredBy = null;
      },
    ],
    [
      "POI_OUTSIDE_ROOM",
      (s: ReturnType<typeof fixture>) => {
        s.pois[0]!.x = 100;
      },
    ],
    [
      "POI_OUTSIDE_ROOM",
      (s: ReturnType<typeof fixture>) => {
        s.pois[0]!.roomId = "absent";
      },
    ],
    [
      "UNKNOWN_FACT_ROOM",
      (s: ReturnType<typeof fixture>) => {
        s.facts[0]!.roomId = "absent";
      },
    ],
    [
      "UNKNOWN_DOOR_ROOM",
      (s: ReturnType<typeof fixture>) => {
        s.doors[0]!.to = "absent";
      },
    ],
    [
      "UNKNOWN_DOOR_ROOM",
      (s: ReturnType<typeof fixture>) => {
        s.doors[0]!.to = "living";
      },
    ],
    [
      "UNKNOWN_DOOR_ROOM",
      (s: ReturnType<typeof fixture>) => {
        s.rooms[1]!.truth = "E1";
      },
    ],
    [
      "INVALID_DOOR_GEOMETRY",
      (s: ReturnType<typeof fixture>) => {
        s.doors[0]!.at = 4;
      },
    ],
    [
      "INVALID_DOOR_GEOMETRY",
      (s: ReturnType<typeof fixture>) => {
        s.doors[1]!.center = -4;
      },
    ],
    [
      "OVERLAPPING_ROOMS",
      (s: ReturnType<typeof fixture>) => {
        s.doors = [];
        s.rooms[1]!.x = 4;
      },
    ],
  ] as const)("fails closed: %s", (code, mutate) => {
    const s = fixture();
    mutate(s);
    expect(() => validateScene(s)).toThrow(code);
  });
  it("checks reverse door orientation, z joins and no E2 claims for unmeasured E1 rooms", () => {
    const s = fixture();
    for (const d of s.doors) [d.from, d.to] = [d.to, d.from];
    expect(validateScene(s).doors).toHaveLength(2);
    s.doors = [];
    s.rooms.forEach((r) => (r.truth = "E1"));
    s.measuredBy = null;
    expect(validateScene(s).measuredBy).toBeNull();
  });
  it.each([
    [[3, 2], [3.5, 2], true],
    [[5.6, 2.5], [6.4, 2.5], true],
    [[6.4, 2.5], [5.6, 2.5], true],
    [[3, 4.6], [3, 5.4], true],
    [[3, 5.4], [3, 4.6], true],
    [[5.6, 1], [6.4, 1], false],
    [[3, 2], [8, 2], false],
    [[-1, 2], [0, 2], false],
    [[0.3, 1], [0.05, 1], false],
    [[3, 2], [NaN, 2], false],
  ] as const)("collision sweep %j to %j => %s", (from, to, allowed) => {
    expect(canMove(fixture(), [...from], [...to])).toBe(allowed);
  });
  it("treats E0/E1 and unknown regions as inaccessible, and exposes only metric room bounds", () => {
    const s = fixture();
    expect(contains(s.rooms[0]!, [0, 0], 0)).toBe(true);
    expect(contains(s.rooms[0]!, [0, 0])).toBe(false);
    expect(roomAt(s, [30, 30])).toBeUndefined();
    s.rooms[0]!.truth = "E1";
    expect(canMove(s, [2, 2], [2.1, 2])).toBe(false);
  });
  it("finds paths only through verified doors, including reverse and already-current routes", () => {
    const s = fixture();
    expect(routeToRoom(s, "kitchen", "bedroom")).toEqual([
      [6, 2.5],
      [3, 5],
      [3, 7],
    ]);
    expect(routeToRoom(s, "living", "living")).toEqual([[3, 2.5]]);
    expect(() => routeToRoom(s, "unseen", "living")).toThrow(
      "UNKNOWN_OR_UNVERIFIED_ROOM",
    );
    s.doors = [];
    expect(() => routeToRoom(s, "living", "bedroom")).toThrow(
      "NO_VERIFIED_ROUTE",
    );
  });
  it("validates all allowlisted viewer commands against evidence, with no arbitrary tool arguments", () => {
    const s = fixture();
    expect(
      validateViewerCommand(
        s,
        { type: "focus_room", roomId: "kitchen" },
        "living",
      ).route,
    ).toHaveLength(2);
    for (const c of [
      { type: "highlight_feature", poiId: "material-oak" },
      { type: "show_property_fact", factId: "living-area" },
      { type: "set_daypart", daypart: "evening" },
      { type: "reset_view" },
    ])
      expect(validateViewerCommand(s, c, "living").route).toEqual([]);
    expect(() =>
      validateViewerCommand(
        s,
        { type: "highlight_feature", poiId: "absent" },
        "living",
      ),
    ).toThrow("UNKNOWN_POI");
    expect(() =>
      validateViewerCommand(
        s,
        { type: "show_property_fact", factId: "absent" },
        "living",
      ),
    ).toThrow("UNKNOWN_FACT");
    s.facts[0]!.truth = "E0";
    expect(() =>
      validateViewerCommand(
        s,
        { type: "show_property_fact", factId: "living-area" },
        "living",
      ),
    ).toThrow();
    s.pois[0]!.truth = "E1";
    expect(() =>
      validateViewerCommand(
        s,
        { type: "highlight_feature", poiId: "material-oak" },
        "living",
      ),
    ).toThrow();
    s.dayparts = [];
    expect(() =>
      validateViewerCommand(
        s,
        { type: "set_daypart", daypart: "noon" },
        "living",
      ),
    ).toThrow("UNSUPPORTED_DAYPART");
    expect(() =>
      validateViewerCommand(
        s,
        { type: "fetch", url: "https://example.invalid" },
        "living",
      ),
    ).toThrow();
  });
});
describe("role, cost, branding and event boundaries", () => {
  it("enforces the complete four-role action matrix", () => {
    for (const role of ["admin", "editor", "reviewer", "viewer"] as const)
      for (const action of ["read", "edit", "review", "admin"] as const)
        expect(permits(role, action)).toBe(
          action === "read" ||
            role === "admin" ||
            (action === "edit" && role === "editor") ||
            (action === "review" && role === "reviewer"),
        );
  });
  it("never represents fractional or unsafe accounting values", () => {
    expect(microUsd(0)).toBe(0);
    expect(microUsd(12345)).toBe(12345);
    for (const n of [-1, 0.1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
      expect(() => microUsd(n)).toThrow("INVALID_MICRO_USD");
  });
  it("selects legible accent foregrounds and rejects injected colors/domains/labels", () => {
    expect(accentText("#ffffff")).toBe("#000000");
    expect(accentText("#000000")).toBe("#ffffff");
    expect(accentText("#777777")).toBe("#000000");
    expect(() => accentText("red;url(x)")).toThrow();
    for (const bad of [
      { displayName: "<script>" },
      { displayName: "a\u0001" },
      { domain: "other.example.com" },
      { accent: "url(x)" },
    ])
      expect(() =>
        Brand.parse({
          displayName: "Test",
          accent: "#cccccc",
          language: "tr",
          ...bad,
        }),
      ).toThrow();
    expect(
      Brand.parse({
        displayName: "Safe",
        accent: "#ABCDEF",
        language: "en",
        domain: "safe.localhost",
      }).voiceName,
    ).toBe("Spaces rehberi");
  });
  it("escapes spreadsheet formulas and quotes without losing numeric zero", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell(0)).toBe('"0"');
    for (const p of ["=", "+", "-", "@", "\t", "\r"])
      expect(csvCell(p + "formula").startsWith("\"'")).toBe(true);
  });
  it("rejects unsafe manifests, forged server conversion events and unknown fields", () => {
    const s = fixture();
    expect(() =>
      SceneManifest.parse({
        ...s,
        source: "customer",
        calibratedLighting: true,
      }),
    ).toThrow();
    const event = {
      eventId: "e",
      name: "room_entered",
      timestamp: new Date().toISOString(),
    };
    expect(EventInput.parse(event).campaign).toBe("");
    for (const bad of [
      { name: "viewing_confirmed" },
      { organizationId: "other" },
      { value: 1801 },
      { campaign: "https://secret.invalid" },
      { timestamp: "2026-01-01" },
    ])
      expect(() => EventInput.parse({ ...event, ...bad })).toThrow();
  });
  it("pins bounded generation defaults and safe error codes", () => {
    const result = GenerationInput.parse({
      propertyId: "p",
      revision: 1,
      mode: "pov",
      idempotencyKey: "eight-chars",
    });
    expect(result.durationSeconds).toBe(4);
    expect(() =>
      GenerationInput.parse({ ...result, durationSeconds: 999 }),
    ).toThrow();
    expect(() => invariant(false, "DENY", 403)).toThrow(
      new PlatformError("DENY", 403),
    );
    invariant(true, "PASS");
  });
});
