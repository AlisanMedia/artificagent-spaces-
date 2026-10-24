import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
const origin = "http://127.0.0.1:3000";
async function post<T>(page: Page, path: string, data: unknown): Promise<T> {
  const r = await page.request.post("/api/spaces" + path, {
    headers: { Origin: origin },
    data,
  });
  expect(r.ok(), path + " " + r.status()).toBe(true);
  return r.json() as Promise<T>;
}
async function photo() {
  return sharp({
    create: { width: 640, height: 480, channels: 3, background: "#c4bda9" },
  })
    .png()
    .toBuffer();
}

test("upload-first studio is keyboard accessible and responsive at mobile, tablet and desktop", async ({
  page,
}, info) => {
  await page.goto("/spaces");
  await expect(
    page.getByRole("button", { name: "Fotoğraf veya video ekle", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("combobox", { name: "Test kimliği" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Operasyon", exact: true }),
  ).toHaveCount(0);
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
      path: `artifacts/screenshots/v3-${info.project.name}-${width}-studio.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", {
      name: "Fotoğraf veya video ekle",
      exact: false,
    })
    .focus();
  expect(
    await page.evaluate(() =>
      document.activeElement?.classList.contains("ux-primary"),
    ),
  ).toBe(true);
  const keyboardPicker = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await keyboardPicker).setFiles([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .getByRole("button", { name: "Fotoğraf veya video ekle", exact: true })
      .evaluate((b) => getComputedStyle(b).transitionDuration),
  ).toBe("0s");
});

test("nontechnical upload → real video → independent review → download with drafts preserved", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150000);
  const outside: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith("http") && u.hostname !== "127.0.0.1")
      outside.push(u.origin);
  });
  await page.goto("/spaces");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Fotoğraf veya video ekle", exact: true })
    .click();
  await (
    await chooser
  ).setFiles([
    { name: "salon.png", mimeType: "image/png", buffer: await photo() },
    {
      name: "oda.mp4",
      mimeType: "video/mp4",
      buffer: await readFile("public/spaces-examples/natural.mp4"),
    },
  ]);
  await expect(
    page.getByRole("button", { name: "Dosyaları güvenle yükle" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /Bu dosyaları kullanma hakkım var/ })
    .check();
  await page.route(
    "**/api/spaces/properties/*/media-upload",
    (route) => route.abort(),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Dosyaları güvenle yükle" }).click();
  await expect(
    page.getByText("Tekrar denenebilir", { exact: true }),
  ).toHaveCount(1, { timeout: 30000 });
  await expect(
    page.getByRole("button", { name: "Dosyaları güvenle yükle" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Dosyaları güvenle yükle" }).click();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: true }),
  ).toHaveCount(2, { timeout: 30000 });
  await page
    .getByRole("button", { name: "Kaynak 2 yukarı", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Tarzını seç", exact: true }).last(),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Tarzını seç", exact: true })
    .last()
    .click();
  await page.getByRole("radio", { name: /Karma kurgu/ }).check();
  await page
    .getByRole("combobox", { name: "Sunum şablonu" })
    .selectOption("warm");
  await page
    .getByRole("combobox", { name: "Video uzunluğu" })
    .selectOption("4");
  await page.getByRole("button", { name: "Marka ve altyazı" }).click();
  await expect(
    page.getByRole("dialog", { name: "Küçük dokunuşlar" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const submitted = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/spaces/jobs") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "İçeriği oluştur", exact: true })
    .click();
  const job = (await (await submitted).json()) as {
    id: string;
    property_id: string;
  };
  const preview = page.getByLabel("Oluşturulan video önizlemesi");
  await expect(preview).toBeVisible({ timeout: 60000 });
  await expect
    .poll(() => preview.evaluate((v) => (v as HTMLVideoElement).readyState))
    .toBeGreaterThan(0);
  const measured = await preview.evaluate((v) => ({
    width: (v as HTMLVideoElement).videoWidth,
    height: (v as HTMLVideoElement).videoHeight,
    duration: (v as HTMLVideoElement).duration,
  }));
  expect(measured.width).toBe(360);
  expect(measured.height).toBe(640);
  expect(measured.duration).toBeGreaterThan(3.8);
  expect(measured.duration).toBeLessThan(4.2);
  await expect(
    page.getByRole("button", { name: "İndir", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/yetkili başka bir incelemeci/)).toBeVisible();
  const before = await page.request.post(
    `/api/spaces/jobs/${job.id}/download-grant`,
    { headers: { Origin: origin }, data: {} },
  );
  expect(before.status()).toBe(403);
  const reviewer = await browser.newContext();
  const reviewPage = await reviewer.newPage();
  await post(reviewPage, "/session", { identityId: "demo-reviewer-a" });
  await reviewPage.goto(`/spaces/manage?property=${job.property_id}`);
  await reviewPage.getByRole("button", { name: "İncele", exact: true }).click();
  await expect(
    reviewPage.getByLabel("Gerçek yerel video çıktısı"),
  ).toBeVisible();
  for (const label of [
    "Hak ve sentetik kaynak",
    "Mimari kanıt / bilinmeyen alanlar",
    "Süreklilik / dosya bütünlüğü",
    "Demo ve sınırlamalar açık",
  ])
    await reviewPage
      .getByRole("checkbox", { name: label, exact: true })
      .check();
  await reviewPage
    .getByRole("button", { name: "Bağımsız onay", exact: true })
    .click();
  await expect(
    reviewPage.getByText("Değiştirilemez inceleme kararı kaydedildi.", {
      exact: true,
    }),
  ).toBeVisible();
  // A visitor returns to the creator tab after reviewing in another context.
  // Real visibility/focus refresh avoids relying on throttled background timers.
  await page.bringToFront();
  await expect(
    page.getByRole("button", { name: "İndir", exact: true }),
  ).toBeEnabled({ timeout: 10000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "İndir", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("spaces-dikey.mp4");
  await preview.evaluate(async (v) => {
    const video = v as HTMLVideoElement;
    await video.play();
    video.pause();
  });
  await expect
    .poll(() => preview.evaluate((v) => (v as HTMLVideoElement).readyState))
    .toBeGreaterThanOrEqual(2);
  await page.screenshot({
    path: `artifacts/screenshots/v3-${info.project.name}-result.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel("Oluşturulan video önizlemesi")).toBeVisible({
    timeout: 15000,
  });
  expect(outside).toEqual([]);
  await reviewer.close();
});

test("intake rejects unsupported media, wrong grants and hidden role escalation", async ({
  page,
}) => {
  await page.goto("/spaces");
  await page.getByLabel("Fotoğraf veya video seç").setInputFiles({
    name: "bad.mov",
    mimeType: "video/quicktime",
    buffer: Buffer.from("unsupported"),
  });
  await expect(page.locator(".ux-studio").getByRole("alert")).toContainText(
    "MOV/WebM desteklenmiyor",
  );
  await post(page, "/session", { identityId: "demo-admin-a" });
  const p = await post<{ id: string }>(page, "/properties", {
    title: "Synthetic access boundary",
    syntheticOnly: true,
  });
  const buffer = await photo();
  const g = await post<{ token: string }>(
    page,
    `/properties/${p.id}/media-grant`,
    {
      filename: "photo.png",
      mime: "image/png",
      byteLength: buffer.length,
      revision: 1,
    },
  );
  const falseMime = await page.request.post(
    `/api/spaces/properties/${p.id}/media-upload`,
    {
      headers: {
        Origin: origin,
        "Content-Type": "video/mp4",
        "x-spaces-grant": g.token,
        "x-spaces-rights": "synthetic-owned-metadata-v1",
      },
      data: buffer,
    },
  );
  expect(falseMime.status()).toBe(415);
  const uploaded = await page.request.post(
    `/api/spaces/properties/${p.id}/media-upload`,
    {
      headers: {
        Origin: origin,
        "Content-Type": "image/png",
        "x-spaces-grant": g.token,
        "x-spaces-rights": "synthetic-owned-metadata-v1",
      },
      data: buffer,
    },
  );
  expect(uploaded.status()).toBe(201);
  const asset = (await uploaded.json()) as { id: string };
  const replay = await page.request.post(
    `/api/spaces/properties/${p.id}/media-upload`,
    {
      headers: {
        Origin: origin,
        "Content-Type": "image/png",
        "x-spaces-grant": g.token,
        "x-spaces-rights": "synthetic-owned-metadata-v1",
      },
      data: buffer,
    },
  );
  expect(replay.status()).toBe(409);
  const readGrant = await post<{ token: string }>(
    page,
    `/assets/${asset.id}/grant`,
    {},
  );
  const removed = await page.request.patch(
    `/api/spaces/properties/${p.id}/media`,
    { headers: { Origin: origin }, data: { revision: 1, assetIds: [] } },
  );
  expect(removed.status()).toBe(200);
  const staleRead = await page.request.get(`/api/spaces/assets/${asset.id}`, {
    headers: { "x-spaces-grant": readGrant.token },
  });
  expect(staleRead.status()).toBe(403);
  await post(page, "/session", { identityId: "demo-admin-b" });
  const foreign = await page.request.post(
    `/api/spaces/properties/${p.id}/media-upload`,
    {
      headers: {
        Origin: origin,
        "Content-Type": "image/png",
        "x-spaces-grant": g.token,
        "x-spaces-rights": "synthetic-owned-metadata-v1",
      },
      data: buffer,
    },
  );
  expect(foreign.status()).toBe(404);
  await post(page, "/session", { identityId: "demo-viewer-a" });
  await page.goto("/spaces");
  await expect(
    page.getByRole("button", { name: "Fotoğraf veya video ekle", exact: true }),
  ).toBeDisabled();
  const denied = await page.request.patch(
    `/api/spaces/properties/${p.id}/media`,
    { headers: { Origin: origin }, data: { revision: 1, assetIds: [] } },
  );
  expect(denied.status()).toBe(403);
  await page.goto("/spaces/manage");
  await expect(
    page.getByRole("button", { name: "Operasyon", exact: true }),
  ).toHaveCount(0);
  for (const endpoint of ["/analytics", "/partner", "/credits"]) {
    const r = await page.request.get("/api/spaces" + endpoint);
    expect(r.status()).toBeGreaterThanOrEqual(400);
  }
});

test("replace and remove preserve an owned project without exposing removed media", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/spaces");
  await page.getByLabel("Fotoğraf veya video seç").setInputFiles([
    { name: "bir.png", mimeType: "image/png", buffer: await photo() },
    { name: "iki.png", mimeType: "image/png", buffer: await photo() },
  ]);
  await page
    .getByRole("checkbox", { name: /Bu dosyaları kullanma hakkım var/ })
    .check();
  await page.getByRole("button", { name: "Dosyaları güvenle yükle" }).click();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: true }),
  ).toHaveCount(2, { timeout: 15000 });
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Kaynak 1 değiştir", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "yeni.webp",
    mimeType: "image/webp",
    buffer: await sharp(await photo())
      .webp()
      .toBuffer(),
  });
  await page.getByRole("button", { name: "Dosyaları güvenle yükle" }).click();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: true }),
  ).toHaveCount(2);
  await expect(page.getByText("Yüklemeye hazır", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Kaynak 2 kaldır", exact: true })
    .click();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: true }),
  ).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: true }),
  ).toHaveCount(1, { timeout: 15000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("sample shortcut creates a scoped real local draft without replacing visitor uploads or release review", async ({
  page,
}) => {
  await page.goto("/spaces");
  await expect(
    page.getByRole("button", { name: "Fotoğraf veya video ekle", exact: true }),
  ).toBeEnabled();
  const fixture = page.waitForResponse(
    (r) => r.url().endsWith("/fixture") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Örnek mülkle dene", exact: true })
    .click();
  expect((await fixture).ok()).toBe(true);
  await expect(
    page.getByRole("heading", {
      name: "Nasıl bir video istersin?",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Doğal keşif/ }).check();
  await expect(page.getByRole("radio", { name: /Doğal keşif/ })).toBeChecked();
  await page
    .getByRole("button", { name: "Medyanı düzenle", exact: true })
    .click();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Örnek mülkle dene", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "İnceleme alanı", exact: true }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
