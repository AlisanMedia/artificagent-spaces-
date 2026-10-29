import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  ApiFirstControls,
  StudioProductSelector,
} from "@/features/platform/api-first-controls";
import { StudioPreviewRail } from "@/features/platform/studio-preview-rail";

const common = {
  styleId: "natural" as const,
  onStyle: vi.fn(),
  aspect: "9:16" as const,
  onAspect: vi.fn(),
  duration: 30 as const,
  onDuration: vi.fn(),
  photoCount: 2,
  plan: null,
  busy: false,
  canEdit: true,
  onPlan: vi.fn(),
  onCreateLocal: vi.fn(),
  panoramaConfirmed: false,
  onPanoramaConfirmed: vi.fn(),
};
describe("V5.4 customer-facing controls", () => {
  it("exposes three distinct products and four fixed style choices without prompts or provider identities", async () => {
    const user = userEvent.setup(),
      selected = vi.fn();
    render(
      <>
        <StudioProductSelector
          value="video"
          onSelect={selected}
          disabled={false}
        />
        <ApiFirstControls product="video" {...common} />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "AI 3D Deneyim" }));
    expect(selected).toHaveBeenCalledWith("ai-3d");
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    await user.click(screen.getByRole("radio", { name: /Premium Sinematik/ }));
    expect(common.onStyle).toHaveBeenCalledWith("premium");
    expect(
      screen.getByText("30 saniye için 6 farklı fotoğraf gerekir."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "AI üretimi kapalı" }),
    ).toBeDisabled();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.body.textContent).not.toMatch(
      /Kling|Seedance|Marble|fal\.ai|property-video-v1/,
    );
  });
  it("requires explicit panorama confirmation and preserves the real-versus-estimated distinction", async () => {
    const user = userEvent.setup(),
      confirm = vi.fn();
    const { rerender } = render(
      <ApiFirstControls
        product="tour-360"
        {...common}
        onPanoramaConfirmed={confirm}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Seçimlerimi kontrol et",
      }),
    ).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    expect(confirm).toHaveBeenCalledWith(true);
    rerender(
      <ApiFirstControls
        product="tour-360"
        {...common}
        panoramaConfirmed
        onPanoramaConfirmed={confirm}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Seçimlerimi kontrol et",
      }),
    ).toBeEnabled();
    expect(
      screen.getByText(/Türkçe tur dili sağlayıcıda belgelenmedi/),
    ).toBeVisible();
  });
  it("keeps panorama confirmation mandatory when entering the guided request summary", async () => {
    const user = userEvent.setup(),
      onPlan = vi.fn(),
      onContinue = vi.fn();
    const { rerender } = render(
      <ApiFirstControls
        product="tour-360"
        {...common}
        onPlan={onPlan}
        onContinue={onContinue}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Seçimlerimi kontrol et" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "İsteği gözden geçir" }),
    ).toBeDisabled();
    rerender(
      <ApiFirstControls
        product="tour-360"
        {...common}
        panoramaConfirmed
        onPlan={onPlan}
        onContinue={onContinue}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Seçimlerimi kontrol et" }),
    );
    await user.click(
      screen.getByRole("button", { name: "İsteği gözden geçir" }),
    );
    expect(onPlan).toHaveBeenCalledOnce();
    expect(onContinue).toHaveBeenCalledOnce();
  });
  it("never relabels a pre-generated sample as a result of user-selected files", () => {
    render(
      <StudioPreviewRail
        product="video"
        styleId="premium"
        job={null}
        preview=""
        property={null}
        assets={[]}
        thumbnails={{}}
        aspect="9:16"
      />,
    );
    const video = screen.getByLabelText(
      "Premium Sinematik hazır sentetik örnek videosu",
    );
    expect(video.getAttribute("src")).toBe("/showcase-v55/premium.mp4");
    expect(screen.getByText(/seçtiğin dosyadan oluşturulmadı/)).toBeVisible();
    expect(screen.queryByLabelText("Oluşturulan video önizlemesi")).toBeNull();
  });
});
