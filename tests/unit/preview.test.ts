import { describe, expect, it } from "vitest";
import { DeterministicPlanningAdapter } from "@/adapters/fake/planning-adapter";
import { SyntheticPropertyCatalog } from "@/adapters/fake/property-catalog";
import { preparePreview } from "@/application/prepare-preview";
import { defaultConfiguration, MODE_DEFINITIONS } from "@/domain/modes";
import type { AssetId, GenerationConfiguration, PreviewRequest, PropertyId } from "@/domain/types";
import { ATELIER_ORG, STUDIO_ORG, SYNTHETIC_PROPERTIES } from "@/fixtures/properties";

const catalog = new SyntheticPropertyCatalog();
const adapter = new DeterministicPlanningAdapter();
const scope = { organizationId: STUDIO_ORG };
const property = SYNTHETIC_PROPERTIES[0]!;
function request(overrides: Partial<PreviewRequest> = {}): PreviewRequest {
  return { organizationId: STUDIO_ORG, propertyId: property.id, sourceAssetIds: property.media.map((asset) => asset.id), configuration: defaultConfiguration("pov"), ...overrides };
}

describe("synthetic catalog scope", () => {
  it("separates the two fixture collections without claiming authentication", () => {
    expect(catalog.list(scope)).toHaveLength(3);
    expect(catalog.list({ organizationId: ATELIER_ORG })).toHaveLength(1);
    expect(catalog.get(scope, "suite" as PropertyId)).toBeUndefined();
    expect(catalog.get({ organizationId: ATELIER_ORG }, property.id)).toBeUndefined();
  });
  it("returns no record for an unknown property", () => {
    expect(catalog.get(scope, "does-not-exist" as PropertyId)).toBeUndefined();
    expect(new SyntheticPropertyCatalog([]).list(scope)).toEqual([]);
  });
});

describe("preview policy", () => {
  it.each(MODE_DEFINITIONS)("creates only a zero-cost local $id plan", ({ id }) => {
    const result = preparePreview(scope, request({ configuration: defaultConfiguration(id) }), catalog, adapter);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a preview");
    expect(result.value).toMatchObject({
      syntheticOnly: true, actualCostMicroUsd: 0, adapter: "deterministic-local-fake",
      kind: id === "interactive-3d" ? "scene-plan" : "storyboard",
    });
    expect(result.value.shots).toHaveLength(4);
    expect(result.value.disclosure).toContain("üretilmemiştir");
    expect(JSON.stringify(result.value)).not.toMatch(/https?:|\.mp4|signedUrl|apiKey/);
  });
  it("rejects a request whose organization disagrees with the active scope", () => {
    expect(preparePreview(scope, request({ organizationId: ATELIER_ORG }), catalog, adapter)).toMatchObject({ ok: false, error: { code: "TENANT_SCOPE_MISMATCH" } });
  });
  it("rejects another workspace's property and unknown properties", () => {
    for (const propertyId of ["suite", "missing"]) {
      expect(preparePreview(scope, request({ propertyId: propertyId as PropertyId }), catalog, adapter)).toMatchObject({ ok: false, error: { code: "PROPERTY_NOT_AVAILABLE" } });
    }
  });
  it.each([
    [],
    ["missing"],
    ["atrium-image-1", "atrium-image-1"],
    ["atrium-image-1", "suite-image-1"],
    ["atrium-plan"],
  ].map((ids) => ({ ids })))("rejects invalid source selection: $ids", ({ ids }) => {
    expect(preparePreview(scope, request({ sourceAssetIds: ids as AssetId[] }), catalog, adapter)).toMatchObject({ ok: false, error: { code: "SOURCE_NOT_AVAILABLE" } });
  });
  it("does not allow a non-synthetic source even in a same-tenant record", () => {
    const unsafe = { ...property, media: property.media.map((asset) => ({ ...asset, source: "customer" })) } as unknown as typeof property;
    const unsafeCatalog = new SyntheticPropertyCatalog([unsafe]);
    expect(preparePreview(scope, request(), unsafeCatalog, adapter)).toMatchObject({ ok: false, error: { code: "SOURCE_NOT_AVAILABLE" } });
  });
  it("rejects an asset record belonging to another organization", () => {
    const unsafe = { ...property, media: property.media.map((asset) => ({ ...asset, organizationId: ATELIER_ORG })) };
    expect(preparePreview(scope, request(), new SyntheticPropertyCatalog([unsafe]), adapter).ok).toBe(false);
  });
  it("rejects 3D when a measured plan is missing from the property", () => {
    const linea = catalog.get(scope, "linea" as PropertyId)!;
    const result = preparePreview(scope, request({ propertyId: linea.id, sourceAssetIds: linea.media.map((asset) => asset.id), configuration: defaultConfiguration("interactive-3d") }), catalog, adapter);
    expect(result).toMatchObject({ ok: false, error: { code: "INSUFFICIENT_EVIDENCE" } });
  });
  it("rejects 3D when the existing plan is deselected", () => {
    const sourceAssetIds = property.media.filter((asset) => asset.kind !== "floor-plan").map((asset) => asset.id);
    expect(preparePreview(scope, request({ sourceAssetIds, configuration: defaultConfiguration("interactive-3d") }), catalog, adapter)).toMatchObject({ ok: false, error: { code: "INSUFFICIENT_EVIDENCE" } });
  });
  it("validates configuration before asking the adapter to plan", () => {
    expect(preparePreview(scope, request({ configuration: { mode: "pov", durationSeconds: 600 } as unknown as GenerationConfiguration }), catalog, adapter)).toMatchObject({ ok: false, error: { code: "INVALID_CONFIGURATION" } });
  });
  it("does not fall through to a provider that does not support a mode", () => {
    const limitedAdapter = { id: adapter.id, supportedModes: [] as const, plan: adapter.plan.bind(adapter) };
    expect(preparePreview(scope, request(), catalog, limitedAdapter)).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_SETTING" } });
  });
});

describe("deterministic fake adapter", () => {
  it("has the same result and ID for repeated equivalent requests", () => {
    const a = preparePreview(scope, request(), catalog, adapter);
    const b = preparePreview(scope, request({ sourceAssetIds: [...request().sourceAssetIds].reverse() }), catalog, adapter);
    expect(a).toEqual(b);
  });
  it("changes the ID when a meaningful creative setting changes", () => {
    const a = preparePreview(scope, request(), catalog, adapter);
    const b = preparePreview(scope, request({ configuration: { mode: "pov", durationSeconds: 60, aspectRatio: "16:9", cameraPace: "calm" } }), catalog, adapter);
    expect(a.ok && b.ok && a.value.id !== b.value.id).toBe(true);
  });
  it("does not mutate the request or fixture while planning", () => {
    const input = request();
    const before = JSON.stringify({ input, property });
    preparePreview(scope, input, catalog, adapter);
    expect(JSON.stringify({ input, property })).toBe(before);
  });
  it("handles a minimal fixture without room labels with a property-name fallback", () => {
    const minimal = { ...property, roomLabels: [] };
    const result = preparePreview(scope, request({ sourceAssetIds: [property.media[0]!.id] }), new SyntheticPropertyCatalog([minimal]), adapter);
    expect(result.ok && result.value.shots.every((shot) => shot.roomLabel === property.name)).toBe(true);
  });
});
