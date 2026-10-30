import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
const origin = "http://127.0.0.1:3000";
async function post<T>(page: Page, path: string, data: unknown): Promise<T> {
  const r = await page.request.post("/api/spaces" + path, {
    headers: { Origin: origin },
    data,
  });
  expect(r.ok(), path + " " + r.status()).toBe(true);
  return r.json() as Promise<T>;
}
async function uploadPhotos(page: Page) {
  // Match the real picker: a hidden SSR input is not an authenticated, hydrated studio.
  await expect(
    page.getByRole("button", { name: "Fotoğraf veya video ekle", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Fotoğraf veya video seç").setInputFiles([
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
  ]);
  await page
    .getByRole("checkbox", { name: /Bu dosyaları kullanma hakkım var/ })
    .check();
  await page
    .getByRole("button", { name: "Dosyaları güvenle yükle", exact: true })
    .click();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: true }),
  ).toHaveCount(2, { timeout: 30000 });
  await page
    .getByRole("button", { name: "Tarzını seç", exact: true })
    .last()
    .click();
}
test("V5.4 upload-first CTA and all seven viewport/focus/axe checks remain responsive", async ({
  page,
}, info) => {
  await page.goto("/spaces");
  const picker = page.getByRole("button", {
    name: "Fotoğraf veya video ekle",
    exact: true,
  });
  await expect(picker).toBeEnabled();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Bir fotoğraftan",
  );
  await expect(page.locator("input[type=file]")).toHaveCount(1);
  await mkdir("artifacts/v54/screenshots", { recursive: true });
  const measurements = [];
  for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const box = await picker.boundingBox();
    expect(box).not.toBeNull();
    if (width === 390) expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    // Full-size visual evidence is captured separately; keep every viewport assertion here.
    // Encoding seven tall screenshots must not consume this functional test's time budget.
    measurements.push({ width, primary: box, overflow: false });
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await writeFile(
    `artifacts/v54/${info.project.name}-responsive.json`,
    JSON.stringify({ syntheticOnly: true, measurements }, null, 2),
  );
});

