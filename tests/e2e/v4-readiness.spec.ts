import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
async function pick(
  page: Page,
  files: { name: string; mimeType: string; buffer: Buffer }[],
) {
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Fotoğraf veya video ekle", exact: true })
    .click();
  await (await chooser).setFiles(files);
}
async function consent(page: Page) {
  await page.getByText("Gizlilik ve demo ölçümü", { exact: true }).click();
  await page
    .getByRole("checkbox", { name: /Yalnız bu sekmede anonim demo/ })
    .check();
}
test("unsupported device formats are retained with Turkish advice before upload, quote or reservation; opt-out erases local funnel", async ({
  page,
}, info) => {
  await page.goto("/spaces");
  const posts: string[] = [];
  page.on("request", (r) => {
    if (
      r.method() === "POST" &&
      /\/api\/spaces\/(properties|quote|jobs)/.test(r.url())
    )
      posts.push(new URL(r.url()).pathname);
  });
  await consent(page);
  await pick(page, [
    {
      name: "telefon.heic",
      mimeType: "image/heic",
      buffer: Buffer.from("synthetic invalid HEIC"),
    },
    {
      name: "telefon.mov",
      mimeType: "video/quicktime",
      buffer: Buffer.from("synthetic invalid MOV"),
    },
    {
      name: "telefon.webm",
      mimeType: "video/webm",
      buffer: Buffer.from("synthetic invalid WebM"),
    },
  ]);
  await expect(
    page.getByText("Bu biçim yüklenmeyecek", { exact: true }),
  ).toHaveCount(3);
  await expect(page.getByText(/Bu iPhone fotoğrafı HEIC/)).toBeVisible();
  await expect(page.getByText(/Bu video MOV\/QuickTime/)).toBeVisible();
  await expect(page.getByText(/WebM henüz desteklenmiyor/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Dosyaları güvenle yükle", exact: true }),
  ).toBeDisabled();
  expect(posts).toEqual([]);
  await page
    .getByText("iPhone ve video biçimleri hakkında", { exact: true })
    .click();
  await expect(
    page.getByText(/Özel dosyaları çevrimiçi dönüştürücülere gönderme/),
  ).toBeVisible();
  const aggregate = page.getByLabel("Yerel sentetik huni özeti");
  await page.locator(".ux-developer > summary").click();
  const data = JSON.parse(await aggregate.innerText()) as {
    counts: Record<string, number>;
    total: number;
  };
  expect(data.counts["selection_unsupported"]).toBe(3);
  await mkdir("artifacts/ux-funnel-v4", { recursive: true });
  await writeFile(
    `artifacts/ux-funnel-v4/${info.project.name}-selection.json`,
    JSON.stringify(
      {
        schemaVersion: 1,
        syntheticOnly: true,
        source: "ACTUAL_PLAYWRIGHT_UI_SNAPSHOT",
        snapshot: data,
        uploadOrQuoteOrJobPosts: posts.length,
      },
      null,
      2,
    ) + "\n",
  );
  expect(data.counts["picker_opened"]).toBe(1);
  expect(await aggregate.innerText()).not.toContain("telefon");
  await mkdir("artifacts/screenshots", { recursive: true });
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `artifacts/screenshots/v4-${info.project.name}-${width}-format-guidance.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("checkbox", { name: /Yalnız bu sekmede anonim demo/ })
    .uncheck();
  await expect(page.getByLabel("Yerel demo adım sayısı")).toHaveText(
    "0 yerel adım",
  );
  expect(JSON.parse(await aggregate.innerText()).counts).toEqual({});
  await writeFile(
    `artifacts/ux-funnel-v4/${info.project.name}-withdrawal.json`,
    JSON.stringify(
      {
        schemaVersion: 1,
        syntheticOnly: true,
        source: "ACTUAL_PLAYWRIGHT_UI_SNAPSHOT",
        snapshot: JSON.parse(await aggregate.innerText()),
      },
      null,
      2,
    ) + "\n",
  );
  await page.reload();
  await page.getByText("Gizlilik ve demo ölçümü", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Yalnız bu sekmede anonim demo/ }),
  ).not.toBeChecked();
  await expect(page.getByLabel("Yerel demo adım sayısı")).toHaveText(
    "0 yerel adım",
  );
});
test("JPEG/WebP and MP4 upload remain scoped, preview is real and download stays review-gated with opt-in observations", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto("/spaces");
  await consent(page);
  const original = await readFile("fixtures/video-quality-v4/footage.mp4"),
    hevcHint = Buffer.from(original),
    entry = hevcHint.indexOf(Buffer.from("avc1"), 40);
  expect(entry).toBeGreaterThan(0);
  hevcHint.write("hvc1", entry);
  let uploadCalls = 0;
  page.on("request", (r) => {
    if (r.url().includes("media-grant")) uploadCalls++;
  });
  await pick(page, [
    { name: "unsupported-codec.mp4", mimeType: "video/mp4", buffer: hevcHint },
  ]);
  await expect(
    page.getByText(/MP4 içindeki video biçimi desteklenmiyor/),
  ).toBeVisible();
  expect(uploadCalls).toBe(0);
  await page
    .getByRole("button", { name: "Seçim 1 kaldır", exact: true })
    .click();
  await pick(page, [
    {
      name: "sentetik-a.jpg",
      mimeType: "image/jpeg",
      buffer: await readFile("fixtures/video-quality-v4/photo-a.jpg"),
    },
    {
      name: "sentetik-b.webp",
      mimeType: "image/webp",
      buffer: await readFile("fixtures/video-quality-v4/photo-b.webp"),
    },
    { name: "sentetik-video.mp4", mimeType: "video/mp4", buffer: original },
  ]);
  await page
    .getByRole("checkbox", { name: /Bu dosyaları kullanma hakkım var/ })
    .check();
  await page
    .getByRole("button", { name: "Dosyaları güvenle yükle", exact: true })
    .click();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: true }),
  ).toHaveCount(3, { timeout: 30000 });
  await page
    .getByRole("button", { name: "Tarzını seç", exact: true })
    .last()
    .click();
  await page.locator(".v54-legacy > summary").click();
  await page.getByRole("radio", { name: /Sinematik tanıtım/ }).check();
  await page.getByRole("radio", { name: /Karma kurgu/ }).check();
  await page
    .getByRole("combobox", { name: "Video uzunluğu" })
    .selectOption("4");
  await page
    .getByRole("button", { name: "İçeriği oluştur", exact: true })
    .click();
  const video = page.getByLabel("Oluşturulan video önizlemesi");
  await expect(video).toBeVisible({ timeout: 60000 });
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).readyState))
    .toBeGreaterThan(0);
  expect(
    await video.evaluate((v) => ({
      width: (v as HTMLVideoElement).videoWidth,
      height: (v as HTMLVideoElement).videoHeight,
    })),
  ).toEqual({ width: 360, height: 640 });
  await expect(
    page.getByRole("button", { name: "İndir", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/yetkili başka bir incelemeci/)).toBeVisible();
  await page.locator(".ux-developer > summary").click();
  const aggregate = JSON.parse(
    await page.getByLabel("Yerel sentetik huni özeti").innerText(),
  ) as { counts: Record<string, number> };
  await mkdir("artifacts/ux-funnel-v4", { recursive: true });
  await writeFile(
    `artifacts/ux-funnel-v4/${info.project.name}-preview.json`,
    JSON.stringify(
      {
        schemaVersion: 1,
        syntheticOnly: true,
        source: "ACTUAL_PLAYWRIGHT_UI_SNAPSHOT",
        snapshot: aggregate,
      },
      null,
      2,
    ) + "\n",
  );
  for (const name of [
    "rights_accepted",
    "upload_succeeded",
    "style_selected",
    "quote_returned",
    "job_started",
    "preview_opened",
    "review_pending",
  ])
    expect(aggregate.counts[name], name).toBeGreaterThan(0);
  expect(aggregate.counts["approval_observed"]).toBeUndefined();
  expect(aggregate.counts["download_completed"]).toBeUndefined();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `artifacts/screenshots/v4-${info.project.name}-review-gated-result.png`,
    fullPage: true,
  });
});
