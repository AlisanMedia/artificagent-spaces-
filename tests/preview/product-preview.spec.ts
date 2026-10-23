import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
const shots = "artifacts/screenshots";

test("working studio navigation, responsive Turkish copy and accessibility", async ({
  page,
}, info) => {
  await page.goto("/spaces/");
  await expect(
    page.getByRole("button", { name: "Mülk medyasını yükle", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText(
      "Sentetik ürün önizlemesi — gerçek AI video üretimi henüz etkin değildir. Dosyalar cihazında kalır.",
      { exact: true },
    ),
  ).toBeVisible();
  await mkdir(shots, { recursive: true });
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `${shots}/v5-${info.project.name}-${width}-studio.png`,
      fullPage: true,
    });
  }
  for (const [label, title] of [
    ["Projelerim", "Projelerim"],
    ["Sonuçlar", "Sonuçlar"],
    ["Golden Property", "Tasarlanan mekânı tanı"],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});

test("local-only file selection, retained unsupported format, styles, real preview and sample download", async ({
  page,
}, info) => {
  const api: string[] = [],
    outside: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/")) api.push(u.pathname);
    if (
      /^https?:$/.test(u.protocol) &&
      u.origin !==
        new URL(page.url() === "about:blank" ? r.url() : page.url()).origin
    )
      outside.push(u.origin);
  });
  await page.goto("/spaces/");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Mülk medyasını yükle", exact: true })
    .click();
  await (
    await chooser
  ).setFiles([
    {
      name: "sentetik.heic",
      mimeType: "image/heic",
      buffer: Buffer.from("synthetic unsupported fixture"),
    },
  ]);
  await expect(
    page.getByText("Desteklenmeyen biçim", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tarzını seç", exact: true }),
  ).toBeDisabled();
  const selection = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Mülk medyasını yükle", exact: true })
    .click();
  await (
    await selection
  ).setFiles([
    {
      name: "sentetik-salon.png",
      mimeType: "image/png",
      buffer: await readFile("public/golden-v5/living.png"),
    },
  ]);
  await expect(
    page.getByText("Yalnız bu tarayıcıda · sunucuya gönderilmedi", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "sentetik.heic kaldır" }).click();
  await page.getByRole("button", { name: "Tarzını seç", exact: true }).click();
  await page.getByRole("button", { name: /Doğal keşif Mekânı/ }).click();
  await page.getByRole("button", { name: "Örnek sonucu göster" }).click();
  await expect(
    page.getByText(/Seçtiğin dosyalardan yeni video üretilmedi/),
  ).toBeVisible();
  await page.locator("video").evaluate(async (v) => {
    if (!(v instanceof HTMLVideoElement)) throw Error("VIDEO_ELEMENT_REQUIRED");
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() =>
      page.locator("video").evaluate((v) => (v as HTMLVideoElement).videoWidth),
    )
    .toBe(360);
  await page
    .getByLabel("Video biçimi", { exact: true })
    .selectOption("landscape");
  await expect
    .poll(() =>
      page.locator("video").evaluate((v) => (v as HTMLVideoElement).videoWidth),
    )
    .toBe(640);
  await page.locator("video").evaluate(async (v) => {
    if (!(v instanceof HTMLVideoElement)) throw Error("VIDEO_ELEMENT_REQUIRED");
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0.1);
  await page.locator("video").evaluate((v) => (v as HTMLVideoElement).pause());
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Örnek MP4'ü indir" }).click();
  expect((await download).suggestedFilename()).toBe("pov-landscape.mp4");
  await mkdir(shots, { recursive: true });
  await page.screenshot({
    path: `${shots}/v5-${info.project.name}-result.png`,
    fullPage: true,
  });
  expect(api).toEqual([]);
  expect(outside).toEqual([]);
});

test("golden plan facts and static security boundary are distinct from privileged app", async ({
  page,
  request,
}) => {
  await page.goto("/spaces/");
  await page
    .getByRole("button", { name: "Golden Property", exact: true })
    .click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(6);
  await expect(
    page.getByText(/Gerçek bir evin fotoğraflardan rekonstrüksiyonu değildir/),
  ).toBeVisible();
  await page.getByLabel("Oda görünümü").selectOption("bedroom");
  await expect(page.getByAltText(/Yatak odası · sabit kamera/)).toBeVisible();
  for (const path of [
    "/api/spaces/bootstrap",
    "/api/spaces/session",
    "/spaces/manage",
    "/tour/forged-grant",
    "/.env",
    "/.git/config",
    "/.spaces-local/private-objects",
  ]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
  expect(
    (
      await request.post("/api/spaces/session", {
        data: { identityId: "demo-admin-a" },
      })
    ).status(),
  ).toBe(405);
  const headers = (await request.get("/")).headers();
  expect(headers["content-security-policy"]).toContain("form-action 'none'");
  expect(headers["x-robots-tag"]).toContain("noindex");
});

test("actual GLB free walk with touch/keyboard, room routing and daypart controls", async ({
  page,
}, info) => {
  await page.goto("/spaces/");
  await page
    .getByRole("button", { name: "3D Premium / Beta", exact: true })
    .click();
  const canvas = page.getByRole("application");
  await expect(canvas).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await expect(
    page.getByText("Blender mesh · serbest gezinme hazır", { exact: true }),
  ).toBeVisible();
  expect(await page.locator("canvas").count()).toBeGreaterThan(0);
  const before = await canvas.getAttribute("data-position");
  const forward = page.getByRole("button", { name: "İleri yürü", exact: true });
  await forward.dispatchEvent("pointerdown");
  try {
    await expect
      .poll(() => canvas.getAttribute("data-position"), { timeout: 5000 })
      .not.toBe(before);
  } finally {
    await forward.dispatchEvent("pointerup");
  }
  await page.getByLabel("Odaya git").selectOption("corridor");
  await expect(canvas).toHaveAttribute("data-room", "corridor", {
    timeout: 15000,
  });
  await page.getByLabel("Odaya git").selectOption("living");
  await expect(canvas).toHaveAttribute("data-room", "living", {
    timeout: 15000,
  });
  await page.getByLabel("Günün zamanı").selectOption("evening");
  await expect(page.getByLabel("Günün zamanı")).toHaveValue("evening");
  await page.getByLabel("3D kalite").selectOption("low");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(canvas).toHaveAttribute("data-room", "living");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await mkdir(shots, { recursive: true });
  await page.screenshot({
    path: `${shots}/v5-${info.project.name}-freewalk.png`,
    fullPage: true,
  });
});
