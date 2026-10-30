import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductionFamilyCards } from "@/features/services/production-families";
import { ProductionRequestPanel } from "@/features/services/production-request-panel";
import { LocalSupportTools } from "@/features/services/local-support-tools";
import { api } from "@/features/platform/client";
import type { AssetView, PropertyView } from "@/contracts/platform-ui";
vi.mock("@/features/platform/client", () => ({ api: vi.fn() }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
beforeEach(() => {
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path) =>
    path.startsWith("/production/requests?")
      ? []
      : {
          id: "request-a",
          state: "awaiting-provider-approval",
          message: "İşlem başlamadı; ücret alınmadı.",
        },
  );
});
const property: PropertyView = {
  id: "property-a",
  organization_id: "org-a",
  title: "Synthetic",
  description: "",
  revision: 2,
  archived: false,
  manifest: {
    schemaVersion: 1,
    organizationId: "org-a",
    propertyId: "property-a",
    revision: 2,
    source: "synthetic",
    measuredBy: null,
    evidenceIds: [],
    rooms: [],
    doors: [],
    facts: [],
    pois: [],
    unknownRegions: [],
    dayparts: [],
    calibratedLighting: false,
  },
};
const assets: AssetView[] = [
  {
    id: "photo-a",
    kind: "photo",
    status: "clean",
    bytes: 1234,
    width: 640,
    height: 480,
    clean_hash: "a".repeat(64),
    mime: "image/jpeg",
  },
];
it("offers seven truthful families, separate concepts, and no provider or prompt editor", async () => {
  const user = userEvent.setup(),
    select = vi.fn();
  render(<ProductionFamilyCards onSelect={select} />);
  expect(screen.getAllByRole("article")).toHaveLength(7);
  expect(screen.queryByText("75")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Tercihleri hazırla: Sanal Mobilya" }),
  );
  expect(select).toHaveBeenCalledWith("P03");
  expect(
    screen.getAllByText("Doğrulanmış hizmet sonucu henüz yok.").length,
  ).toBeGreaterThan(0);
  await user.click(
    screen.getByRole("button", { name: "Konsept ve deneysel seçenekler" }),
  );
  expect(screen.getAllByRole("article")).toHaveLength(9);
  expect(document.body.textContent).not.toMatch(
    /kling\/|seedance|nano-banana|negative_prompt|highFidelity/,
  );
});
it("static families never link to a pretend generation API and clearly lack photo outputs", () => {
  render(<ProductionFamilyCards isolated />);
  expect(
    screen.queryByRole("link", { name: /Tercihleri hazırla/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByText("Bu statik gösterimde istek oluşturulamaz."),
  ).toHaveLength(7);
});
it("saves only validated options once, without free text/model/price and without claiming output", async () => {
  const user = userEvent.setup();

  render(
    <ProductionRequestPanel
      serviceId="P03"
      property={property}
      assets={assets}
      disabled={false}
      onBack={vi.fn()}
    />,
  );
  expect(screen.getAllByRole("combobox")).toHaveLength(2);
  expect(
    screen.getByRole("button", { name: "Oluştur — henüz kullanılamıyor" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Tercihleri kaydet" }));
  const writes = vi
    .mocked(api)
    .mock.calls.filter((c) => c[0] === "/production/requests");
  expect(writes).toHaveLength(1);
  const body = writes[0]![1];
  expect(body).toMatchObject({
    serviceId: "P03",
    sourceAssetIds: ["photo-a"],
    maxCostMicroUsd: 0,
    options: { roomType: "Living room", style: "Modern" },
  });
  expect(JSON.stringify(body)).not.toMatch(
    /"prompt"|"provider"|fal\.ai|apiKey/,
  );
  expect(screen.getByRole("status")).toHaveTextContent("İşlem başlamadı");
  expect(
    screen.queryByRole("button", { name: "İndir" }),
  ).not.toBeInTheDocument();
});
it.each(["P07", "P07b"] as const)(
  "%s requires concept permission, surfaces retry without loss, and never enables inference",
  async (serviceId) => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path) => {
      if (path.startsWith("/production/requests?")) return [];
      throw Error("not-exposed-private-error");
    });
    render(
      <ProductionRequestPanel
        serviceId={serviceId}
        property={property}
        assets={assets}
        disabled={false}
        onBack={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Tercihleri kaydet" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Tercihleri kaydet" }));
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "not-exposed-private-error",
    );
    expect(
      screen.getByRole("button", { name: "Tercihleri kaydet" }),
    ).toBeEnabled();
    if (serviceId === "P07")
      expect(screen.getByRole("combobox")).toHaveValue("Modern");
    else {
      expect(screen.getByLabelText("Hedef yüzey")).toHaveValue("wall");
      expect(screen.getByLabelText("Yüzey önerisi")).toHaveValue(
        "warm-white-paint",
      );
    }
  },
);
it("retains private memory-only calculators and resets on modal close", async () => {
  const user = userEvent.setup();
  render(<LocalSupportTools />);
  await user.click(screen.getByText("Hesaplama araçları"));
  await user.click(
    screen.getByRole("button", { name: "Konut kredisi hesaplayıcı" }),
  );
  await screen.findByLabelText("Kredi tutarı (TL)");
  await user.clear(screen.getByLabelText("Kredi tutarı (TL)"));
  await user.type(screen.getByLabelText("Kredi tutarı (TL)"), "12000");
  await user.click(screen.getByRole("button", { name: "Hesaplamayı kapat" }));
  await user.click(
    screen.getByRole("button", { name: "Konut kredisi hesaplayıcı" }),
  );
  expect(await screen.findByLabelText("Kredi tutarı (TL)")).toHaveValue(
    1000000,
  );
});
