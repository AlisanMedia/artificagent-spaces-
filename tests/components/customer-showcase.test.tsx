import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { ServiceCards } from "@/features/showcase/customer-showcase";
import { VideoExample } from "@/features/showcase/video-example";
import { sampleAsset, showcaseMedia } from "@/features/showcase/media";
describe("customer controls", () => {
  it("uses a native labeled range with real linked image files and fails on image decode errors", () => {
    const before = sampleAsset(showcaseMedia.comparison.beforeId)!,
      after = sampleAsset(showcaseMedia.comparison.afterId)!,
      source = sampleAsset(showcaseMedia.comparison.sourceId)!;
    render(
      <BeforeAfterSlider
        before={before}
        after={after}
        source={source}
        disclosure="Düzenlenmiş sentetik örnek"
      />,
    );
    const range = screen.getByRole("slider");
    expect(range).toHaveValue("50");
    fireEvent.change(range, { target: { value: "73" } });
    expect(range).toHaveAttribute("aria-valuetext", "Sonra görüntüsü yüzde 73");
    fireEvent.error(screen.getByAltText(/Aynı kaynak ve kadraj/));
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("doğrulanamadı");
  });
  it("does not render a comparison for a different property", () => {
    const b = sampleAsset(showcaseMedia.comparison.beforeId)!,
      a = sampleAsset(showcaseMedia.comparison.afterId)!,
      s = sampleAsset(showcaseMedia.comparison.sourceId)!;
    render(
      <BeforeAfterSlider
        before={b}
        after={{ ...a, cameraId: "forged" }}
        source={s}
        disclosure="Örnek"
      />,
    );
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });
  it("all three service cards select and inspect their exact product", async () => {
    const select = vi.fn(),
      inspect = vi.fn(),
      user = userEvent.setup();
    render(<ServiceCards onSelect={select} onInspect={inspect} />);
    for (const [name, id] of [
      ["AI Emlak Video", "video"],
      ["AI 3D Deneyim", "ai-3d"],
      ["360° Sanal Tur", "tour-360"],
    ] as const) {
      const card = screen.getByRole("article", { name });
      await user.click(
        within(card).getByRole("button", { name: /Bu Hizmeti Seç/ }),
      );
      expect(select).toHaveBeenLastCalledWith(id);
      await user.click(
        within(card).getByRole("button", { name: /Örneği İncele/ }),
      );
      expect(inspect).toHaveBeenLastCalledWith(id);
    }
  });
  it("a broken MP4 never remains a fake working player", () => {
    render(<VideoExample style="exterior" />);
    const v = screen.getByLabelText("Dış Cephe hazır örnek videosu");
    expect(v).toHaveAttribute("src", "/showcase-v55/cc0-exterior.mp4");
    fireEvent.error(v);
    expect(
      screen.queryByLabelText("Dış Cephe hazır örnek videosu"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("açılamıyor");
  });
});
