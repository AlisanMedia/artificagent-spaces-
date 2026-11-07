import { expect, test } from "@playwright/test";

test("customer navigation preserves all three work areas across rail and mobile layouts", async ({
  page,
}) => {
  await page.goto("/spaces");
  const nav = page.getByRole("navigation", { name: "Stüdyo bölümleri" });
  for (const [label, title] of [
    ["Projelerim", "Projelerim"],
    ["Medya Arşivi", "Medya Arşivi"],
  ] as const) {
    await nav.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await nav.getByRole("button", { name: "Yeni Çalışma", exact: true }).click();
  const picker = page.getByRole("button", {
    name: "Fotoğraf veya video ekle",
    exact: true,
  });
  await expect(picker).toHaveCount(1);
  await expect(picker).toBeEnabled();
  for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
    const height = width < 600 ? 844 : 1000;
    await page.setViewportSize({ width, height });
    const button = await picker.boundingBox();
    expect(button!.y + button!.height).toBeLessThanOrEqual(height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 768) {
      await expect(
        page.getByLabel("Doğal Tur hazır örnek videosu", { exact: true }),
      ).toBeInViewport({ ratio: 1 });
    }
  }
});

test("opening exhibition has one real sample player, a bound source and working product selection", async ({
  page,
}) => {
  const paid: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /production|providers|jobs/.test(r.url()))
      paid.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/spaces/showcase");
  const exhibition = page.getByRole("region", {
    name: "Gerçek örnekleri incele",
  });
  await expect(exhibition.locator("video")).toHaveCount(1);
  const video = exhibition.getByLabel("Doğal Tur hazır örnek videosu");
  await expect(video).toBeInViewport();
  await expect(video).toHaveAttribute("src", "/showcase-v55/cc0-natural.mp4");
  await expect(
    exhibition.locator(".sc-video-example > figure").first().locator("img"),
  ).toHaveAttribute("src", "/showcase-v55/cc0-room-source.jpg");
  await exhibition
    .getByRole("button", { name: "3D örneği", exact: true })
    .click();
  await expect(
    exhibition.getByRole("button", { name: "3D örneğini başlat", exact: true }),
  ).toBeVisible();
  await expect(exhibition).toContainText("ölçülü sentetik");
  await exhibition
    .getByRole("button", { name: "360° örneği", exact: true })
    .click();
  await expect(
    exhibition.getByRole("button", {
      name: "360° örneğini başlat",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    exhibition.getByRole("img", {
      name: "CC0 lisanslı gerçek 2:1 fotoğraf panoraması",
      exact: true,
    }),
  ).toBeVisible();
  await expect(exhibition).toContainText("2048 × 1024");
  expect(paid).toEqual([]);
});
