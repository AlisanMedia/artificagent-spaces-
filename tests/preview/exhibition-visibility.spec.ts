import { expect, test } from "@playwright/test";

test("mobile opening keeps the native upload and an honest working example within reach", async ({
  page,
  baseURL,
}) => {
  const outside: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (/^https?:$/.test(u.protocol) && u.origin !== new URL(baseURL!).origin)
      outside.push(u.origin);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/spaces/");
  const picker = page.getByRole("button", {
    name: "Fotoğraf veya video ekle",
    exact: true,
  });
  await expect(picker).toHaveCount(1);
  await expect(picker).toBeEnabled();
  await expect(picker).toBeInViewport({ ratio: 1 });
  const sample = page.getByRole("button", {
    name: "Örnek videoları aç",
    exact: true,
  });
  await expect(sample).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByAltText(
      "Açılabilen sentetik yerel video örneğinin gerçek posteri",
      { exact: true },
    ),
  ).toBeInViewport({ ratio: 1 });
  await expect(page.locator(".pv52-aside-truth")).toContainText(
    "yeni video üretilmez",
  );
  await sample.click();
  await expect(
    page.getByRole("heading", { name: "Örnek videolar", exact: true }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(1);
  await expect(page.locator("video")).toHaveAttribute("src", /\.mp4$/);
  expect(outside).toEqual([]);
});
