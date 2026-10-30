import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("isolated V5.5 showcase has real samples and never calls application APIs or sends uploads", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/") || r.method() !== "GET")
      requests.push(r.method() + " " + u.pathname);
  });
  await page.goto("/showcase/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Gayrimenkullerinizi",
  );
  await page
    .getByText("Video, 3D ve panorama örneklerini karşılaştır", { exact: true })
    .click();
  await page
    .locator(".sc-service")
    .filter({
      has: page.getByRole("heading", { name: "360° Sanal Tur", exact: true }),
    })
    .getByRole("button", { name: /Bu Hizmeti Seç/ })
    .click();
  await expect(
    page.getByText("Bu statik önizlemede yalnız hazır örnek gösterilir.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "360° örneğini başlat", exact: true })
    .click();
  await expect(page.locator(".sc-panorama-canvas")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 30000 },
  );
  await page
    .getByRole("button", { name: "Video örnekleri", exact: true })
    .click();
  await page.getByRole("radio", { name: "Dış Cephe", exact: true }).check();
  const v = page.getByLabel("Dış Cephe hazır örnek videosu");
  await v.evaluate((x) => (x as HTMLVideoElement).play());
  await expect
    .poll(() => v.evaluate((x) => (x as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.1);
  await page.getByRole("button", { name: "Giriş Yap", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "yükleme veya yönetim servisi içermez",
  );
  await page.keyboard.press("Escape");
  expect(requests).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("isolated gallery keeps native comparison, keyboard navigation and all seven responsive widths", async ({
  page,
}) => {
  await page.goto("/showcase/");
  for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const slider = page.getByRole("slider");
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("0");
  await page.keyboard.press("End");
  await expect(slider).toHaveValue("100");
  for (const path of [
    "/api/spaces/bootstrap",
    "/spaces/manage",
    "/tour/forged",
    "/.env",
  ])
    expect((await page.request.get(path)).status()).toBe(404);
});
