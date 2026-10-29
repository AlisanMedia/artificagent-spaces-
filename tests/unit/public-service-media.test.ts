// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import registry from "../../fixtures/showcase-v55/registry.json";
import legacy from "../../fixtures/showcase-v55/legacy-asset-hashes.json";
import { ShowcaseRegistry } from "@/domain/showcase";
describe("curated public media never overstates a provider result", () => {
  it("preserves every prior authored asset byte and the original Golden model", async () => {
    for (const a of legacy) {
      const bytes = await readFile("public" + a.url);
      expect(createHash("sha256").update(bytes).digest("hex"), a.url).toBe(
        a.sha256,
      );
      expect(bytes.length).toBe(a.bytes);
    }
  });
  it("uses different, output-bound service covers and an actual existing renderer", () => {
    const v = ShowcaseRegistry.parse(registry);
    const photo = v.assets.find((a) => a.id === v.samples[0]!.sourceId)!;
    expect(photo.rights).toBe("VERIFIED_CC0_REFERENCE");
    expect(photo.license?.author).toBe("Sergej Majboroda");
    expect(v.assets.find((a) => a.id === v.modelPosterId)?.sourceId).toBe(
      v.modelId,
    );
    expect(v.assets.find((a) => a.id === v.panoramaPosterId)?.sourceId).toBe(
      v.panoramaId,
    );
    expect(v.assets.find((a) => a.id === v.panoramaId)?.capture).toBe(
      "LICENSED_CC0_PHOTOGRAPHY",
    );
    expect(v.humanReviewers).toBeNull();
    expect(v.externalProviderCalls).toBe(0);
    for (const s of v.samples) {
      expect(s.disclosure).toContain("Canlı AI kamera hareketi değildir");
      const video = v.assets.find((a) => a.id === s.outputId)!;
      expect(video.width).toBe(640);
      expect(video.durationSeconds).toBeGreaterThan(4.9);
      expect(video.durationSeconds).toBeLessThanOrEqual(5);
      expect(video.license?.upstreamSha256).toBe(
        v.assets.find((a) => a.id === s.sourceId)?.license?.upstreamSha256,
      );
    }
  });
  it.each([
    "missing-license",
    "false-authorship",
    "remote-source",
    "source-confusion",
    "poster-confusion",
    "global-mislabel",
    "spatial-mislabel",
  ])("rejects %s instead of hiding provenance", (kind) => {
    const r = structuredClone(registry) as unknown as Record<string, unknown>;
    const v = r as unknown as {
      rights: string;
      assets: {
        id: string;
        rights: string;
        license?: { licenseUrl: string; upstreamSha256: string };
        sourceId?: string;
      }[];
      spatialSamples: { product: string; style: string }[];
    };
    const a = v.assets.find((a) => a.id === "cc0-room-source")!;
    if (kind === "missing-license") delete a.license;
    if (kind === "false-authorship") a.rights = "PROJECT_AUTHORED_SYNTHETIC";
    if (kind === "remote-source")
      a.license!.licenseUrl = "https://unverified.invalid/license";
    if (kind === "source-confusion") a.license!.upstreamSha256 = "f".repeat(64);
    if (kind === "poster-confusion")
      v.assets.find((a) => a.id === "model-cover")!.sourceId =
        "cc0-video-premium";
    if (kind === "global-mislabel") v.rights = "PROJECT_AUTHORED_SYNTHETIC";
    if (kind === "spatial-mislabel")
      v.spatialSamples.find((a) => a.product === "tour-360")!.style =
        "authored-synthetic";
    expect(ShowcaseRegistry.safeParse(r).success).toBe(false);
  });
});
