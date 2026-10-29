import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import type { SampleRegistry } from "@/domain/showcase";
const registry = JSON.parse(
  readFileSync("fixtures/showcase-v55/registry.json", "utf8"),
) as SampleRegistry;
const viewportWidths = [375, 390, 430, 768, 1024, 1280, 1440];
test("V5.5 public discovery is source-only, responsive and has real service navigation", async ({
  page,
}) => {
  const privateRequests: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/spaces"))
      privateRequests.push(r.url());
  });
  await page.goto("/spaces/showcase");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Gayrimenkullerinizi",
  );
  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(privateRequests).toEqual([]);
  await page.getByRole("button", { name: "Giriş Yap", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Giriş Yap", exact: true }),
  ).toBeFocused();
  const card = page.getByRole("article", { name: "360° Sanal Tur" });
  await card.getByRole("link", { name: /Bu Hizmeti Seç/ }).click();
  await expect(page).toHaveURL(/service=tour-360/);
  await expect(page.getByText(/360° tur için gerçek 2:1/)).toBeVisible();
});
test("V5.5 all four styles play the exact measured sample with the matching source", async ({
  page,
}) => {
  await page.goto("/spaces/showcase");
  const labels = {
    natural: "Doğal Tur",
    premium: "Premium Sinematik",
    explore: "Mekânı Keşfet",
    exterior: "Dış Cephe",
  };
  for (const sample of registry.samples) {
    const style = sample.style as keyof typeof labels;
    await page.getByRole("radio", { name: labels[style], exact: true }).check();
    const video = page
      .getByLabel(`${labels[style]} hazır sentetik örnek videosu`)
      .last();
    const a = registry.assets.find((a) => a.id === sample.outputId)!;
    await expect(video).toHaveAttribute("src", a.url);
    await video.evaluate((v) => (v as HTMLVideoElement).play());
    await expect
      .poll(() => video.evaluate((v) => (v as HTMLVideoElement).currentTime))
      .toBeGreaterThan(0.1);
    const m = await video.evaluate((v) => {
      const x = v as HTMLVideoElement;
      x.pause();
      return {
        width: x.videoWidth,
        height: x.videoHeight,
        duration: x.duration,
        controls: x.controls,
      };
    });
    expect(m.width).toBe(a.width);
    expect(m.height).toBe(a.height);
    expect(m.duration).toBeCloseTo(a.durationSeconds!, 2);
    expect(m.controls).toBe(true);
    const source = registry.assets.find((a) => a.id === sample.sourceId)!;
    await expect(
      page.locator(".sc-gallery .sc-video-example img"),
    ).toHaveAttribute("src", source.url);
  }
  await expect(page.locator(".sc-gallery .sc-disclosure")).toContainText(
    "Seçtiğin dosyadan oluşturulmadı",
  );
});
test("V5.5 comparison uses native mouse/touch/keyboard range with unchanged source geometry", async ({
  page,
  isMobile,
}) => {
  await page.goto("/spaces/showcase");
  const slider = page.getByRole("slider", {
    name: "Önce ve sonra karşılaştırması",
  });
  await slider.scrollIntoViewIfNeeded();
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("0");
  await page.keyboard.press("End");
  await expect(slider).toHaveValue("100");
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveValue("99");
  const box = (await slider.boundingBox())!;
  if (isMobile)
    await page.touchscreen.tap(box.x + box.width * 0.3, box.y + box.height / 2);
  else {
    await page.mouse.move(box.x + box.width * 0.99, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
  }
  expect(Number(await slider.inputValue())).toBeLessThan(70);
  const sizes = await page
    .locator(".sc-comparison-frame img")
    .evaluateAll((imgs) => imgs.map((i) => [i.clientWidth, i.clientHeight]));
  expect(sizes[0]).toEqual(sizes[1]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("V5.5 separate 3D and genuine equirectangular viewers load only on request", async ({
  page,
}) => {
  await page.goto("/spaces/showcase");
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "3D örneği", exact: true }).click();
  await page
    .getByRole("button", { name: "3D örneğini başlat", exact: true })
    .click();
  await expect(page.locator(".scene-canvas")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 30000 },
  );
  await page.getByLabel("Günün zamanı").selectOption("evening");
  await expect(page.getByLabel("Günün zamanı")).toHaveValue("evening");
  await expect(page.locator(".sc-gallery .sc-disclosure")).toContainText(
    "Canlı AI üretimi",
  );
  await page.getByRole("button", { name: "360° örneği", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page
    .getByRole("button", { name: "360° örneğini başlat", exact: true })
    .click();
  await expect(page.locator(".sc-panorama-canvas")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 30000 },
  );
  await expect(page.locator(".sc-panorama canvas")).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByText("Salon · 360° sentetik panorama", { exact: false }),
  ).toBeVisible();
  const surface = page.getByRole("region", { name: /360° salon panoraması/ });
  await surface.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Home");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Örneği kapat", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
});
test("V5.5 missing video and panorama fail closed, never show fake success", async ({
  page,
}) => {
  await page.route("**/showcase-v55/exterior.mp4", (r) => r.abort());
  await page.goto("/spaces/showcase");
  await page.getByRole("radio", { name: "Dış Cephe", exact: true }).check();
  const v = page.getByLabel("Dış Cephe hazır sentetik örnek videosu");
  await v.evaluate((v) => (v as HTMLVideoElement).load());
  await expect(page.locator(".sc-gallery").getByRole("alert")).toContainText(
    "açılamıyor",
  );
  await page.route("**/showcase-v55/living-panorama.jpg", (r) => r.abort());
  await page.getByRole("button", { name: "360° örneği", exact: true }).click();
  await page
    .getByRole("button", { name: "360° örneğini başlat", exact: true })
    .click();
  await expect(page.locator(".sc-gallery").getByRole("alert")).toContainText(
    "360° örneği açılamadı",
  );
});
test("V5.5 four steps preserve drafts and closed provider actions", async ({
  page,
}) => {
  await page.goto("/spaces");
  await expect(
    page.getByRole("list", { name: "İçerik oluşturma adımları" }).locator("li"),
  ).toHaveCount(4);
  await page
    .getByRole("button", { name: "Örnek mülkle dene", exact: true })
    .click();
  await expect(page.getByRole("radio", { name: /Doğal Tur/ })).toBeChecked();
  await page
    .getByRole("button", { name: "İsteği gözden geçir", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Son bir göz atalım." }),
  ).toBeVisible();
  await expect(
    page.getByText("Canlı hizmet fiyatı doğrulanmadı.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Yerel örnek oluştur", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Tercihleri düzenle", exact: true })
    .click();
  await page
    .getByRole("button", { name: "AI 3D Deneyim", exact: true })
    .click();
  await page
    .getByRole("button", { name: "İsteği gözden geçir", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Üretim henüz açık değil", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: true }),
  ).toHaveCount(2);
});
