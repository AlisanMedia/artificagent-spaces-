import { defineConfig, devices } from "@playwright/test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
// Each run owns a fresh private synthetic database. Never reuse an operator's workspace or delete prior evidence.
const e2eRoot = join(process.cwd(), ".spaces-local", "e2e");
mkdirSync(e2eRoot, { recursive: true, mode: 0o700 });
const e2eData = mkdtempSync(join(e2eRoot, "run-"));

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  workers: 2,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/e2e-results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3000",
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
        launchOptions: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"]
          ? {
              executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"],
              args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
            }
          : {
              args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
            },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        launchOptions: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"]
          ? {
              executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"],
              args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
            }
          : {
              args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
            },
      },
    },
  ],
  webServer: {
    command: "npm run start",
    env: { SPACES_LOCAL_DATA_DIR: e2eData },
    url: "http://127.0.0.1:3000/api/spaces/bootstrap",
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
