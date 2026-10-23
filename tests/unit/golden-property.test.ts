// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import input from "../../fixtures/golden-v5/source.json";
import {
  validateGoldenSource,
  goldenFidelity,
  cameraSeesWindow,
  blindDecision,
  type BlindScore,
} from "@/domain/golden-property";
import { REVIEW_DIMENSIONS } from "@/domain/video-quality";
import {
  canMove,
  routeToRoom,
  navigationLeadIn,
  type Position,
} from "@/domain/platform";
const plan = validateGoldenSource(input),
  clone = () => structuredClone(plan),
  hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

describe("V5 independently authored synthetic CAD truth", () => {
  it("pins source before mesh/renders and declares synthetic rights/unknowns", async () => {
    expect(hash(await readFile("fixtures/golden-v5/source.json"))).toBe(
      "ff04bf1b34623655d6c7161c616ee63abb632fe4db90279b50d67ce0a9364731",
    );
    expect(plan.realProperty).toBe(false);
    expect(plan.scene.rooms).toHaveLength(5);
    expect(plan.scene.doors).toHaveLength(4);
    expect(plan.windows).toHaveLength(3);
    expect(
      plan.scene.rooms.reduce((n, r) => n + r.width * r.depth, 0),
    ).toBeCloseTo(78.4);
    expect(plan.unknownClaims).toContain("balcony");
  });
  it("refuses invalid geometry, camera, duplicate identity or evidence", () => {
    const cases = [
      () => {
        const p = clone();
        p.scene.rooms[0]!.truth = "E1";
        return p;
      },
      () => {
        const p = clone();
        p.windows[0]!.roomId = "invented";
        return p;
      },
      () => {
        const p = clone();
        p.windows[0]!.sill = 99;
        return p;
      },
      () => {
        const p = clone();
        p.windows[0]!.at = 999;
        return p;
      },
      () => {
        const p = clone();
        p.windows[0]!.evidenceIds = ["unknown"];
        return p;
      },
      () => {
        const p = clone();
        p.cameras[0]!.position = [99, 1.65, 99];
        return p;
      },
      () => {
        const p = clone();
        p.cameras[0]!.position[1] = 8;
        return p;
      },
      () => {
        const p = clone();
        p.cameras[0]!.target = [...p.cameras[0]!.position];
        return p;
      },
      () => {
        const p = clone();
        p.cameras[0]!.evidenceIds = ["unknown"];
        return p;
      },
      () => {
        const p = clone();
        p.cameras[0]!.id = p.windows[0]!.id;
        return p;
      },
    ];
    for (const mutate of cases)
      expect(() => validateGoldenSource(mutate())).toThrow();
  });
  it("compares candidate scope, measured areas, rooms and exact apertures against CAD", () => {
    expect(goldenFidelity(plan, plan.scene, plan.windows, []).status).toBe(
      "PASS",
    );
    const altered = clone();
    altered.scene.rooms[0]!.width = 4;
    altered.scene.facts[0]!.value = 999;
    altered.scene.propertyId = "other-property";
    altered.scene.doors.push({
      ...altered.scene.doors[0]!,
      id: "invented-door",
    });
    altered.windows.push({ ...altered.windows[0]!, id: "invented-window" });
    expect(
      goldenFidelity(plan, altered.scene, altered.windows, [
        "balcony",
        "interact-with-object",
      ]).errors,
    ).toEqual([
      "SOURCE_SCOPE_DRIFT",
      "ROOM_GEOMETRY_DRIFT",
      "INVENTED_OR_CHANGED_DOOR",
      "FALSE_MEASUREMENT",
      "INVENTED_OR_CHANGED_WINDOW",
      "UNSUPPORTED_CLAIM",
    ]);
    expect(
      goldenFidelity(plan, plan.scene, plan.windows, [plan.scene.facts[0]!.id])
        .status,
    ).toBe("PASS");
  });
  it("permits real door movement but denies walls, windows, unknown balconies and jumping", () => {
    expect(canMove(plan.scene, [2.8, 1], [3.3, 1])).toBe(true);
    expect(canMove(plan.scene, [4.4, 2], [4.9, 2])).toBe(true);
    expect(canMove(plan.scene, [1.5, 1.8], [1.5, 2.3])).toBe(false);
    expect(canMove(plan.scene, [9.8, 2], [10.3, 2])).toBe(false);
    expect(canMove(plan.scene, [1.5, 1], [6, 2])).toBe(false);
    expect(() => routeToRoom(plan.scene, "entrance", "balcony")).toThrow(
      "UNKNOWN_OR_UNVERIFIED_ROOM",
    );
    expect(
      routeToRoom(plan.scene, "entrance", "bedroom").length,
    ).toBeGreaterThan(1);
  });
  it("tests same-room FOV and refuses fabricated visibility references", () => {
    expect(cameraSeesWindow(plan, "camera-living", "window-living")).toBe(true);
    expect(cameraSeesWindow(plan, "camera-living", "window-kitchen")).toBe(
      false,
    );
    const p = clone(),
      c = p.cameras.find((c) => c.id === "camera-living")!;
    c.target = [c.position[0] - 2, c.position[1], c.position[2]];
    expect(cameraSeesWindow(p, c.id, "window-living")).toBe(false);
    c.target = [c.position[0], c.position[1] + 5, c.position[2] + 1];
    expect(cameraSeesWindow(p, c.id, "window-living")).toBe(false);
    expect(() => cameraSeesWindow(plan, "unknown", "window-living")).toThrow(
      "UNKNOWN_GOLDEN_REFERENCE",
    );
  });
  it("changes routes mid-door without cutting through the corridor wall", () => {
    const start: Position = [3.08, 1.29];
    let current = start;
    const points = [
      ...navigationLeadIn(plan.scene, start),
      ...routeToRoom(plan.scene, "corridor", "living"),
    ];
    for (const target of points) {
      const origin = current;
      const steps = Math.max(
        1,
        Math.ceil(
          Math.hypot(target[0] - origin[0], target[1] - origin[1]) / 0.03,
        ),
      );
      for (let i = 1; i <= steps; i++) {
        const next: Position = [
          origin[0] + ((target[0] - origin[0]) * i) / steps,
          origin[1] + ((target[1] - origin[1]) * i) / steps,
        ];
        expect(canMove(plan.scene, current, next)).toBe(true);
        current = next;
      }
    }
    expect(navigationLeadIn(plan.scene, current)).toEqual([]);
    expect(() => navigationLeadIn(plan.scene, [999, 999])).toThrow(
      "UNKNOWN_NAVIGATION_POSITION",
    );
  });
  it("validates actual GLB scale, all five room bounds and real opening holes", async () => {
    const b = await readFile("public/golden-v5/property.glb");
    expect(b.subarray(0, 4).toString()).toBe("glTF");
    expect(b.readUInt32LE(8)).toBe(b.length);
    const g = JSON.parse(
      b
        .subarray(20, 20 + b.readUInt32LE(12))
        .toString()
        .trim(),
    ) as {
      nodes: { name: string; mesh: number; translation?: number[] }[];
      meshes: { primitives: { attributes: { POSITION: number } }[] }[];
      accessors: { min: number[]; max: number[] }[];
      buffers: { uri?: string }[];
    };
    expect(g.buffers.every((v) => !v.uri)).toBe(true);
    const bounds = (n: (typeof g.nodes)[number]) => {
      const a =
        g.accessors[g.meshes[n.mesh]!.primitives[0]!.attributes.POSITION]!;
      return {
        min: a.min.map((v, i) => v + (n.translation?.[i] ?? 0)),
        max: a.max.map((v, i) => v + (n.translation?.[i] ?? 0)),
      };
    };
    for (const r of plan.scene.rooms) {
      const a = bounds(g.nodes.find((n) => n.name === "floor_" + r.id)!);
      expect(a.min[0]).toBeCloseTo(r.x, 4);
      expect(a.max[0]).toBeCloseTo(r.x + r.width, 4);
      expect(a.min[2]).toBeCloseTo(r.z, 4);
      expect(a.max[2]).toBeCloseTo(r.z + r.depth, 4);
      expect(a.max[1]).toBeCloseTo(0, 4);
    }
    const walls = g.nodes.filter((n) => n.name.startsWith("wall_")).map(bounds);
    const solid = (p: number[]) =>
      walls.some((w) =>
        p.every((v, i) => v > w.min[i]! + 1e-4 && v < w.max[i]! - 1e-4),
      );
    for (const d of plan.scene.doors)
      expect(
        solid(d.axis === "x" ? [d.at, 1.65, d.center] : [d.center, 1.65, d.at]),
      ).toBe(false);
    for (const w of plan.windows)
      expect(
        solid(
          w.axis === "x"
            ? [w.at, w.sill + w.height / 2, w.center]
            : [w.center, w.sill + w.height / 2, w.at],
        ),
      ).toBe(false);
    expect(solid([4.6, 1.65, 3.4])).toBe(true);
  });
  it("verifies every immutable fixture hash and actual per-room render metadata", async () => {
    const e = JSON.parse(
      await readFile("public/golden-v5/evidence.json", "utf8"),
    ) as {
      sourceSha256: string;
      generatorSha256: string;
      files: { file: string; sha256: string; bytes: number }[];
    };
    expect(e.sourceSha256).toBe(
      hash(await readFile("fixtures/golden-v5/source.json")),
    );
    expect(e.generatorSha256).toBe(
      hash(await readFile("scripts/golden-property.py")),
    );
    for (const f of e.files) {
      const b = await readFile("public/golden-v5/" + f.file);
      expect(hash(b)).toBe(f.sha256);
      expect(b.length).toBe(f.bytes);
      if (f.file.endsWith(".png")) {
        const m = await sharp(b).metadata();
        expect([m.width, m.height]).toEqual([640, 360]);
        expect(m.exif).toBeUndefined();
      }
    }
    const observations = JSON.parse(
      await readFile("public/golden-v5/blender-observations.json", "utf8"),
    ) as {
      observations: { visibility: { unobstructedToAperture: boolean }[] }[];
    };
    expect(observations.observations).toHaveLength(5);
    expect(
      observations.observations
        .flatMap((o) => o.visibility)
        .every((v) => v.unobstructedToAperture),
    ).toBe(true);
  });
  it("probes and fully decodes six actual clips with bound source/shot evidence", async () => {
    const e = JSON.parse(
      await readFile("public/golden-v5/evidence.json", "utf8"),
    ) as {
      clips: {
        file: string;
        aspect: string;
        sourceSha256: string;
        manifestRevision: number;
        sourceImages: {
          id: string;
          normalizedSha256: string;
          renderSha256: string;
        }[];
        output: {
          sourceHashes: string[];
          shotProvenance: { sourceId: string; sourceSha256: string }[];
        };
        release: string;
      }[];
    };
    expect(e.clips).toHaveLength(6);
    for (const c of e.clips) {
      expect(c.sourceImages).toHaveLength(4);
      expect(
        c.sourceImages.every((s) =>
          c.output.sourceHashes.includes(s.normalizedSha256),
        ),
      ).toBe(true);
      expect(
        c.output.shotProvenance.every((s) =>
          c.sourceImages.some(
            (a) => a.id === s.sourceId && a.normalizedSha256 === s.sourceSha256,
          ),
        ),
      ).toBe(true);
      const probe = JSON.parse(
        execFileSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=codec_name,codec_type,width,height",
            "-of",
            "json",
            "public/golden-v5/" + c.file,
          ],
          { encoding: "utf8", timeout: 10000 },
        ),
      );
      expect(probe.streams).toHaveLength(1);
      expect(probe.streams[0].codec_name).toBe("h264");
      expect(probe.streams[0].width).toBe(c.aspect === "16:9" ? 640 : 360);
      expect(Math.abs(Number(probe.format.duration) - 4)).toBeLessThan(0.05);
      execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-xerror",
          "-threads",
          "1",
          "-i",
          "public/golden-v5/" + c.file,
          "-f",
          "null",
          "-",
        ],
        { timeout: 15000 },
      );
      expect(c.release).toBe("AWAITING_DIFFERENT_HUMAN_REVIEW");
    }
  }, 120000);
});

