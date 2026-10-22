import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/components/**/*.test.tsx"],
    maxWorkers: 2,
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts", "src/application/**/*.ts", "src/adapters/fake/**/*.ts"],
      reporter: ["text", "json-summary", "lcov"],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 }
    }
  }
});
