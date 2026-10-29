// @vitest-environment node
import { describe, it, expect } from "vitest";
import registry from "../../fixtures/showcase-v55/registry.json";
import publicRights from "../../fixtures/showcase-v55/public-rights.json";
import { ShowcaseRegistry } from "@/domain/showcase";
import { matchedComparison } from "@/domain/showcase-selection";
import {
  canRequestFinal,
  CUSTOMER_JOB_LABELS,
} from "@/domain/customer-project";
import type { JobView } from "@/contracts/platform-ui";
import { verifyShowcase } from "../../scripts/verify-showcase";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const parsed = ShowcaseRegistry.parse(registry);
const asset = (id: string) => parsed.assets.find((a) => a.id === id)!;
describe("V5.5 source-bound public showcase", () => {
  it("decodes every actual MP4, validates hashes, image derivatives, real panorama and GLB", async () => {
    const v = await verifyShowcase();
    expect(v.registry.samples.map((s) => s.style)).toEqual([
      "natural",
      "premium",
      "explore",
      "exterior",
    ]);
    expect(v.realProviderCalls).toBe(0);
  }, 20000);
  it.each(["natural", "premium", "explore", "exterior"])(
    "keeps %s video, poster and source correctly linked",
    (style) => {
      const s = parsed.samples.find((s) => s.style === style)!;
      expect(asset(s.outputId).sourceId).toBe(s.sourceId);
      expect(asset(s.posterId).sourceId).toBe(s.outputId);
      expect(asset(s.outputId).durationSeconds).toBeGreaterThan(3.9);
      expect(asset(s.outputId).width).toBe(640);
      expect(asset(s.outputId).production).toBe(false);
    },
  );
  it.each([
    "missing",
    "property",
    "camera",
    "framing",
    "same-file",
    "different-source",
  ])(
    "rejects a %s comparison instead of fabricating a transformation",
    (kind) => {
      const v = structuredClone(registry);
      const a = v.assets.find((a) => a.id === v.comparison.afterId)!;
      if (kind === "missing") v.assets = v.assets.filter((x) => x.id !== a.id);
      if (kind === "property") a.propertyId = "other-property";
      if (kind === "camera") a.cameraId = "other-camera";
      if (kind === "framing") a.width = 123;
      if (kind === "same-file")
        a.sha256 = v.assets.find((x) => x.id === v.comparison.beforeId)!.sha256;
      if (kind === "different-source") a.sourceHash = "a".repeat(64);
      expect(ShowcaseRegistry.safeParse(v).success).toBe(false);
    },
  );
  it("matches only the same property/camera/geometry and source hash", () => {
    const b = asset(parsed.comparison.beforeId),
      a = asset(parsed.comparison.afterId),
      s = asset(parsed.comparison.sourceId);
    expect(matchedComparison(b, a, s)).toBe(true);
    expect(matchedComparison(b, { ...a, propertyId: "elsewhere" }, s)).toBe(
      false,
    );
    expect(matchedComparison(b, { ...a, width: 10 }, s)).toBe(false);
    expect(matchedComparison(b, { ...a, sourceHash: "f".repeat(64) }, s)).toBe(
      false,
    );
  });
  it.each([
    "ordinary-photo",
    "wrong-aspect",
    "missing-output",
    "external-url",
    "source-confusion",
    "duplicate-style",
  ])("fails closed on %s registry data", (kind) => {
    const v = structuredClone(registry);
    const p = v.assets.find((a) => a.id === v.panoramaId)!;
    if (kind === "ordinary-photo") p.type = "image";
    if (kind === "wrong-aspect") p.width = 100;
    if (kind === "missing-output")
      v.assets = v.assets.filter((a) => a.id !== v.samples[0]!.outputId);
    if (kind === "external-url")
      v.assets[0]!.url = "https://attacker.invalid/private.jpg";
    if (kind === "source-confusion") v.samples[0]!.sourceId = "facade-source";
    if (kind === "duplicate-style") v.samples[0]!.style = v.samples[1]!.style;
    expect(ShowcaseRegistry.safeParse(v).success).toBe(false);
  });
  it("fails the build on missing or changed public file bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "spaces-showcase-invalid-"));
    try {
      await mkdir(join(root, "fixtures/showcase-v55"), { recursive: true });
      await writeFile(
        join(root, "fixtures/showcase-v55/registry.json"),
        JSON.stringify(registry),
      );
      await expect(verifyShowcase(root)).rejects.toThrow();
      await mkdir(join(root, "public/golden-v5"), { recursive: true });
      await writeFile(
        join(root, "fixtures/showcase-v55/public-rights.json"),
        JSON.stringify(publicRights),
      );
      await writeFile(
        join(root, "public/golden-v5/living.png"),
        "changed public fixture",
      );
      await expect(verifyShowcase(root)).rejects.toThrow("SHOWCASE_HASH_DRIFT");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("customer job wording is not release authorization", () => {
  it("distinguishes an ambiguous submission from a successful or failed delivery", () => {
    expect(CUSTOMER_JOB_LABELS["unknown-submission"]).toBe(
      "Sonuç doğrulanamadı",
    );
    expect(CUSTOMER_JOB_LABELS["awaiting-review"]).toBe("İnceleme bekliyor");
    expect(CUSTOMER_JOB_LABELS.approved).toBe("Hazır");
  });
  it("keeps release closed for every unapproved, stale or missing output", () => {
    const output = {} as NonNullable<JobView["output"]>;
    for (const state of Object.keys(CUSTOMER_JOB_LABELS) as JobView["state"][])
      expect(canRequestFinal({ state, revision: 2, output }, 2)).toBe(
        state === "approved",
      );
    expect(canRequestFinal({ state: "approved", revision: 2, output }, 3)).toBe(
      false,
    );
    expect(
      canRequestFinal({ state: "approved", revision: 2, output: null }, 2),
    ).toBe(false);
  });
});
