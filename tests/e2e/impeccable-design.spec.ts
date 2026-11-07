import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("first-screen upload stays usable at every supported width and opens the rights-gated media step", async ({
  page,
}) => {
  const productionPosts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/production/"))
      productionPosts.push(request.url());
  });
  await page.goto("/spaces");
  await page.evaluate(() => document.fonts.ready);
  const upload = page.getByRole("button", {
    name: "Fotoğraf veya video ekle",
    exact: true,
  });
  await expect(upload).toHaveCount(1);
  await expect(upload).toBeEnabled();
  for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
    const height = width < 600 ? 844 : 1000;
    await page.setViewportSize({ width, height });
    const box = await upload.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await upload.focus();
  await expect(upload).toBeFocused();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (
    await chooser
  ).setFiles({
    name: "sentetik-oda.png",
    mimeType: "image/png",
    buffer: readFileSync("public/golden-v5/living.png"),
  });
  await expect(
    page.getByRole("checkbox", {
      name: /Bu dosyaları kullanma hakkım var/,
    }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Dosyaları güvenle yükle", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Dosyaları güvenle yükle", exact: true }),
  ).toBeDisabled();
  expect(productionPosts).toEqual([]);
});

test("showcase skip navigation is visible on focus and service links preserve the actual scoped studio path", async ({
  page,
}) => {
  await page.goto("/spaces/showcase");
  const skip = page.getByRole("link", { name: "İçeriğe geç", exact: true });
  const idleBox = await skip.boundingBox();
  expect(idleBox!.y + idleBox!.height).toBeLessThan(0);
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("#showcase-main")).toBeFocused();
  const family = page.getByRole("article", { name: "Sanal Mobilya" });
  await expect(family).toContainText("Doğrulanmış hizmet sonucu henüz yok");
  const prepare = family.getByRole("link", {
    name: /^Tercihleri hazırla\s*:\s*Sanal Mobilya$/,
  });
  await prepare.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/spaces\?productionService=P03$/);
  await expect(page.getByLabel("Fotoğraf veya video seç")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Dosyaları güvenle yükle", exact: true }),
  ).toHaveCount(0);
});
