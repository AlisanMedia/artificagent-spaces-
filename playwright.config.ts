import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }], ["json", { outputFile: "test-results/e2e-results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
        launchOptions: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"]
          ? { executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] } : {}
      }
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        launchOptions: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"]
          ? { executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] } : {}
      }
    }
  ],
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env["CI"],
    timeout: 90_000
  }
});
