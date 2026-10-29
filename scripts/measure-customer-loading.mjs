/** Repeatable local lab observation, not real-device/CWV certification or analytics. */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const out = resolve(".spaces-local/v55/loading-" + Date.now());
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const rows = [];
try {
  for (const path of ["/spaces", "/spaces/showcase"]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__spacesLab = { lcp: null, cls: 0 };
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        window.__spacesLab.lcp = entries.at(-1)?.startTime ?? null;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (!e.hadRecentInput) window.__spacesLab.cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 80,
      downloadThroughput: 1_000_000,
      uploadThroughput: 125_000,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("http://127.0.0.1:3000" + path);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.waitForTimeout(2000);
    const m = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      return {
        ...window.__spacesLab,
        ttfbMs: n.responseStart - n.requestStart,
        domContentLoadedMs: n.domContentLoadedEventEnd,
        resources: performance
          .getEntriesByType("resource")
          .map((r) => ({ type: r.initiatorType, bytes: r.transferSize })),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    rows.push({
      path,
      viewport: "390x844",
      network: "80ms latency / 8Mbps down / 1Mbps up; cold browser cache",
      cpuThrottle: 4,
      observationWindowAfterDomMs: 2000,
      syntheticOnly: true,
      ...m,
      lcpTargetMet: m.lcp !== null && m.lcp <= 2500,
      clsTargetMet: m.cls <= 0.1,
    });
    await context.close();
  }
  await writeFile(
    join(out, "measurements.json"),
    JSON.stringify(
      {
        realDeviceSafari: "NOT_VERIFIED",
        fieldCoreWebVitals: "NOT_VERIFIED",
        singleRunNotSla: true,
        externalSpendUsd: 0,
        rows,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      out,
      rows: rows.map(({ resources, ...r }) => ({
        ...r,
        transferBytes: resources.reduce((s, x) => s + x.bytes, 0),
      })),
    }),
  );
} finally {
  await browser.close();
}
