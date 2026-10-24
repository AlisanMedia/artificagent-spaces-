import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";
const shots = "test-results/v52-preview-screenshots";

test("working studio navigation, responsive Turkish copy and accessibility", async ({
  page,
}, info) => {
  await page.goto("/spaces/");
  await expect(
    page.getByRole("button", { name: "Fotoğraf veya video ekle", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText(
      "Ürün önizlemesi · Gerçek AI video üretimi henüz aktif değil",
      { exact: true },
    ),
  ).toBeVisible();
  await mkdir(shots, { recursive: true });
  for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags([
            "wcag2a",
            "wcag2aa",
            "wcag21a",
            "wcag21aa",
            "wcag22a",
            "wcag22aa",
          ])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `${shots}/v5-${info.project.name}-${width}-studio.png`,
      fullPage: true,
    });
  }
  for (const [label, title] of [
    ["Örnekler", "Örnek projeler"],
    ["Örnek videolar", "Örnek videolar"],
    ["Örnekler", "Örnek projeler"],
    ["Örnek mülkü aç", "Mekânı, her yönüyle."],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags([
            "wcag2a",
            "wcag2aa",
            "wcag21a",
            "wcag21aa",
            "wcag22a",
            "wcag22aa",
          ])
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
    .getByRole("button", { name: "Fotoğraf veya video ekle", exact: true })
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
    .getByRole("button", { name: "Fotoğraf veya video ekle", exact: true })
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
  await page.getByRole("radio", { name: /Doğal keşif/ }).click();
  await page.getByRole("button", { name: "Hazır videoyu aç" }).click();
  await expect(page.getByText(/Bu hazır örnek videodur;/)).toBeVisible();
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
  await page.locator("video").evaluate(async (v) => {
    if (!(v instanceof HTMLVideoElement)) throw Error("VIDEO_ELEMENT_REQUIRED");
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() =>
      page.locator("video").evaluate((v) => (v as HTMLVideoElement).videoWidth),
    )
    .toBe(640);
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
  await page.getByRole("button", { name: "Örnekler", exact: true }).click();
  await page
    .getByRole("button", { name: "Örnek mülkü aç", exact: true })
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
  await page.getByRole("button", { name: "3D Tur", exact: true }).click();
  await expect(page.getByRole("application")).toHaveCount(0);
  await page
    .getByRole("button", { name: "3D turu başlat", exact: true })
    .click();
  const canvas = page.getByRole("application");
  await expect(canvas).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await expect(
    page.getByText("Blender mesh · serbest gezinme hazır", { exact: true }),
  ).toBeVisible();
  expect(await page.locator("canvas").count()).toBeGreaterThan(0);
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-yaw")))
    .toBeCloseTo(-Math.PI / 2, 5);
  const pixels = await sharp(await page.locator("canvas").screenshot()).stats();
  expect(
    Math.max(...pixels.channels.slice(0, 3).map((c) => c.stdev)),
  ).toBeGreaterThan(8);
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
        .withTags([
          "wcag2a",
          "wcag2aa",
          "wcag21a",
          "wcag21aa",
          "wcag22a",
          "wcag22aa",
        ])
        .analyze()
    ).violations,
  ).toEqual([]);
  await mkdir(shots, { recursive: true });
  await page.screenshot({
    path: `${shots}/v5-${info.project.name}-freewalk.png`,
    fullPage: true,
  });
});

test("first mobile viewport has one working picker and a three-action honest sample flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/spaces/");
  const primary = page.getByRole("button", {
    name: "Fotoğraf veya video ekle",
    exact: true,
  });
  await expect(primary).toHaveCount(1);
  const box = await primary.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  await primary.focus();
  const chooser = page.waitForEvent("filechooser");
  await expect(primary).toBeFocused();
  await primary.press("Enter");
  await (await chooser).setFiles([]);
  await page
    .getByRole("button", { name: "Örnek mülkle dene", exact: true })
    .click();
  await page.getByRole("radio", { name: /Karma kurgu/ }).check();
  await page
    .getByRole("button", { name: "Hazır videoyu aç", exact: true })
    .click();
  await expect(page.getByText(/Bu hazır örnek videodur;/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Örnek MP4'ü indir" }),
  ).toHaveAttribute("href", "/golden-v5/hybrid-portrait.mp4");
  const sourceId = page.locator("#preview-build-id");
  await expect(sourceId).toHaveText(
    /^[a-f0-9]{40}(?: · yerel değişiklikler)?$/,
  );
  await expect(sourceId).not.toBeVisible();
  await page.getByText("Teknik bilgi", { exact: true }).click();
  await expect(sourceId).toBeVisible();
  await expect(page.getByText(/Kaynak sürüm/)).toBeVisible();
});

