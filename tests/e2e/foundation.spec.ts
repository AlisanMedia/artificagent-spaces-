import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const MODES = [
  { id: "pov", name: "POV" },
  { id: "cinematic", name: "Cinematic" },
  { id: "hybrid", name: "Hybrid" },
  { id: "interactive-3d", name: "Interactive 3D" },
] as const;

async function switchWorkspace(page: Page, id: string) {
  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    await page.locator("#mobile-workspace").selectOption(id);
  } else {
    await page.locator("#desktop-workspace").selectOption(id);
  }
}

async function screenshot(page: Page, info: TestInfo, label: string) {
  await mkdir("artifacts/screenshots", { recursive: true });
  await page.screenshot({ path: join("artifacts/screenshots", info.project.name + "-" + label + ".png"), fullPage: true });
}

test("dashboard has the four modes and makes no external requests", async ({ page }, info) => {
  const externalRequests: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") {
      externalRequests.push(url.origin);
      await route.abort();
    } else {
      await route.continue();
    }
  });
  const response = await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Her mekânınbir hikâyesi var/);
  const main = page.getByRole("main");
  for (const mode of MODES) await expect(main.getByRole("link").filter({ has: page.getByRole("heading", { name: mode.name, exact: true }) })).toBeVisible();
  await expect(main.locator(".property-card")).toHaveCount(3);
  expect(response?.headers()["content-security-policy"]).toContain("connect-src 'self'");
  expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  await screenshot(page, info, "dashboard");
  await page.getByRole("button", { name: "Kullanım rehberi" }).click();
  await expect(page.getByRole("dialog", { name: "İlk çalışmanız, üç adımda" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Kullanım rehberi" })).toBeFocused();
  await page.goto("/library");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Görsel arşivi.");
  expect(externalRequests).toEqual([]);
});

test("portfolio supports filtering, search, empty recovery and list layout", async ({ page }) => {
  await page.goto("/properties");
  await page.getByRole("button", { name: "Villa", exact: true }).click();
  await expect(page.locator(".property-card")).toHaveCount(1);
  await expect(page.locator(".property-card")).toContainText("Avlu Evi");
  await page.getByRole("textbox", { name: "Portföyde ara" }).fill("eşleşmeyen-mülk");
  await expect(page.getByRole("heading", { name: "Bu aramada bir mekân yok." })).toBeVisible();
  await page.getByRole("button", { name: "Filtreleri temizle" }).click();
  await expect(page.locator(".property-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Liste görünümü" }).click();
  await expect(page.locator(".list-view")).toBeVisible();
});

test("property sources open an accessible dialog and Escape restores focus", async ({ page }) => {
  await page.goto("/properties/atrium");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Atrium Loft");
  const source = page.locator(".asset-card").first();
  await source.click();
  await expect(page.getByRole("dialog", { name: "Yaşam alanı" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(source).toBeFocused();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

for (const mode of MODES) {
  test(mode.name + " settings survive review and produce only a local JSON plan", async ({ page }, info) => {
    await page.goto("/studio?mode=" + mode.id + "&property=atrium");
    await expect(page.getByRole("radio", { name: new RegExp("^" + mode.name) })).toBeChecked();
    await page.getByRole("button", { name: "Devam et" }).click();
    if (mode.id === "interactive-3d") {
      await page.getByRole("combobox", { name: "Sahne detay planı" }).selectOption("detailed");
      await page.getByRole("combobox", { name: "Başlangıç aydınlatması" }).selectOption("dusk");
    } else {
      await page.getByRole("combobox", { name: "Video planı süresi" }).selectOption("60");
      await page.getByRole("combobox", { name: "Görüntü oranı" }).selectOption("9:16");
      if (mode.id === "pov") await page.getByRole("combobox", { name: "Kamera temposu" }).selectOption("balanced");
      if (mode.id === "cinematic") {
        await page.getByRole("combobox", { name: "Görsel anlatım" }).selectOption("soft");
        await page.getByRole("checkbox", { name: "Başlık ve altyazı alanlarını plana ekle" }).uncheck();
      }
      if (mode.id === "hybrid") await page.getByRole("slider").press("End");
    }
    await page.getByRole("button", { name: "Devam et" }).click();
    const preview = page.getByRole("button", { name: "Yerel önizlemeyi hazırla" });
    await expect(preview).toBeDisabled();
    await page.getByRole("checkbox", { name: /yerel bir plan olduğunu anladım/ }).check();
    await preview.click();
    await expect(page.getByTestId("preview-result")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Video veya gezilebilir 3D üretilmemiştir");
    await page.locator(".storyboard-shot").nth(1).click();
    await expect(page.locator(".preview-label")).toContainText("02 / 04");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Planı JSON olarak indir" }).click();
    const download = await downloadPromise;
    const path = await download.path();
    const result = JSON.parse(await readFile(path, "utf8")) as {
      syntheticOnly: boolean; actualCostMicroUsd: number; mode: string;
      configuration: Record<string, unknown>; kind: string;
    };
    expect(result).toMatchObject({ mode: mode.id, syntheticOnly: true, actualCostMicroUsd: 0 });
    if (mode.id === "interactive-3d") {
      expect(result.configuration).toEqual({ mode: mode.id, quality: "detailed", daypart: "dusk" });
      expect(result.kind).toBe("scene-plan");
    } else {
      expect(result.configuration).toMatchObject({ mode: mode.id, durationSeconds: 60, aspectRatio: "9:16" });
      if (mode.id === "pov") expect(result.configuration["cameraPace"]).toBe("balanced");
      if (mode.id === "cinematic") expect(result.configuration).toMatchObject({ style: "soft", captions: false });
      if (mode.id === "hybrid") expect(result.configuration["povSharePercent"]).toBe(75);
    }
    await mkdir("artifacts/plans", { recursive: true });
    await download.saveAs(join("artifacts/plans", info.project.name + "-" + mode.id + ".json"));
    if (mode.id === "hybrid") await screenshot(page, info, "studio-result");
    await page.getByRole("link", { name: "İnceleme alanı" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Son bakış sizde.");
  });
}

test("3D cannot bypass missing or deselected plan evidence", async ({ page }) => {
  await page.goto("/studio?mode=interactive-3d&property=linea");
  await expect(page.getByRole("status")).toContainText("ölçülü plan gerekli");
  await expect(page.getByRole("button", { name: "Devam et" })).toBeDisabled();
  await page.getByRole("combobox", { name: "Örnek mülk" }).selectOption("atrium");
  await page.getByRole("button", { name: "Devam et" }).click();
  await page.getByRole("checkbox", { name: /Sentetik ölçülü plan/ }).uncheck();
  await page.getByRole("button", { name: "Devam et" }).click();
  await page.getByRole("checkbox", { name: /yerel bir plan olduğunu anladım/ }).check();
  await page.getByRole("button", { name: "Yerel önizlemeyi hazırla" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("ölçülü plan gerekli");
  await expect(page.getByTestId("preview-result")).toHaveCount(0);
});

test("workspace selection filters fixtures and a direct foreign-property view", async ({ page }) => {
  await page.goto("/properties");
  await switchWorkspace(page, "org-atelier");
  await expect(page.locator(".property-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Kıyı Süiti" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Atrium Loft" })).toHaveCount(0);
  await page.getByRole("link", { name: "Kıyı Süiti mülkünü incele" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kıyı Süiti");
  await switchWorkspace(page, "org-studio");
  await expect(page.getByRole("heading", { name: "Bu çalışma alanında görünmüyor." })).toBeVisible();
});

test("review requires all checks and does not publish", async ({ page }) => {
  await page.goto("/reviews");
  const approve = page.getByRole("button", { name: "Yerel incelemeyi tamamla" });
  await expect(approve).toBeDisabled();
  const checks = page.getByRole("main").getByRole("checkbox");
  for (const check of await checks.all()) await check.check();
  await approve.click();
  await expect(page.getByRole("status")).toContainText("Yayın, paylaşım veya kalıcı kayıt oluşturulmadı");
  await checks.first().uncheck();
  await expect(page.getByRole("button", { name: "Yerel incelemeyi tamamla" })).toBeDisabled();
});

test("all primary screens meet the automated WCAG A/AA checks", async ({ page }) => {
  test.setTimeout(90_000);
  for (const path of ["/", "/properties", "/properties/atrium", "/studio", "/library", "/activity", "/reviews", "/settings"]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations, path + " accessibility violations").toEqual([]);
  }
});

test("narrow layouts do not overflow and navigation is keyboard accessible", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of ["/", "/properties", "/studio", "/properties/atrium", "/library", "/reviews"]) {
    await page.goto(path);
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const overflow = documentWidth > (page.viewportSize()?.width ?? 320);
    expect(overflow, path + " horizontal overflow").toBe(false);
  }
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "İçeriğe geç" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await expect(page.getByRole("dialog", { name: "Çalışma alanı menüsü" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Menüyü aç" })).toBeFocused();
});

test("UI preferences reset without storage, accounts or upload endpoints", async ({ page, request }) => {
  await page.goto("/settings");
  await page.getByRole("checkbox", { name: /Hareketleri azalt/ }).check();
  await expect(page.locator('[data-reduced-motion="true"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Demoyu sıfırla" }).click();
  await expect(page.getByRole("checkbox", { name: /Hareketleri azalt/ })).not.toBeChecked();
  await expect(page.getByRole("status")).toContainText("sıfırlandı");
  expect(await page.evaluate(() => Object.keys(localStorage).length + Object.keys(sessionStorage).length)).toBe(0);
  for (const path of ["/api/upload", "/api/auth", "/api/generate", "/api/payments"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
  }
  await page.goto("/not-a-real-route");
  await expect(page.getByRole("heading", { name: "Bu sayfa portföyde yok." })).toBeVisible();
});
