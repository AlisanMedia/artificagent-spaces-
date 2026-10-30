import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
test("V5.7 seven public families have honest sample gaps and no research/model leakage", async ({
  page,
}) => {
  const unexpected: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) unexpected.push(r.url());
  });
  await page.goto("/spaces/showcase");
  const families = page.getByRole("region", { name: "Üretim hizmetleri" });
  await expect(families.getByRole("article")).toHaveCount(7);
  await expect(page.locator(".sv-explorer")).toHaveCount(0);
  await expect(
    families.getByRole("article", { name: "Sanal Mobilya" }),
  ).toContainText("Doğrulanmış hizmet sonucu henüz yok");
  await expect(families).not.toContainText(
    /kling|seedance|pedra|marble|negative_prompt|highFidelity/,
  );
  await page
    .getByRole("button", { name: "Konsept ve deneysel seçenekler" })
    .click();
  await expect(families.getByRole("article")).toHaveCount(9);
  await expect(
    families.getByRole("article", { name: "AI 3D Deneyim" }),
  ).toContainText("Konsept / Deneysel");
  expect(unexpected).toEqual([]);
  for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("V5.7 photo sources/options save a real blocked request, survive API read and cannot generate/download/debit", async ({
  page,
  baseURL,
}) => {
  await page.goto("/spaces?productionService=P03");
  const skip = page.getByRole("link", { name: "İçeriğe geç", exact: true });
  await skip.focus();
  await expect(skip).toBeFocused();
  expect(
    await skip.evaluate((el) => ({
      color: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
    })),
  ).toEqual({ color: "rgb(247, 246, 242)", background: "rgb(25, 38, 34)" });
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  const picker = page.getByLabel("Fotoğraf veya video seç");
  await expect(picker).toBeEnabled();
  await picker.setInputFiles({
    name: "owned-synthetic.png",
    mimeType: "image/png",
    buffer: readFileSync("public/golden-v5/living.png"),
  });
  await page
    .getByRole("checkbox", { name: /Bu dosyaları kullanma hakkım var/ })
    .check();
  await page
    .getByRole("button", { name: "Dosyaları güvenle yükle", exact: true })
    .click();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tarzını seç", exact: true }).click();
  const panel = page.getByRole("region", { name: "Hizmet tercihleri" });
  await expect(panel).toBeVisible();
  await panel.getByLabel("Oda türü", { exact: true }).selectOption("Bedroom");
  await panel
    .getByLabel("Dekorasyon tarzı", { exact: true })
    .selectOption("Scandinavian");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/spaces/production/requests") &&
      r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "Tercihleri kaydet", exact: true })
    .click();
  const r = await response;
  expect(r.status()).toBe(201);
  const body = await r.json();
  expect(body.state).toBe("awaiting-provider-approval");
  expect(body.futurePriceMicroUsd).toBeNull();
  expect(body.actualExternalCostMicroUsd).toBe(0);
  expect(body.downloadAllowed).toBe(false);
  expect(JSON.stringify(body)).not.toMatch(
    /kling|seedance|pedra|promptVersion|profileSha256/,
  );
  await expect(panel.getByRole("status")).toContainText("işlem başlamadı");
  await expect(
    panel.getByRole("button", { name: "Oluştur — henüz kullanılamıyor" }),
  ).toBeDisabled();
  expect(
    (await page.request.get(`/api/spaces/production/requests/${body.id}`)).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post(
        `/api/spaces/production/requests/${body.id}/download-grant`,
        { headers: { Origin: baseURL! }, data: {} },
      )
    ).status(),
  ).toBe(403);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tarzını seç", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("işlem başlamadı");
  await expect(
    panel.getByLabel("Dekorasyon tarzı", { exact: true }),
  ).toHaveValue("Scandinavian");
  await panel
    .getByRole("button", { name: "İsteği iptal et", exact: true })
    .click();
  await expect(panel.getByRole("status")).toContainText("İstek iptal edildi");
});
