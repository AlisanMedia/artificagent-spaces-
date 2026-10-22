import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = "http://127.0.0.1:3000";
async function post<T>(page: Page, path: string, data: unknown): Promise<T> {
  const response = await page.request.post("/api/spaces" + path, {
    data,
    headers: { Origin: origin },
  });
  expect(response.ok(), path + " HTTP " + response.status()).toBe(true);
  return response.json() as Promise<T>;
}
async function login(page: Page, identityId = "demo-admin-a") {
  await post(page, "/session", { identityId });
}
async function generatedTour(page: Page, mode: string) {
  await login(page);
  const property = await post<{ id: string }>(page, "/properties", {
    title: "Browser synthetic " + crypto.randomUUID().slice(0, 8),
    syntheticOnly: true,
  });
  await post(page, `/properties/${property.id}/fixture`, {});
  const job = await post<{ id: string }>(page, "/jobs", {
    propertyId: property.id,
    revision: 2,
    mode,
    idempotencyKey: crypto.randomUUID(),
    durationSeconds: 4,
  });
  await expect
    .poll(
      async () =>
        (
          (await (
            await page.request.get(`/api/spaces/jobs/${job.id}`)
          ).json()) as { state: string }
        ).state,
      { timeout: 90000 },
    )
    .toBe("awaiting-review");
  await login(page, "demo-reviewer-a");
  await post(page, `/jobs/${job.id}/review`, {
    decision: "approved",
    rights: true,
    evidence: true,
    continuity: true,
    disclosure: true,
  });
  await login(page);
  return post<{ token: string }>(page, `/jobs/${job.id}/publish`, {});
}
test("new platform has accessible responsive roles, CRUD and private source controls", async ({
  page,
}, info) => {
  await page.goto("/spaces");
  await expect(
    page.getByRole("button", { name: "Yerel oturumu aç" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Yerel oturumu aç" }).click();
  await expect(
    page.getByRole("heading", { name: "ArtificAgent Studio", exact: true }),
  ).toBeVisible();
  const title = "Browser CRUD " + info.project.name + " " + Date.now();
  await page
    .getByRole("textbox", { name: "Yeni sentetik mülk adı" })
    .fill(title);
  await page.getByRole("button", { name: "Mülk oluştur", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("E0 · geometri bilinmiyor", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('input[type="file"]')).toBeDisabled();
  await page.getByRole("checkbox", { name: /Yalnız sentetik/ }).check();
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  const ax = await new AxeBuilder({ page }).analyze();
  expect(ax.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await mkdir("artifacts/screenshots", { recursive: true });
  await page.screenshot({
    path: `artifacts/screenshots/${info.project.name}-spaces-platform.png`,
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Test kimliği" })
    .selectOption("demo-viewer-a");
  await page.getByRole("button", { name: "Test kimliğini değiştir" }).click();
  await expect(
    page.getByRole("button", { name: "Mülk oluştur", exact: true }),
  ).toHaveCount(0);
});
test("browser receives a real approved MP4, with consent optional and no external requests", async ({
  page,
}) => {
  test.setTimeout(120000);
  const external: string[] = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.protocol.startsWith("http") && u.hostname !== "127.0.0.1")
      external.push(u.origin);
  });
  const pub = await generatedTour(page, "cinematic");
  await page.goto("/tour/" + pub.token);
  const video = page.getByLabel("Onaylı gerçek MP4");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).readyState), {
      timeout: 20000,
    })
    .toBeGreaterThanOrEqual(1);
  expect(
    await video.evaluate((v) => (v as HTMLVideoElement).duration),
  ).toBeGreaterThan(3.8);
  await expect(
    page.getByRole("checkbox", {
      name: "Takma kimlikli oda / etkileşim analizi",
    }),
  ).not.toBeChecked();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Onaylı çıktıyı indir", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "spaces-approved.mp4",
  );
  const ax = await new AxeBuilder({ page }).analyze();
  expect(ax.violations).toEqual([]);
  expect(external).toEqual([]);
});
test("actual Blender 3D is freely walkable, collision bounded and guided by scoped local tools", async ({
  page,
}, info) => {
  test.setTimeout(150000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          throw new DOMException("denied", "NotAllowedError");
        },
      },
    });
  });
  const pub = await generatedTour(page, "interactive-3d");
  await page.goto("/tour/" + pub.token);
  const canvas = page.getByRole("application");
  await expect(canvas).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Blender mesh" }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("combobox", { name: "3D kalite" }).selectOption("low");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(canvas).toHaveAttribute("data-quality", "low");
  const initial = await canvas.getAttribute("data-position");
  await canvas.focus();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(400);
  await page.keyboard.up("KeyW");
  expect(await canvas.getAttribute("data-position")).not.toBe(initial);
  await page
    .getByRole("checkbox", { name: "Takma kimlikli oda / etkileşim analizi" })
    .check();
  await page.getByRole("checkbox", { name: "Yerel AI rehber oturumu" }).check();
  await page.getByRole("button", { name: "Seçimlerimi kaydet" }).click();
  await page
    .getByRole("button", { name: "İzinli yerel rehberi başlat" })
    .click();
  await expect(page.getByRole("log")).toContainText("AI rehber");
  await page.getByRole("button", { name: "Mikrofon iznini dene" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Mikrofon reddedildi" }),
  ).toBeVisible();
  const input = page.getByRole("textbox", { name: "Rehbere soru sor" });
  await input.fill("Salon kaç metrekare?");
  await page.getByRole("button", { name: "Soruyu gönder" }).click();
  await expect(page.getByRole("log")).toContainText("30 m²");
  await input.fill("Mutfak kaç metrekare?");
  await page.getByRole("button", { name: "Soruyu gönder" }).click();
  await expect(page.getByRole("log")).toContainText("rakam uydurmayacağım");
  await page.route("**/api/spaces/tour/voice/speak", (route) => route.abort());
  await input.fill("ağ kopma deneyi");
  await page.getByRole("button", { name: "Soruyu gönder" }).click();
  await expect(page.locator(".spaces-tour").getByRole("alert")).toBeVisible();
  await page.unroute("**/api/spaces/tour/voice/speak");
  await page.getByRole("button", { name: "Oturumu doğrula / sürdür" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "oturum yeniden doğrulandı" }),
  ).toBeVisible();
  await input.fill("Akşam ışığını göster");
  await page.getByRole("button", { name: "Soruyu gönder" }).click();
  await expect(
    page.getByRole("combobox", { name: "Günün zamanı" }),
  ).toHaveValue("evening");
  await input.fill("Balkona götür");
  await page.getByRole("button", { name: "Soruyu gönder" }).click();
  await expect(page.getByRole("log")).toContainText("doğrulanmış değil");
  await input.fill("Mutfak odasına götür");
  await page.getByRole("button", { name: "Soruyu gönder" }).click();
  await expect(canvas).toHaveAttribute("data-room", "kitchen", {
    timeout: 45000,
  });
  await expect(page.getByRole("log")).toContainText(
    "tamamlandığını doğruladı",
    { timeout: 45000 },
  );
  await page
    .getByRole("combobox", { name: "3D kalite" })
    .selectOption("balanced");
  await expect(canvas).toHaveAttribute("data-quality", "balanced");
  await expect(canvas).toHaveAttribute("data-room", "kitchen");
  await page.getByRole("combobox", { name: "3D kalite" }).selectOption("low");
  await expect(canvas).toHaveAttribute("data-quality", "low");
  await expect(canvas).toHaveAttribute("data-room", "kitchen");
  await page.getByRole("button", { name: "Bitir", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "İzinli yerel rehberi başlat" }),
  ).toBeVisible();
  const ax = await new AxeBuilder({ page }).analyze();
  expect(ax.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await canvas.scrollIntoViewIfNeeded();
  const oldSample = await canvas.getAttribute("data-fps-sample-at");
  await expect
    .poll(() => canvas.getAttribute("data-fps-sample-at"), { timeout: 20000 })
    .not.toBe(oldSample);
  await mkdir("artifacts/governance", { recursive: true });
  await writeFile(
    `artifacts/governance/renderer-${info.project.name}.json`,
    JSON.stringify({
      renderer: "headless SwiftShader test",
      quality: "low",
      lastObservedFps: Number(await canvas.getAttribute("data-fps")),
      actualGpuConcurrency: null,
      physicalDeviceVerified: false,
    }),
  );
  await page.screenshot({
    path: `artifacts/screenshots/${info.project.name}-spaces-freewalk.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Analizi geri çek / sil" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Analiz rızası geri çekildi" }),
  ).toBeVisible();
});
test("loopback API denies cross-tenant selectors, forged grants and cross-origin mutations", async ({
  page,
}) => {
  await login(page);
  const foreign = await page.request.get("/api/spaces/properties/property-b");
  expect(foreign.status()).toBe(404);
  const csrf = await page.request.post("/api/spaces/properties", {
    headers: { Origin: "https://evil.invalid" },
    data: { title: "bad", syntheticOnly: true },
  });
  expect(csrf.status()).toBe(403);
  const grant = await page.request.get(
    "/api/spaces/jobs/arbitrary/output?grant=forged",
  );
  expect(grant.status()).toBe(403);
  const disabled = await page.request.post(
    "/api/spaces/voice/elevenlabs-credential",
    { headers: { Origin: origin }, data: {} },
  );
  expect(disabled.status()).toBe(403);
});
