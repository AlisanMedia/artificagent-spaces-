import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir } from "node:fs/promises";
import {
  EvaluationRecord,
  summarizeEvaluations,
  UX_TASKS,
} from "../../src/domain/usability-evaluation";

test("evaluation is a separate accessible page, empty by default, with safe mobile/keyboard controls", async ({
  page,
}) => {
  await page.goto("/spaces/");
  const popup = page.waitForEvent("popup");
  await page.getByRole("link", { name: /Değerlendirme formu/ }).click();
  const evaluation = await popup;
  await expect(evaluation.getByRole("heading", { level: 1 })).toContainText(
    "Deneyimi",
  );
  await expect(
    evaluation.getByRole("button", {
      name: "Yanıtı JSON olarak indir",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    evaluation.getByText("Henüz ölçülmedi", { exact: true }),
  ).toHaveCount(6);
  for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
    await evaluation.setViewportSize({ width, height: 844 });
    expect(
      await evaluation.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    expect(
      (
        await new AxeBuilder({ page: evaluation })
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
  await evaluation.getByLabel("Katılımcı kodu", { exact: true }).focus();
  await expect(
    evaluation.getByLabel("Katılımcı kodu", { exact: true }),
  ).toBeFocused();
  await evaluation.keyboard.press("ArrowDown");
  await expect(
    evaluation.getByLabel("Katılımcı kodu", { exact: true }),
  ).toHaveValue("P02");
  await evaluation.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await evaluation
      .getByRole("button", { name: "Yanıtları temizle", exact: true })
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
  await evaluation.close();
});

test("explicit opt-in exports only a structured synthetic rehearsal locally; no PII or submission", async ({
  page,
  baseURL,
}) => {
  const posts: string[] = [],
    outside: string[] = [];
  const allowedOrigin = new URL(baseURL!).origin;
  page.on("request", (r) => {
    if (r.method() !== "GET") posts.push(r.method());
    if (new URL(r.url()).origin !== allowedOrigin)
      outside.push(new URL(r.url()).origin);
  });
  // Deterministic clock is test-only; these are never real participant measurements.
  await page.clock.install();
  await page.goto("/evaluation/");
  await page
    .getByLabel("Kayıt türü", { exact: true })
    .selectOption("SYNTHETIC_REHEARSAL");
  await page.getByLabel("Cihaz", { exact: true }).selectOption("MOBILE");
  await page.getByLabel("Tarayıcı", { exact: true }).selectOption("CHROMIUM");
  for (const task of UX_TASKS) {
    const group = page.getByRole("group", { name: new RegExp(task.title) });
    await group
      .getByRole("button", { name: "Süreyi başlat", exact: true })
      .click();
    await page.clock.fastForward(2000);
    await group
      .getByRole("button", { name: "Süreyi durdur", exact: true })
      .click();
    await expect(
      group.getByRole("button", { name: "Süreyi başlat", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel(`${task.title} sonucu`, { exact: true })
      .selectOption("SUCCESS_UNASSISTED");
  }
  await page
    .getByRole("radio", {
      name: "Önceden hazırlanmış bir örnek video gösterildi.",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", { name: /Yalnız bu yapılandırılmış/ })
    .check();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Yanıtı JSON olarak indir", exact: true })
    .click();
  const file = await (await download).path();
  expect(file).not.toBeNull();
  const record = EvaluationRecord.parse(
    JSON.parse(await readFile(file!, "utf8")),
  );
  expect(record.recordKind).toBe("SYNTHETIC_REHEARSAL");
  expect(record.tasks.every((t) => t.elapsedSeconds !== null)).toBe(true);
  expect(summarizeEvaluations([record], record.sourceHead)).toMatchObject({
    status: "NOT_RUN",
    syntheticRecordsExcluded: 1,
    eligibleSelfReportedRecords: 0,
    independentHumanAcceptance: "NOT_VERIFIED",
  });
  expect(posts).toEqual([]);
  expect(outside).toEqual([]);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.evaluate(() => document.cookie)).toBe("");
  await expect(
    page.getByRole("status", { name: "Kayıt bildirimi", exact: true }),
  ).toContainText("sunucuya gönderilmedi");
  await page.reload();
  await expect(page.getByText("Henüz ölçülmedi", { exact: true })).toHaveCount(
    6,
  );
  await expect(
    page.getByRole("button", { name: "Yanıtı JSON olarak indir", exact: true }),
  ).toBeDisabled();
});

test("withdrawal erases answers and running timer; incomplete exports remain blocked", async ({
  page,
}) => {
  await page.goto("/evaluation/");
  const consent = page.getByRole("checkbox", {
    name: /Yalnız bu yapılandırılmış/,
  });
  await consent.check();
  await page
    .getByRole("button", { name: "Yanıtı JSON olarak indir", exact: true })
    .click();
  await expect(page.getByLabel("Kayıt türü", { exact: true })).toBeFocused();
  await page
    .getByLabel("Kayıt türü", { exact: true })
    .selectOption("SYNTHETIC_REHEARSAL");
  await page
    .getByLabel("Yüklemeye başlayın sonucu", { exact: true })
    .selectOption("FAILED");
  await page
    .getByRole("group", { name: /Yüklemeye başlayın/ })
    .getByRole("button", { name: "Süreyi başlat", exact: true })
    .click();
  await consent.uncheck();
  await expect(
    page.getByLabel("Yüklemeye başlayın sonucu", { exact: true }),
  ).toHaveValue("");
  await expect(
    page
      .getByRole("group", { name: /Yüklemeye başlayın/ })
      .getByRole("button", { name: "Süreyi durdur", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Yanıtı JSON olarak indir", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("status", { name: "Kayıt bildirimi", exact: true }),
  ).toContainText("Form temizlendi");
  // Changing the slot must never copy the previous person's answers or consent.
  await page
    .getByLabel("Kayıt türü", { exact: true })
    .selectOption("SYNTHETIC_REHEARSAL");
  await page
    .getByLabel("Yüklemeye başlayın sonucu", { exact: true })
    .selectOption("FAILED");
  await consent.check();
  await page.getByLabel("Katılımcı kodu", { exact: true }).selectOption("P02");
  await expect(
    page.getByLabel("Yüklemeye başlayın sonucu", { exact: true }),
  ).toHaveValue("");
  await expect(page.getByLabel("Kayıt türü", { exact: true })).toHaveValue("");
  await expect(consent).not.toBeChecked();
  await expect(page.getByLabel("Katılımcı kodu", { exact: true })).toHaveValue(
    "P02",
  );
  await expect(page.getByText("Henüz ölçülmedi", { exact: true })).toHaveCount(
    6,
  );
});

test("protocol and evaluator never expose answers or privileged APIs; accepted studio stays upload-first", async ({
  page,
  request,
}, info) => {
  const resources: string[] = [];
  page.on("request", (r) => resources.push(r.url()));
  await page.goto("/spaces/");
  await page.evaluate(() => document.fonts.ready);
  expect(resources.some((u) => u.includes("evaluation"))).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  const b = await page
    .getByRole("button", { name: "Fotoğraf veya video ekle", exact: true })
    .boundingBox();
  expect(b!.y + b!.height).toBeLessThanOrEqual(844);
  await expect(page.locator("input[type=file]")).toHaveCount(1);
  const protocol = await (
    await request.get("/evaluation/protocol.json")
  ).json();
  expect(protocol).toMatchObject({
    plannedIndependentProfessionals: 5,
    genuineParticipants: null,
    acceptance: "NOT_RUN",
    submissionEndpoint: null,
  });
  for (const path of [
    "/evaluation/P01.json",
    "/evaluation/responses/P01.json",
    "/api/evaluation",
    "/api/spaces/bootstrap",
    "/spaces/manage",
    "/.env",
  ])
    expect((await request.get(path)).status()).toBe(404);
  expect(
    (
      await request.post("/evaluation/", { data: { participantCode: "P01" } })
    ).status(),
  ).toBe(405);
  await mkdir("test-results/v53-evaluation-screens", { recursive: true });
  await page.setViewportSize({
    width: info.project.name === "desktop" ? 1440 : 390,
    height: info.project.name === "desktop" ? 1000 : 844,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `test-results/v53-evaluation-screens/${info.project.name}-studio.png`,
    fullPage: true,
  });
  await page.goto("/evaluation/");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `test-results/v53-evaluation-screens/${info.project.name}.png`,
    fullPage: true,
  });
});
