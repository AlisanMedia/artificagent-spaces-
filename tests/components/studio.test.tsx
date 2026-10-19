import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Studio } from "@/features/studio";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { MODE_DEFINITIONS } from "@/domain/modes";

vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => {
  const safe = { ...props };
  delete safe["unoptimized"]; delete safe["priority"]; delete safe["fill"];
  // A DOM image keeps the fixture alt text visible to accessibility assertions.
  return <img {...safe} />;
} }));

describe("four local studio flows", () => {
  it.each(MODE_DEFINITIONS)("requires explicit acknowledgement and produces a $name plan", async ({ id }) => {
    const user = userEvent.setup();
    render(<WorkspaceProvider><Studio initialMode={id} /></WorkspaceProvider>);
    expect(screen.getByRole("radio", { name: new RegExp("^" + (id === "interactive-3d" ? "Interactive 3D" : id), "i") })).toBeChecked();
    await user.click(screen.getByRole("button", { name: /Devam et/ }));
    await user.click(screen.getByRole("button", { name: /Devam et/ }));
    const create = screen.getByRole("button", { name: /Yerel önizlemeyi hazırla/ });
    expect(create).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /yerel bir plan olduğunu anladım/ }));
    await user.click(create);
    const result = screen.getByTestId("preview-result");
    expect(within(result).getByRole("status")).toHaveTextContent("Video veya gezilebilir 3D üretilmemiştir");
    expect(within(result).getByRole("button", { name: /Planı JSON olarak indir/ })).toBeEnabled();
    expect(result.querySelector("video")).toBeNull();
    expect(result.querySelector("canvas")).toBeNull();
  });
  it("blocks a 3D flow whose selected property has no measured plan", async () => {
    const user = userEvent.setup();
    render(<WorkspaceProvider><Studio initialMode="interactive-3d" initialPropertyId="linea" /></WorkspaceProvider>);
    expect(screen.getByRole("status")).toHaveTextContent("ölçülü plan gerekli");
    expect(screen.getByRole("button", { name: /Devam et/ })).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox", { name: "Örnek mülk" }), "atrium");
    expect(screen.getByRole("button", { name: /Devam et/ })).toBeEnabled();
  });
  it("shows a fail-closed source error if the 3D plan is deselected", async () => {
    const user = userEvent.setup();
    render(<WorkspaceProvider><Studio initialMode="interactive-3d" /></WorkspaceProvider>);
    await user.click(screen.getByRole("button", { name: /Devam et/ }));
    await user.click(screen.getByRole("checkbox", { name: /Sentetik ölçülü plan/ }));
    await user.click(screen.getByRole("button", { name: /Devam et/ }));
    await user.click(screen.getByRole("checkbox", { name: /yerel bir plan olduğunu anladım/ }));
    await user.click(screen.getByRole("button", { name: /Yerel önizlemeyi hazırla/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("örnek ölçülü plan gerekli");
    expect(screen.queryByTestId("preview-result")).not.toBeInTheDocument();
  });
});
