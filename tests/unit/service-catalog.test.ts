import { describe, expect, it } from "vitest";
import {
  SERVICES,
  SERVICE_CATEGORIES,
  SERVICE_CATALOG_VERSION,
  findServices,
  serviceById,
  serviceProduct,
  serviceStatus,
  validateServiceCatalog,
  type CatalogService,
} from "@/domain/service-catalog";
describe("versioned service catalogue, never a provider entitlement", () => {
  it("has unique, frozen, source-linked services in all six groups", () => {
    expect(SERVICE_CATALOG_VERSION).toBe("spaces-services-v1");
    expect(new Set(SERVICES.map((s) => s.id)).size).toBe(SERVICES.length);
    expect(validateServiceCatalog(SERVICES)).toBe(SERVICES);
    expect(Object.isFrozen(SERVICES)).toBe(true);
    for (const c of SERVICE_CATEGORIES)
      expect(SERVICES.some((s) => s.category === c.id)).toBe(true);
    for (const s of SERVICES) {
      expect(Object.isFrozen(s)).toBe(true);
      expect(Object.isFrozen(s.action)).toBe(true);
      expect(Object.isFrozen(s.sources)).toBe(true);
      expect(s.disclosure.length).toBeGreaterThan(30);
      expect(serviceById(s.id)).toBe(s);
      expect(serviceStatus(s)).toBeTruthy();
    }
  });
  it("only connects two existing video paths, two genuine samples and two local calculations", () => {
    expect(
      SERVICES.filter((s) => s.action.kind !== "PLANNED").map((s) => s.id),
    ).toEqual([
      "listing-video",
      "social-video",
      "ai-3d-tour",
      "panorama-tour",
      "mortgage",
      "rental-yield",
    ]);
    expect(serviceProduct(serviceById("listing-video")!)).toBe("video");
    expect(serviceProduct(serviceById("social-video")!)).toBe("video");
    expect(serviceProduct(serviceById("ai-3d-tour")!)).toBe("ai-3d");
    expect(serviceProduct(serviceById("panorama-tour")!)).toBe("tour-360");
    expect(serviceProduct(serviceById("mortgage")!)).toBeNull();
    expect(serviceProduct(serviceById("virtual-staging")!)).toBeNull();
    expect(serviceById("__proto__")).toBeUndefined();
  });
  it("searches Turkish letters and uppercase without requiring accents", () => {
    expect(findServices("SANAL MOBİLYA", "all").map((s) => s.id)).toContain(
      "virtual-staging",
    );
    expect(findServices("yuksek cozunurluk", "photo").map((s) => s.id)).toEqual(
      ["photo-upscale"],
    );
    expect(findServices("  ", "all")).toHaveLength(SERVICES.length);
    expect(findServices("not-a-service", "all")).toEqual([]);
    expect(findServices("", "photo", true)).toEqual([]);
    expect(findServices("", "analysis", true).map((s) => s.id)).toEqual([
      "mortgage",
      "rental-yield",
    ]);
    expect(findServices("", "all", true)).toHaveLength(6);
    expect(findServices("kredi ".repeat(500), "all")).toHaveLength(1);
    expect(findServices("", "forged" as "all")).toEqual([]);
  });
  it.each([
    [{ id: "../secret" }, "SERVICE_CATALOG_ID_INVALID"],
    [{ category: "inference" }, "SERVICE_CATALOG_INCOMPLETE"],
    [{ title: "  " }, "SERVICE_CATALOG_INCOMPLETE"],
    [{ sources: [] }, "SERVICE_CATALOG_INCOMPLETE"],
    [{ sources: ["unverified-provider"] }, "SERVICE_CATALOG_INCOMPLETE"],
    [{ action: { kind: "LIVE_API" } }, "SERVICE_CATALOG_ACTION_DENIED"],
    [
      { action: { kind: "LOCAL_VIDEO", product: "video" } },
      "SERVICE_CATALOG_ACTION_DENIED",
    ],
    [
      { action: { kind: "LOCAL_SAMPLE", product: "ai-3d" } },
      "SERVICE_CATALOG_ACTION_DENIED",
    ],
    [
      { action: { kind: "LOCAL_CALCULATOR", tool: "mortgage" } },
      "SERVICE_CATALOG_ACTION_DENIED",
    ],
    [
      {
        id: "forged-tool",
        action: { kind: "LOCAL_CALCULATOR", tool: "forged-tool" },
      },
      "SERVICE_CATALOG_ACTION_DENIED",
    ],
  ])(
    "rejects invalid catalogue data instead of enabling an unrelated workflow: %j",
    (patch, error) => {
      const forged = {
        ...serviceById("virtual-staging")!,
        ...patch,
      } as CatalogService;
      expect(() => validateServiceCatalog([forged])).toThrow(error);
    },
  );
  it("rejects duplicate IDs, wrong sample-to-product binding and wrong video product", () => {
    const source = serviceById("listing-video")!;
    expect(() => validateServiceCatalog([source, source])).toThrow(
      "SERVICE_CATALOG_ID_INVALID",
    );
    expect(() =>
      validateServiceCatalog([
        {
          ...source,
          action: { kind: "LOCAL_VIDEO", product: "ai-3d" },
        } as unknown as CatalogService,
      ]),
    ).toThrow("SERVICE_CATALOG_ACTION_DENIED");
    expect(() =>
      validateServiceCatalog([
        {
          ...serviceById("ai-3d-tour")!,
          action: { kind: "LOCAL_SAMPLE", product: "tour-360" },
        },
      ]),
    ).toThrow("SERVICE_CATALOG_ACTION_DENIED");
  });
  it("keeps architecture, rights, safety and live-service caveats attached to risky services", () => {
    expect(serviceById("owned-mark-cleanup")!.disclosure).toMatch(
      /zorunlu AI etiketi kaldırılamaz/,
    );
    expect(serviceById("interior-concept")!.disclosure).toMatch(
      /gerçek metrekare/,
    );
    expect(serviceById("seismic-sources")!.disclosure).toMatch(
      /bina güvenliği raporu değildir/,
    );
    expect(serviceById("ai-3d-tour")!.disclosure).toMatch(/kapalıdır/);
    expect(serviceById("panorama-tour")!.input).toMatch(/2:1/);
    expect(serviceById("guided-tour")!.disclosure).toMatch(
      /gerçek ElevenLabs oturumu kapalıdır/,
    );
    expect(serviceById("guided-tour")!.sources).toEqual(["owner-baseline"]);
  });
});
