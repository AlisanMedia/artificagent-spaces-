/** Local-only, source-bound screenshots; never overwrites historical evidence. */
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
const before = process.argv.includes("--before");
const origin = `http://127.0.0.1:${before ? 3008 : 3000}`;
const out = join(
  resolve(
    process.env["SPACES_V55_EVIDENCE_DIR"] ?? ".spaces-local/v55/screenshots",
  ),
  `${before ? "before" : "after"}-${Date.now()}`,
);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const rows = [];
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.route("**/*", (r) =>
    r.request().url().startsWith(origin) ||
    /^(blob|data):/.test(r.request().url())
      ? r.continue()
      : r.abort(),
  );
  await page.goto(origin + "/spaces");
  await expect(
    page.getByRole("button", { name: "Fotoğraf veya video ekle", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  async function capture(width, state) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    expect(overflow).toBe(false);
    const file = `${width}-${state}.png`;
    await page.screenshot({ path: out + "/" + file, fullPage: true });
    rows.push({
      width,
      state,
      overflow,
      file,
      sha256: createHash("sha256")
        .update(await readFile(out + "/" + file))
        .digest("hex"),
    });
  }
  for (const width of [375, 390, 430, 768, 1024, 1280, 1440])
    await capture(width, "studio");
  await page
    .getByRole("button", { name: "Örnek mülkle dene", exact: true })
    .click();
  await expect(page.getByRole("radio", { name: /Doğal Tur/ })).toBeChecked({
    timeout: 30000,
  });
  for (const width of [390, 1440]) await capture(width, "styles");
  if (!before) {
    await page.goto(origin + "/spaces/showcase");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const width of [375, 390, 430, 768, 1024, 1280, 1440])
      await capture(width, "showcase");
    for (const product of ["video", "ai-3d", "tour-360"]) {
      await page
        .getByRole("button", {
          name:
            product === "video"
              ? "Video örnekleri"
              : product === "ai-3d"
                ? "3D örneği"
                : "360° örneği",
          exact: true,
        })
        .click();
      if (product !== "video")
        await page
          .getByRole("button", {
            name:
              product === "ai-3d"
                ? "3D örneğini başlat"
                : "360° örneğini başlat",
            exact: true,
          })
          .click();
      if (product !== "video")
        await expect(page.locator("canvas").last()).toBeVisible();
      for (const width of [390, 1440]) await capture(width, product);
    }
  }
  await writeFile(
    out + "/measurements.json",
    JSON.stringify(
      {
        source: before
          ? "d4603f70639b1a88859c9b2f6c1cf3d821ada101"
          : execFileSync("git", ["rev-parse", "HEAD"], {
              encoding: "utf8",
            }).trim(),
        localChanges: !before,
        syntheticOnly: true,
        deployed: false,
        rows,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      out,
      screenshots: rows.length,
      horizontalOverflow: false,
    }),
  );
} finally {
  await browser.close();
}
