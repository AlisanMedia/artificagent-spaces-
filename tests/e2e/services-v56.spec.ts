import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
function localOnly(page: Page) {
  const unexpected: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (
      u.pathname.startsWith("/api/") ||
      r.method() !== "GET" ||
      u.hostname !== "127.0.0.1"
    )
      unexpected.push(r.method() + " " + u.hostname + u.pathname);
  });
  return unexpected;
}
async function openCatalog(page: Page, category?: string) {
  await page.goto("/spaces/showcase");
  await page.locator(".sv-disclosure > summary").click();
  if (category) await page.getByLabel("Hizmet türü").selectOption(category);
}
test("pending service details have real modal focus, no generation and no private requests", async ({
  page,
}) => {
  const unexpected = localOnly(page);
  await page.goto("/spaces/showcase");
  const catalog = page.getByRole("region", { name: "Hizmet kataloğu" });
  await expect(catalog).toBeHidden();
  const summary = page.locator(".sv-disclosure > summary");
  await expect(page.locator(".sv-explorer")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(catalog).toBeVisible();
  await expect(
    catalog.getByRole("button", { name: /hakkında bilgi/ }),
  ).toHaveCount(6);
  await page.getByLabel("Hizmet türü").selectOption("photo");
  const trigger = page.getByRole("button", {
    name: "Detayları gör: Fotoğraf iyileştirme hakkında bilgi",
  });
  await trigger.click();
  const modal = page.getByRole("dialog");
  await expect(modal).toContainText("oluşturma henüz kullanılamıyor");
  await expect(modal.locator('input[type="file"], video, canvas')).toHaveCount(
    0,
  );
  await expect(
    modal.getByRole("button", { name: /oluştur|dene|yükle/i }),
  ).toHaveCount(0);
  await expect(
    modal.getByRole("button", { name: "Hizmet bilgisini kapat" }),
  ).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
  expect(await modal.evaluate((d) => d.contains(document.activeElement))).toBe(
    true,
  );
  await page.keyboard.press("Shift+Tab");
  expect(await modal.evaluate((d) => d.contains(document.activeElement))).toBe(
    true,
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(unexpected).toEqual([]);
});
test("catalogue search, availability, reduced motion and seven widths remain accessible", async ({
  page,
}) => {
  await openCatalog(page, "photo");
  const catalog = page.getByRole("region", { name: "Hizmet kataloğu" });
  for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await page.getByRole("searchbox").boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("searchbox").fill("yuksek cozunurluk");
  await expect(
    catalog.getByRole("button", { name: /hakkında bilgi/ }),
  ).toHaveCount(1);
  await expect(
    catalog.getByRole("heading", { name: "Yüksek çözünürlük", exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("not-a-real-service");
  await expect(catalog.getByText(/Bu aramada hizmet bulunamadı/)).toBeVisible();
  await page.getByRole("button", { name: "Filtreleri temizle" }).click();
  await page.getByLabel("Yalnız şimdi denenebilenler").check();
  await expect(
    catalog.getByRole("button", { name: /hakkında bilgi/ }),
  ).toHaveCount(6);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("local loan calculates and validates without network, storage or guessed bank rates", async ({
  page,
}) => {
  const unexpected = localOnly(page);
  await openCatalog(page, "analysis");
  const originalStorage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  await page
    .getByRole("button", {
      name: "Detayları gör: Konut kredisi hesaplayıcı hakkında bilgi",
    })
    .click();
  await page.getByLabel("Kredi tutarı (TL)").fill("100000");
  await page.getByLabel("Aylık nominal faiz (%)").fill("1");
  await page.getByLabel("Vade (ay)").fill("12");
  await page.getByRole("button", { name: "Hesapla", exact: true }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toContainText("8.884,88");
  await expect(modal).toContainText("Banka teklifi değildir");
  await page.getByLabel("Kredi tutarı (TL)").fill("200000");
  await expect(modal.getByText("Girilen senaryonun sonucu")).toHaveCount(0);
  await page.getByLabel("Vade (ay)").fill("601");
  await page.getByRole("button", { name: "Hesapla", exact: true }).click();
  expect(
    await page
      .getByLabel("Vade (ay)")
      .evaluate((e) => (e as HTMLInputElement).validity.rangeOverflow),
  ).toBe(true);
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    })),
  ).toEqual(originalStorage);
  expect(unexpected).toEqual([]);
});
test("rental scenario reports a loss without inventing profitable payback and passes contrast", async ({
  page,
}) => {
  const unexpected = localOnly(page);
  await openCatalog(page, "analysis");
  const originalStorage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  await page
    .getByRole("button", {
      name: "Detayları gör: Kira getirisi senaryosu hakkında bilgi",
    })
    .click();
  await page.getByLabel("Yılda dolu kalacak ay").fill("0");
  await page.getByRole("button", { name: "Hesapla", exact: true }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toContainText("Bu senaryoda pozitif geri dönüş yok");
  await expect(modal).toContainText("-₺12.000,00");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    })),
  ).toEqual(originalStorage);
  expect(unexpected).toEqual([]);
});
test("catalogue only navigates to bound samples and keeps upload in the first mobile viewport", async ({
  page,
}) => {
  await openCatalog(page, "tour");
  await page
    .getByRole("button", {
      name: "Detayları gör: 360° sanal tur hakkında bilgi",
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("2:1");
  await page.getByRole("button", { name: "Hazır örneği aç" }).click();
  await expect(
    page.getByRole("button", { name: "360° örneği", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "360° örneğini başlat", exact: true }),
  ).toBeVisible();
  const bootstrap = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/spaces/bootstrap",
  );
  await page.goto("/spaces");
  expect((await bootstrap).ok()).toBe(true);
  await expect(
    page.getByRole("button", { name: "Fotoğraf veya video ekle", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  const cta = (await page
    .getByRole("button", { name: "Fotoğraf veya video ekle", exact: true })
    .boundingBox())!;
  expect(cta.y + cta.height).toBeLessThanOrEqual(844);
  await expect(
    page.getByRole("region", { name: "Hizmet kataloğu" }),
  ).toBeHidden();
  await page.locator(".sv-disclosure > summary").click();
  await page
    .getByRole("button", {
      name: "Detayları gör: Emlak tanıtım videosu hakkında bilgi",
    })
    .click();
  await page.getByRole("button", { name: "Yerel stüdyoda dene" }).click();
  await expect(
    page.getByRole("button", { name: "Fotoğraf veya video ekle", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
});