test("local files support reorder, replace, failed replacement recovery, remove, dialog ESC and drag fallback", async ({
  page,
}) => {
  await page.goto("/spaces/");
  const img = await readFile("public/golden-v5/living.png");
  const files = page.locator("input[type=file]");
  await files.setInputFiles([
    { name: "bir.png", mimeType: "image/png", buffer: img },
    { name: "iki.png", mimeType: "image/png", buffer: img },
  ]);
  await expect(page.locator(".pv52-media-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "iki.png öne taşı", exact: true })
    .click();
  await expect(page.locator(".pv52-media-card h3").first()).toHaveText(
    "iki.png",
  );
  await page
    .getByRole("button", { name: "iki.png önizle", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  let chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "iki.png değiştir", exact: true })
    .click();
  await (
    await chooser
  ).setFiles([
    {
      name: "hatali.png",
      mimeType: "image/png",
      buffer: Buffer.from("invalid synthetic header"),
    },
  ]);
  await expect(page.getByText(/önceki dosyan korunuyor/)).toBeVisible();
  await expect(page.locator(".pv52-media-card h3").first()).toHaveText(
    "iki.png",
  );
  await page
    .getByRole("button", { name: "hatali.png kaldır", exact: true })
    .click();
  chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "iki.png değiştir", exact: true })
    .click();
  await (
    await chooser
  ).setFiles([{ name: "uc.png", mimeType: "image/png", buffer: img }]);
  await expect(page.locator(".pv52-media-card h3").first()).toHaveText(
    "uc.png",
  );
  await page
    .getByRole("button", { name: "uc.png kaldır", exact: true })
    .click();
  const transfer = await page.evaluateHandle((data) => {
    const d = new DataTransfer();
    d.items.add(
      new File([new Uint8Array(data)], "suruklenen.png", { type: "image/png" }),
    );
    return d;
  }, Array.from(img));
  await page
    .locator(".pv52-upload")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
  await expect(
    page.getByRole("heading", { name: "suruklenen.png", exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags([
          "wcag2a",
          "wcag2aa",
          "wcag21a",
          "wcag21aa",
          "wcag22a",
          "wcag22aa",
        ])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("initial preview has self-hosted Turkish fonts, no eager 3D/media, reduced motion and no backend transport", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/spaces/");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await document.fonts.load("italic 450 36px Newsreader", "şğçıİöüçŞĞÇÖÜ");
  });
  expect(
    await page.evaluate(() =>
      document.fonts.check("500 16px Manrope", "şğçıİöüçŞĞÇÖÜ"),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      document.fonts.check("italic 450 36px Newsreader", "şğçıİöüçŞĞÇÖÜ"),
    ),
  ).toBe(true);
  expect(requests.some((u) => /\.glb|\.mp4|scene-viewer/.test(u))).toBe(false);
  expect(
    requests.every((u) => new URL(u).origin === new URL(page.url()).origin),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .getByRole("button", { name: "Fotoğraf veya video ekle", exact: true })
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.getByRole("button", { name: "3D Tur", exact: true }).click();
  expect(requests.some((u) => u.endsWith(".glb"))).toBe(false);
  await page
    .getByRole("button", { name: "3D turu başlat", exact: true })
    .click();
  await expect(page.getByRole("application")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 30000 },
  );
  await page
    .getByRole("button", { name: "Başlangıca dön", exact: true })
    .click();
  await expect(
    page.getByText("Başlangıç görünümüne dönüldü.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Turu kapat", exact: true }).click();
  await expect(page.getByRole("application")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "3D turu başlat", exact: true }),
  ).toBeVisible();
});
