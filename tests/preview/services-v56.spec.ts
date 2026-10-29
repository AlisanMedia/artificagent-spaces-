import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("isolated catalogue is truthful and local calculators do not add APIs or data transport", async ({
  page,
  baseURL,
}) => {
  const expectedOrigin = new URL(baseURL!).origin;
  const unexpected: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (
      u.pathname.startsWith("/api/") ||
      r.method() !== "GET" ||
      u.origin !== expectedOrigin
    )
      unexpected.push(r.method() + " " + u.hostname + u.pathname);
  });
  await page.goto("/showcase/");
  const catalog = page.getByRole("region", { name: "Hizmet kataloğu" });
  await expect(catalog).toBeHidden();
  await page.locator(".sv-disclosure > summary").click();
  await page
    .getByRole("button", {
      name: "Detayları gör: Emlak tanıtım videosu hakkında bilgi",
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "dosyadan yeni video oluşturmaz",
  );
  await expect(
    page.getByRole("link", { name: "Yerel stüdyoda dene" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByLabel("Hizmet türü").selectOption("photo");
  await page
    .getByRole("button", {
      name: "Detayları gör: Sanal mobilya yerleşimi hakkında bilgi",
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Dosya yükleme veya ödeme başlatılmaz",
  );
  await page.keyboard.press("Escape");
  await page.getByLabel("Hizmet türü").selectOption("analysis");
  await page
    .getByRole("button", {
      name: "Detayları gör: Konut kredisi hesaplayıcı hakkında bilgi",
    })
    .click();
  await page.getByLabel("Kredi tutarı (TL)").fill("12000");
  await page.getByLabel("Aylık nominal faiz (%)").fill("0");
  await page.getByLabel("Vade (ay)").fill("12");
  await page.getByRole("button", { name: "Hesapla", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("₺1.000,00");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  for (const path of [
    "/api/spaces/bootstrap",
    "/spaces/manage",
    "/tour/forged",
    "/.env",
  ])
    expect((await page.request.get(path)).status()).toBe(404);
  expect(unexpected).toEqual([]);
});
