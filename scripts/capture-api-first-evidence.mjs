/** Real local synthetic UI evidence, separate from functional-test time budgets. No deployment. */
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const baseline = process.argv.includes("--baseline");
const origin = `http://127.0.0.1:${baseline ? 3008 : 3000}`;
const dir = `.spaces-local/v54/ui-${baseline ? "before" : "after"}-${Date.now()}`;
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const measurements = [];
const files = [];
const capture = async (page, width, state) => {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
  const file = `${width}-${state}.png`;
  await page.screenshot({
    path: `${dir}/${file}`,
    fullPage: true,
    timeout: 20000,
  });
  files.push({
    file,
    sha256: createHash("sha256")
      .update(await readFile(`${dir}/${file}`))
      .digest("hex"),
  });
  return { width, state, overflow };
};
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === origin || ["data:", "blob:"].includes(url.protocol)
      ? route.continue()
      : route.abort();
  });
  await page.goto(origin + "/spaces");
  const picker = page.getByRole("button", {
    name: "Fotoğraf veya video ekle",
    exact: true,
  });
  // A fresh local PGlite directory bootstraps migrations/fixtures before uploads become available.
  await expect(picker).toBeEnabled({ timeout: 30000 });
  await expect(page.locator("input[type=file]")).toHaveCount(1);
  for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
    const row = await capture(page, width, "studio");
    row.primary = await picker.boundingBox();
    if (width === 390)
      expect(row.primary.y + row.primary.height).toBeLessThanOrEqual(844);
    measurements.push(row);
  }
  await page
    .getByRole("button", { name: "Örnek mülkle dene", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: baseline ? /Doğal keşif/ : /Doğal Tur/ }),
  ).toBeChecked();
  for (const width of [390, 1440])
    measurements.push(await capture(page, width, "styles"));
  if (!baseline) {
    for (const [name, state] of [
      ["AI 3D Deneyim", "ai-3d"],
      ["360° Sanal Tur", "panorama"],
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(
        page.getByRole("button", { name: "AI üretimi kapalı", exact: true }),
      ).toBeDisabled();
      for (const width of [390, 1440])
        measurements.push(await capture(page, width, state));
    }
  }
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const sourceDirty = Boolean(
    execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
      encoding: "utf8",
    }).trim(),
  );
  await writeFile(
    `${dir}/measurements.json`,
    JSON.stringify(
      {
        syntheticOnly: true,
        externalSpendMicroUsd: 0,
        deployed: false,
        sourceSha,
        sourceDirty,
        sourceBinding: "CAPTURE_CHECKOUT_ONLY_APP_BUILD_VERIFIED_SEPARATELY",
        baseline,
        measurements,
        files,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      directory: dir,
      screenshots: files.length,
      horizontalOverflow: false,
      sourceSha,
      sourceDirty,
      deployed: false,
    }),
  );
} finally {
  await browser.close();
}
