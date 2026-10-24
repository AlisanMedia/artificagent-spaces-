/** Synthetic static bundle only; 35 real screenshots + three cold Chromium lab samples. No deployment or customer input. */
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { previewServer } from "./serve-owner-preview.mjs";
const build = (
  await readFile(".spaces-local/preview-v5/latest-build.txt", "utf8")
).trim();
const meta = JSON.parse(
  await readFile(build + "/.vercel/output/static/build-manifest.json", "utf8"),
);
const evidenceVersion = process.argv.includes("--v53") ? "v53" : "v52";
const dir =
  evidenceVersion === "v53"
    ? ".spaces-local/v53/visual-evidence/screenshots"
    : "artifacts/screenshots/v52/after";
const detailsDir =
  evidenceVersion === "v53"
    ? ".spaces-local/v53/visual-evidence/measurements"
    : "artifacts/ui-v52";
await mkdir(dir, { recursive: true });
await mkdir(detailsDir, { recursive: true });
const server = await previewServer(build, 3111);
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
try {
  for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
    const height = width < 768 ? 844 : 1000;
    const ctx = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 768,
      hasTouch: width < 768,
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    const p = await ctx.newPage();
    await p.goto("http://127.0.0.1:3111/spaces/");
    await p.evaluate(() => document.fonts.ready);
    const primary = p.getByRole("button", {
      name: "Fotoğraf veya video ekle",
      exact: true,
    });
    await expect(primary).toBeEnabled();
    const box = await primary.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    const states = [];
    const shot = async (name) => {
      const file = `${dir}/${width}-${name}.png`;
      expect(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await p.screenshot({ path: file, fullPage: true });
      const b = await readFile(file);
      states.push({
        state: name,
        file,
        sha256: createHash("sha256").update(b).digest("hex"),
        bytes: b.length,
        overflow: false,
      });
    };
    await shot("studio");
    await p.locator("input[type=file]").setInputFiles([
      {
        name: "sentetik-salon.png",
        mimeType: "image/png",
        buffer: await readFile("public/golden-v5/living.png"),
      },
    ]);
    await expect(
      p.getByText("Yalnız bu tarayıcıda · sunucuya gönderilmedi", {
        exact: true,
      }),
    ).toBeVisible();
    await shot("files");
    await p.getByRole("button", { name: "Tarzını seç", exact: true }).click();
    await shot("styles");
    await p.getByRole("radio", { name: /Doğal keşif/ }).check();
    await p
      .getByRole("button", { name: "Hazır videoyu aç", exact: true })
      .click();
    await p.locator("video").evaluate(async (v) => {
      v.muted = true;
      await v.play();
    });
    await expect
      .poll(() => p.locator("video").evaluate((v) => v.currentTime))
      .toBeGreaterThan(0.2);
    await p.locator("video").evaluate((v) => v.pause());
    await shot("result");
    await p.getByRole("button", { name: "3D Tur", exact: true }).click();
    await p
      .getByRole("button", { name: "3D turu başlat", exact: true })
      .click();
    await expect(p.getByRole("application")).toHaveAttribute(
      "data-ready",
      "true",
      { timeout: 40000 },
    );
    await expect(
      p.getByText("Blender mesh · serbest gezinme hazır", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await expect
      .poll(
        async () =>
          Number(await p.getByRole("application").getAttribute("data-fps")),
        { timeout: 15000 },
      )
      .toBeGreaterThan(0);
    await shot("tour");
    results.push({
      width,
      height,
      primaryBox: box,
      primaryInFirstViewport: box.y + box.height <= height,
      visiblePrimaryPickers: 1,
      states,
    });
    await writeFile(
      `${detailsDir}/after-capture.json`,
      JSON.stringify(
        {
          phase:
            evidenceVersion === "v53" ? "V5.3_VISUAL_FREEZE" : "V5.2_AFTER",
          sourceHead: meta.sourceHead,
          sourceDirty: meta.sourceDirty,
          buildSha256: meta.buildSha256,
          synthetic: true,
          results,
        },
        null,
        2,
      ),
    );
    await ctx.close();
    console.log(
      `Captured ${evidenceVersion} width ${width} with 5 real states`,
    );
  }
  const performance = [];
  for (let i = 0; i < 3; i++) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 200000,
      uploadThroughput: 93750,
      connectionType: "cellular4g",
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await p.addInitScript(() => {
      window.__spacesPerf = { lcp: null, cls: 0 };
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__spacesPerf.lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries())
          if (!e.hadRecentInput) window.__spacesPerf.cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await p.goto("http://127.0.0.1:3111/spaces/");
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(4500);
    performance.push(
      await p.evaluate(() => ({
        ...window.__spacesPerf,
        transferBytes: performance
          .getEntriesByType("resource")
          .reduce((n, r) => n + r.transferSize, 0),
        resources: performance.getEntriesByType("resource").length,
      })),
    );
    await ctx.close();
  }
  await writeFile(
    `${detailsDir}/after-performance.json`,
    JSON.stringify(
      {
        sourceHead: meta.sourceHead,
        sourceDirty: meta.sourceDirty,
        buildSha256: meta.buildSha256,
        method: {
          viewport: "390x844 Chromium",
          cpuThrottle: 4,
          networkLatencyMs: 150,
          downloadBytesPerSecond: 200000,
          observationAfterLoadMs: 4500,
          coldContexts: 3,
          realIphone: false,
        },
        samples: performance,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      screenshots: results.reduce((n, r) => n + r.states.length, 0),
      performance,
    }),
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
