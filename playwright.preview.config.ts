import { defineConfig } from "@playwright/test";
const remote = process.env["SPACES_PREVIEW_URL"];
if (remote) {
  const u = new URL(remote);
  if (u.protocol !== "https:" || !u.hostname.endsWith(".vercel.app"))
    throw Error("VERIFIED_VERCEL_PREVIEW_URL_REQUIRED");
}
export default defineConfig({
  testDir: "./tests/preview",
  outputDir: "test-results/preview-artifacts",
  forbidOnly: true,
  retries: 0,
  workers: 2,
  timeout: 90000,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/preview/results.json" }],
  ],
  use: {
    baseURL: remote ?? "http://127.0.0.1:3100",
    reducedMotion: "reduce",
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  ...(!remote
    ? {
        webServer: {
          command: "npm run preview:serve",
          url: "http://127.0.0.1:3100/spaces/",
          reuseExistingServer: false,
          timeout: 30000,
        },
      }
    : {}),
});