describe("two real independent reviewers remain an unclosed gate", () => {
  const score = (
    reviewer: string | null,
    n: number | null,
    critical: boolean | null = false,
  ): BlindScore => ({
    reviewer,
    scores: Object.fromEntries(REVIEW_DIMENSIONS.map((k) => [k, n])),
    criticalFabricatedArchitecture: critical,
  });
  it("keeps actual scorecards NULL and strips coordinator identities from reviewer sheets", async () => {
    const doc = JSON.parse(
      await readFile("artifacts/golden-v5/blind-scorecards.json", "utf8"),
    ) as { outputs: { reviewers: BlindScore[] }[] };
    for (const o of doc.outputs) {
      expect(
        o.reviewers.every(
          (r) =>
            r.reviewer === null &&
            Object.values(r.scores).every((v) => v === null),
        ),
      ).toBe(true);
      expect(blindDecision(o.reviewers, "creator")).toBe(
        "AWAITING_INDEPENDENT_HUMAN_REVIEW",
      );
    }
    expect(JSON.stringify(doc)).not.toContain('"mode":');
  });
  it("rejects fabricated architecture regardless of positive averages", () =>
    expect(
      blindDecision(
        [score("fixture-a", 5, true), score("fixture-b", 5)],
        "creator",
      ),
    ).toBe("REJECTED_CRITICAL"));
  it("refuses missing, duplicate or creator reviews", () => {
    for (const r of [
      [],
      [score("fixture-a", 5)],
      [score("fixture-a", 5), score("fixture-a", 5)],
      [score("creator", 5), score("fixture-b", 5)],
      [score("fixture-a", null), score("fixture-b", 5)],
      [score("fixture-a", 5, null), score("fixture-b", 5)],
    ])
      expect(blindDecision(r, "creator")).toBe(
        "AWAITING_INDEPENDENT_HUMAN_REVIEW",
      );
  });
  it("requires valid threshold scores and preserves normal release authorization", () => {
    expect(() =>
      blindDecision([score("fixture-a", 6), score("fixture-b", 5)], "creator"),
    ).toThrow("INVALID_BLIND_SCORE");
    expect(
      blindDecision([score("fixture-a", 2), score("fixture-b", 5)], "creator"),
    ).toBe("REJECTED_SCORE");
    expect(
      blindDecision([score("fixture-a", 3), score("fixture-b", 4)], "creator"),
    ).toBe("REJECTED_SCORE");
    expect(
      blindDecision([score("fixture-a", 4), score("fixture-b", 5)], "creator"),
    ).toBe("ACCEPTED_REQUIRES_NORMAL_RELEASE_GATE");
  });
});
