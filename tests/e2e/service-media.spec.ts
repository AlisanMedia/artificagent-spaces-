import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { SampleRegistry } from "@/domain/showcase";
const registry = JSON.parse(
  readFileSync("fixtures/showcase-v55/registry.json", "utf8"),
) as SampleRegistry;
test("service covers demonstrate their real media instead of one unrelated room window", async ({
  page,
}) => {
  const privateOrExternal: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (
      u.pathname.startsWith("/api/spaces/") ||
      !["127.0.0.1", "localhost"].includes(u.hostname)
    )
      privateOrExternal.push(u.origin + u.pathname);
  });
  await page.goto("/spaces/showcase");
  await page
    .getByText("Video, 3D ve panorama örneklerini karşılaştır", { exact: true })
    .click();
  const s = registry.samples.find((s) => s.style === "premium")!,
    video = registry.assets.find((a) => a.id === s.outputId)!,
    poster = registry.assets.find((a) => a.id === s.posterId)!;
  const player = page
    .locator('.sc-service[aria-label="AI Emlak Video"]')
    .locator("video");
  await expect(player).toHaveAttribute("src", video.url);
  await expect(player).toHaveAttribute("poster", poster.url);
  await expect(player).toHaveAttribute("preload", "none");
  await expect(player).toHaveAttribute("controls", "");
  await player.evaluate((v) => (v as HTMLVideoElement).play());
  await expect
    .poll(() => player.evaluate((v) => (v as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.1);
  await player.evaluate((v) => (v as HTMLVideoElement).pause());
  const model = registry.assets.find((a) => a.id === registry.modelPosterId)!,
    pano = registry.assets.find((a) => a.id === registry.panoramaPosterId)!;
  await expect(
    page.locator('.sc-service[aria-label="AI 3D Deneyim"]').locator("img"),
  ).toHaveAttribute("src", model.url);
  await expect(
    page.locator('.sc-service[aria-label="360° Sanal Tur"]').locator("img"),
  ).toHaveAttribute("src", pano.url);
  expect(new Set([poster.url, model.url, pano.url]).size).toBe(3);
  await page
    .getByRole("radio", { name: "Premium Sinematik", exact: true })
    .check();
  const gallery = page
    .locator(".sc-gallery")
    .getByLabel("Premium Sinematik hazır örnek videosu");
  await expect(gallery).toHaveAttribute("src", video.url);
  await expect(page.locator(".sc-gallery .sc-disclosure")).toContainText(
    "Canlı AI kamera hareketi değildir",
  );
  await page
    .locator(".sc-gallery")
    .getByText("Örneğin kaynağı ve kullanım hakkı", { exact: true })
    .click();
  await expect(
    page
      .locator(".sc-gallery")
      .getByRole("link", { name: /Poly Haven · Sergej Majboroda/ }),
  ).toHaveAttribute("href", "https://polyhaven.com/a/brown_photostudio_04");
  expect(privateOrExternal).toEqual([]);
});