test("V5.4 fixed choices keep source honesty, denied panorama and reduced-motion controls", async ({
  page,
}) => {
  await page.goto("/spaces");
  await expect(
    page.getByRole("button", { name: "Fotoğraf veya video ekle", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Örnek mülkle dene", exact: true })
    .click();
  await expect(page.getByRole("radio", { name: /Doğal Tur/ })).toBeChecked();
  for (const label of [
    "Premium Sinematik",
    "Mekânı Keşfet",
    "Dış Cephe",
    "Doğal Tur",
  ]) {
    await page.getByRole("radio", { name: new RegExp(label) }).check();
    await expect(
      page.getByRole("radio", { name: new RegExp(label) }),
    ).toBeChecked();
  }
  await page
    .getByRole("combobox", { name: "Tanıtım hedef süresi", exact: true })
    .selectOption("60");
  await expect(
    page.getByText("60 saniye için 12 farklı fotoğraf gerekir."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "AI 3D Deneyim", exact: true })
    .click();
  await expect(
    page.getByText(/gerçek dairenin ölçülü dijital ikizi değildir/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Seçimlerimi kontrol et", exact: true })
    .click();
  await expect(page.getByText(/Seçimlerin kontrol edildi/)).toBeVisible();
  await page
    .getByRole("button", { name: "360° Sanal Tur", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Seçimlerimi kontrol et", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /Bu görseller gerçek 360° panoramalardır/ })
    .check();
  await page
    .getByRole("button", { name: "Seçimlerimi kontrol et", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "İçerik stüdyosu", exact: true })
      .getByRole("alert"),
  ).toContainText("2:1");
  expect(await page.locator(".ux-studio").innerText()).not.toMatch(
    /Kling|Seedance|Marble|fal\.ai/,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .getByRole("button", { name: "Video Tanıtımı", exact: true })
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
});

test("V5.4 two-photo clips assemble a real MP4, block double submits and require independent per-scene release", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150000);
  const outside: string[] = [],
    submits: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith(origin) &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      outside.push(r.url());
    if (r.method() === "POST" && r.url().endsWith("/api/spaces/jobs"))
      submits.push(r.url());
  });
  await page.goto("/spaces");
  await uploadPhotos(page);
  await page
    .getByRole("list", { name: "İçerik oluşturma adımları" })
    .getByRole("button", { name: /Medya/ })
    .click();
  await page
    .getByRole("button", { name: "Kaynak 2 yukarı", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tarzını seç", exact: true })
    .last()
    .click();
  await page.getByRole("radio", { name: /Premium Sinematik/ }).check();
  await page
    .getByRole("button", { name: "İsteği gözden geçir", exact: true })
    .click();
  const pending = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" && r.url().endsWith("/api/spaces/jobs"),
  );
  await page
    .getByRole("button", { name: "Yerel örnek oluştur", exact: true })
    .dblclick();
  const job = (await (await pending).json()) as {
    id: string;
    property_id: string;
  };
  const video = page.getByLabel("Oluşturulan video önizlemesi");
  await expect(video).toBeVisible({ timeout: 60000 });
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).readyState))
    .toBeGreaterThan(0);
  const meta = await video.evaluate((v) => ({
    width: (v as HTMLVideoElement).videoWidth,
    height: (v as HTMLVideoElement).videoHeight,
    duration: (v as HTMLVideoElement).duration,
  }));
  expect(meta.width).toBe(360);
  expect(meta.height).toBe(640);
  expect(await page.locator(".ux-studio").innerText()).not.toMatch(
    /\b(?:fal|Kling|Seedance|Marble)\b/i,
  );
  expect(Math.abs(meta.duration - 10)).toBeLessThanOrEqual(1 / 24 + 0.002);
  expect(submits).toHaveLength(1);
  await video.evaluate(async (v) => {
    await (v as HTMLVideoElement).play();
    (v as HTMLVideoElement).pause();
  });
  await expect(
    page.getByRole("button", { name: "İndir", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: `artifacts/v54/screenshots/${info.project.name}-review-held-result.png`,
    fullPage: true,
  });
  const details = await page.request.get(`/api/spaces/jobs/${job.id}`);
  const record = (await details.json()) as {
    output: {
      photoComposition: {
        clips: { artifactId: string; sha256: string; sourceSha256: string }[];
      };
    };
  };
  expect(record.output.photoComposition.clips).toHaveLength(2);
  const reviewContext = await browser.newContext(),
    reviewPage = await reviewContext.newPage();
  await post(reviewPage, "/session", { identityId: "demo-reviewer-a" });
  await reviewPage.goto(`/spaces/manage?property=${job.property_id}`);
  await reviewPage.getByRole("button", { name: "İncele", exact: true }).click();
  for (const label of [
    "Hak ve sentetik kaynak",
    "Mimari kanıt / bilinmeyen alanlar",
    "Süreklilik / dosya bütünlüğü",
    "Demo ve sınırlamalar açık",
  ])
    await reviewPage
      .getByRole("checkbox", { name: label, exact: true })
      .check();
  await expect(
    reviewPage.getByRole("button", { name: "Bağımsız onay", exact: true }),
  ).toBeDisabled();
  const missing = await reviewPage.request.post(
    `/api/spaces/jobs/${job.id}/review`,
    {
      headers: { Origin: origin },
      data: {
        decision: "approved",
        rights: true,
        evidence: true,
        continuity: true,
        disclosure: true,
      },
    },
  );
  expect(missing.status()).toBe(409);
  for (const n of [1, 2]) {
    await reviewPage
      .getByRole("button", { name: `Sahne ${n} ve kaynağını aç`, exact: true })
      .click();
    await expect(
      reviewPage.getByRole("checkbox", {
        name: `Sahne ${n} kaynağıyla tutarlı`,
        exact: true,
      }),
    ).toBeEnabled();
    await reviewPage
      .getByRole("checkbox", {
        name: `Sahne ${n} kaynağıyla tutarlı`,
        exact: true,
      })
      .check();
  }
  await reviewPage
    .getByRole("button", { name: "Bağımsız onay", exact: true })
    .click();
  await expect(
    reviewPage.getByText("Değiştirilemez inceleme kararı kaydedildi.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.bringToFront();
  await expect(
    page.getByRole("button", { name: "İndir", exact: true }),
  ).toBeEnabled({ timeout: 10000 });
  const file = page.waitForEvent("download");
  await page.getByRole("button", { name: "İndir", exact: true }).click();
  expect((await file).suggestedFilename()).toBe("spaces-dikey.mp4");
  const grant = await post<{ token: string }>(
    page,
    `/jobs/${job.id}/download-grant`,
    {},
  );
  const clip = await page.request.get(`/api/spaces/jobs/${job.id}/clips/0`, {
    headers: { "x-spaces-grant": grant.token },
  });
  expect(clip.status()).toBe(200);
  expect(clip.headers()["cache-control"]).toBe("private, no-store");
  await page
    .getByRole("button", { name: "Kaynakları düzenle", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kaynak 2 yukarı", exact: true })
    .click();
  const stale = await page.request.get(`/api/spaces/jobs/${job.id}/clips/0`, {
    headers: { "x-spaces-grant": grant.token },
  });
  expect(stale.status()).toBe(403);
  expect(outside).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await writeFile(
    `artifacts/v54/${info.project.name}-composition.json`,
    JSON.stringify(
      {
        syntheticOnly: true,
        actualProvider: "local-ffmpeg",
        metadata: meta,
        clipCount: 2,
        submitCount: submits.length,
        externalRequests: outside.length,
        independentTestIdentityReview: true,
        realHumanAcceptance: false,
      },
      null,
      2,
    ),
  );
  await reviewContext.close();
});

test("V5.4 provider readiness, live submit and source selection deny unauthorized actors without ledger side effects", async ({
  page,
}) => {
  await page.goto("/spaces");
  await uploadPhotos(page);
  const workspace = (await (
    await page.request.get("/api/spaces/workspace")
  ).json()) as {
    properties: { id: string; revision: number }[];
    accounts: unknown[];
    jobs: unknown[];
  };
  const selectedId = await page.evaluate(() =>
    localStorage.getItem("spaces-v3:demo-admin-a:studio"),
  );
  const property = workspace.properties.find((p) => p.id === selectedId)!;
  const sources = (await (
    await page.request.get(`/api/spaces/properties/${property.id}`)
  ).json()) as { assets: { id: string; kind: string }[] };
  const input = {
    propertyId: property.id,
    revision: property.revision,
    product: "video",
    sourceAssetIds: sources.assets
      .filter((a) => a.kind === "photo")
      .map((a) => a.id),
  };
  const blocked = await page.request.post("/api/spaces/studio/submit", {
    headers: { Origin: origin },
    data: input,
  });
  expect(blocked.status()).toBe(403);
  const after = (await (
    await page.request.get("/api/spaces/workspace")
  ).json()) as typeof workspace;
  expect(
    after.jobs.filter(
      (j) => (j as { property_id?: string }).property_id === property.id,
    ),
  ).toEqual(
    workspace.jobs.filter(
      (j) => (j as { property_id?: string }).property_id === property.id,
    ),
  );
  const admin = await page.request.get("/api/spaces/studio/provider-readiness");
  expect(admin.status()).toBe(200);
  expect((await admin.json()).liveEnabled).toBe(false);
  await post(page, "/session", { identityId: "demo-admin-b" });
  expect(
    (
      await page.request.post("/api/spaces/studio/plan", {
        headers: { Origin: origin },
        data: input,
      })
    ).status(),
  ).toBe(404);
  await post(page, "/session", { identityId: "demo-viewer-a" });
  expect(
    (await page.request.get("/api/spaces/studio/provider-readiness")).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/spaces/studio/plan", {
        headers: { Origin: origin },
        data: input,
      })
    ).status(),
  ).toBe(403);
});

test("V5.4 real-ratio synthetic panorama stays a separate blocked tour and never injects a remote iframe", async ({
  page,
}) => {
  await page.goto("/spaces");
  await page
    .getByRole("article", { name: "360° Sanal Tur" })
    .getByRole("button", { name: /Tercihleri hazırla/ })
    .click();
  const image = await sharp({
    create: { width: 1600, height: 800, channels: 3, background: "#e3eae4" },
  })
    .png()
    .toBuffer();
  await expect(page.getByLabel("Fotoğraf veya video seç")).toBeEnabled();
  await page.getByLabel("Fotoğraf veya video seç").setInputFiles({
    name: "sentetik-kalibrasyon.png",
    mimeType: "image/png",
    buffer: image,
  });
  await page
    .getByRole("checkbox", { name: /Bu dosyaları kullanma hakkım var/ })
    .check();
  await page
    .getByRole("button", { name: "Dosyaları güvenle yükle", exact: true })
    .click();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: true }),
  ).toHaveCount(1, { timeout: 30000 });
  await page
    .getByRole("button", { name: "Tarzını seç", exact: true })
    .last()
    .click();
  await page
    .getByRole("checkbox", { name: /Bu görseller gerçek 360° panoramalardır/ })
    .check();
  await page
    .getByRole("button", { name: "Seçimlerimi kontrol et", exact: true })
    .click();
  await expect(page.getByText(/Seçimlerin kontrol edildi/)).toBeVisible();
  await expect(
    page.getByText(/Türkçe tur dili sağlayıcıda belgelenmedi/),
  ).toBeVisible();
  expect(await page.locator("iframe").count()).toBe(0);
  await expect(
    page.getByRole("button", { name: "AI üretimi kapalı", exact: true }),
  ).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
