import { defineConfig, devices } from "@playwright/test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
const parent = join(process.cwd(), ".spaces-local", "v01-browser");
mkdirSync(parent, { recursive: true, mode: 0o700 });
const root = mkdtempSync(join(parent, "run-"));
// Own private DB, signed offline permit and exact fixture hashes. Never reuses owner data or opens egress.
export default defineConfig({
  timeout: 60_000,
  testDir: "tests/v01",
  outputDir: "test-results/v01-output",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/v01/results.json" }],
  ],
  metadata: { privateFixtureRoot: root },
  use: {
    baseURL: "http://127.0.0.1:3008",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  projects: [
    {
      name: "v01-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    { name: "v01-mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm exec tsx scripts/v01-offline-demo.ts -- --serve",
    env: { SPACES_V01_DEMO_ROOT: root },
    url: "http://127.0.0.1:3008/api/spaces/bootstrap",
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
