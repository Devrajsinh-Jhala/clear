import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const root = path.resolve(__dirname, "../..");
const fixture = process.env.CLEAR_AUTH_UI_DIRECTORY ?? mkdtempSync(path.join(os.tmpdir(), "clear-auth-ui-"));
process.env.CLEAR_AUTH_UI_DIRECTORY = fixture;

export default defineConfig({
  testDir: "./auth-ui",
  testMatch: "**/*.ui.ts",
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  outputDir: path.join(root, ".data/auth-ui-results"),
  reporter: [["list"], ["html", { outputFolder: path.join(root, ".data/auth-ui-report"), open: "never" }], ["./auth-ui/cleanup-reporter.ts"]],
  use: { baseURL: "http://127.0.0.1:3102", trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block", contextOptions: { reducedMotion: "reduce" } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node tests/e2e/auth-ui/server.mjs",
    cwd: root,
    url: "http://127.0.0.1:3102/auth",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      CLEAR_AUTH_UI_DIRECTORY: fixture,
      CLEAR_DATA_DIR: path.join(fixture, "data"),
      CLEAR_PROVIDER: "mock",
      GEMINI_API_KEY: "",
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      XAI_API_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_URL: "",
      SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
      SUPABASE_ACCESS_TOKEN: "",
      SENTRY_DSN: "",
      NEXT_PUBLIC_SENTRY_DSN: "",
      SENTRY_AUTH_TOKEN: "",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3102",
      VERCEL: "",
      AWS_LAMBDA_FUNCTION_NAME: "",
      FUNCTIONS_WORKER_RUNTIME: "",
    },
  },
});
