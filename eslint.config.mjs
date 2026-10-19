import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import globals from "globals";

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@supabase/*", "@aws-sdk/*", "openai", "@anthropic-ai/*", "stripe", "pg", "@temporalio/*"],
          message: "Phase 1 is local-only. External adapters require a separately authorized phase."
        }]
      }]
    }
  },
  globalIgnores([".next/**", "coverage/**", "playwright-report/**", "test-results/**", "artifacts/**"])
]);
