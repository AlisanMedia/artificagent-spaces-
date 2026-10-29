import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ServiceExplorer } from "@/features/services/service-explorer";
beforeAll(() => {
  // jsdom has no modal top layer; real focus/ESC behavior is covered in Playwright.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
async function open() {
  const user = userEvent.setup();
  await user.click(screen.getByText("Tüm hizmetleri keşfet"));
  return user;
}
describe("progressive service discovery", () => {
  it("keeps server-rendered discovery inert and does not hydrate unseen service cards", () => {
    const html = renderToString(<ServiceExplorer />);
    expect(html).toContain('inert=""');
    expect(html).toContain('data-ready="false"');
    expect(html).not.toContain('aria-label="Hizmet kataloğu"');
    render(<ServiceExplorer />);
    const explorer = screen
      .getByText("Tüm hizmetleri keşfet")
      .closest(".sv-explorer");
    expect(explorer).toHaveAttribute("data-ready", "true");
    expect(explorer).not.toHaveAttribute("inert");
  });
  it("starts collapsed, shows at most six services, and searches Turkish without extra navigation", async () => {
    render(<ServiceExplorer />);
    expect(
      screen.queryByRole("region", { name: "Hizmet kataloğu" }),
    ).not.toBeInTheDocument();
    const user = await open();
    expect(
      screen.getAllByRole("button", { name: /hakkında bilgi/ }),
    ).toHaveLength(6);
    await user.click(
      screen.getByRole("button", { name: "Diğer hizmetleri göster" }),
    );
    expect(
      screen.getAllByRole("button", { name: /hakkında bilgi/ }),
    ).toHaveLength(12);
    await user.type(screen.getByRole("searchbox"), "SANAL MOBİLYA");
    expect(
      screen.getAllByRole("button", { name: /hakkında bilgi/ }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Sanal mobilya yerleşimi" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "360° sanal dekorasyon" }),
    ).toBeVisible();
  });
  it("a pending service has meaningful requirements and no upload, fake output or create action", async () => {
    const select = vi.fn(),
      inspect = vi.fn();
    render(<ServiceExplorer onSelect={select} onInspect={inspect} />);
    const user = await open();
    await user.selectOptions(screen.getByLabelText("Hizmet türü"), "photo");
    await user.click(
      screen.getByRole("button", {
        name: "Detayları gör: Fotoğraf iyileştirme hakkında bilgi",
      }),
    );
    const modal = screen.getByRole("dialog");
    expect(modal).toHaveTextContent("oluşturma henüz kullanılamıyor");
    expect(modal).toHaveTextContent("Dosya yükleme veya ödeme başlatılmaz");
    expect(
      within(modal).queryByRole("button", { name: /oluştur|dene|yükle/i }),
    ).not.toBeInTheDocument();
    expect(modal.querySelector('input[type="file"], video, canvas')).toBeNull();
    await user.click(
      within(modal).getByRole("button", { name: "Hizmet bilgisini kapat" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
    expect(inspect).not.toHaveBeenCalled();
  });
  it("filters availability, handles empty searches, and clears without persisting an identity", async () => {
    render(<ServiceExplorer />);
    const user = await open();
    await user.click(screen.getByLabelText("Yalnız şimdi denenebilenler"));
    expect(
      screen.getAllByRole("button", { name: /hakkında bilgi/ }),
    ).toHaveLength(6);
    await user.type(screen.getByRole("searchbox"), "<script>alert(1)</script>");
    expect(screen.getByText(/Bu aramada hizmet bulunamadı/)).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Filtreleri temizle" }),
    );
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(
      screen.getByLabelText("Yalnız şimdi denenebilenler"),
    ).not.toBeChecked();
  });
  it("only opens the exact existing sample product", async () => {
    const inspect = vi.fn();
    render(<ServiceExplorer onInspect={inspect} />);
    const user = await open();
    await user.selectOptions(screen.getByLabelText("Hizmet türü"), "tour");
    await user.click(
      screen.getByRole("button", {
        name: "Detayları gör: 360° sanal tur hakkında bilgi",
      }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("2:1");
    await user.click(screen.getByRole("button", { name: "Hazır örneği aç" }));
    expect(inspect).toHaveBeenCalledExactlyOnceWith("tour-360");
  });
  it("keeps local studio selection behind its disabled state", async () => {
    const select = vi.fn();
    render(<ServiceExplorer onSelect={select} disabled />);
    const user = await open();
    await user.click(
      screen.getByRole("button", {
        name: "Detayları gör: Emlak tanıtım videosu hakkında bilgi",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Yerel stüdyoda dene" }),
    );
    expect(select).not.toHaveBeenCalled();
  });
  it("selects only the existing local video workflow and keeps anonymous links local", async () => {
    const select = vi.fn();
    const view = render(<ServiceExplorer onSelect={select} />);
    let user = await open();
    await user.click(
      screen.getByRole("button", {
        name: "Detayları gör: Emlak tanıtım videosu hakkında bilgi",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Yerel stüdyoda dene" }),
    );
    expect(select).toHaveBeenCalledExactlyOnceWith("video");
    view.unmount();
    render(<ServiceExplorer />);
    user = await open();
    await user.click(
      screen.getByRole("button", {
        name: "Detayları gör: Emlak tanıtım videosu hakkında bilgi",
      }),
    );
    expect(
      screen.getByRole("link", { name: "Yerel stüdyoda dene" }),
    ).toHaveAttribute("href", "/spaces?service=video");
    expect(
      screen.getByRole("link", { name: "Hazır örneği aç" }),
    ).toHaveAttribute("href", "/spaces/showcase?product=video#ornekler");
  });
  it("does not advertise local rendering as available on an isolated static preview", async () => {
    render(<ServiceExplorer isolated />);
    const user = await open();
    await user.click(
      screen.getByRole("button", {
        name: "Detayları gör: Emlak tanıtım videosu hakkında bilgi",
      }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "dosyadan yeni video oluşturmaz",
    );
    expect(
      screen.queryByRole("link", { name: "Yerel stüdyoda dene" }),
    ).not.toBeInTheDocument();
  });
  it("calculates a local loan and clears the stale answer when inputs change", async () => {
    render(<ServiceExplorer />);
    const user = await open();
    await user.selectOptions(screen.getByLabelText("Hizmet türü"), "analysis");
    await user.click(
      screen.getByRole("button", {
        name: "Detayları gör: Konut kredisi hesaplayıcı hakkında bilgi",
      }),
    );
    const price = await screen.findByLabelText("Kredi tutarı (TL)");
    fireEvent.change(price, { target: { value: "100000" } });
    fireEvent.change(screen.getByLabelText("Aylık nominal faiz (%)"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Vade (ay)"), {
      target: { value: "12" },
    });
    await user.click(screen.getByRole("button", { name: "Hesapla" }));
    expect(screen.getByText("Girilen senaryonun sonucu")).toBeVisible();
    expect(screen.getByRole("dialog")).toHaveTextContent("8.884,88");
    fireEvent.change(price, { target: { value: "200000" } });
    expect(
      screen.queryByText("Girilen senaryonun sonucu"),
    ).not.toBeInTheDocument();
  });
  it("keeps rental losses visible instead of fabricating positive payback", async () => {
    render(<ServiceExplorer />);
    const user = await open();
    await user.selectOptions(screen.getByLabelText("Hizmet türü"), "analysis");
    await user.click(
      screen.getByRole("button", {
        name: "Detayları gör: Kira getirisi senaryosu hakkında bilgi",
      }),
    );
    fireEvent.change(await screen.findByLabelText("Yılda dolu kalacak ay"), {
      target: { value: "0" },
    });
    await user.click(screen.getByRole("button", { name: "Hesapla" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Bu senaryoda pozitif geri dönüş yok",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("-₺12.000,00");
  });
});
