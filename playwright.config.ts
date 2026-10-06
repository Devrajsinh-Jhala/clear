import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// A production build with synthetic lessons must never read the developer's records.
const dataDirectory = process.env.CLEAR_E2E_DATA_DIR ?? mkdtempSync(path.join(os.tmpdir(), "clear-e2e-"));
process.env.CLEAR_E2E_DATA_DIR = dataDirectory;
const baseURL = "https://localhost:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  reporter: [["list"], ["html", { outputFolder: ".data/e2e-report", open: "never" }], ["./tests/e2e/cleanup-reporter.ts"]],
  outputDir: ".data/e2e-results",
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 25_000,
    serviceWorkers: "block",
    // Animation is decoration. Reduced motion gives every check a settled page.
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "node tests/e2e/server.mjs",
    url: baseURL,
    ignoreHTTPSErrors: true,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      CLEAR_DATA_DIR: dataDirectory,
      CLEAR_E2E_DATA_DIR: dataDirectory,
      CLEAR_LIMITS_DIRECTORY: path.join(dataDirectory, "limits"),
      CLEAR_LIMITS_SECRET: "clear-synthetic-browser-limit-secret-2026-10",
      CLEAR_PROVIDER: "mock",
      CLEAR_AI_PAUSED: "false",
      CLEAR_FREE_PAUSED: "false",
      CLEAR_TRUSTED_IP_HEADER: "",
      CLEAR_PROVIDER_CONCURRENCY_LIMIT: "8",
      GUEST_DAILY_REQUEST_LIMIT: "300",
      USER_DAILY_REQUEST_LIMIT: "300",
      CLEAR_FREE_GLOBAL_DAILY_LIMIT: "1000",
      CLEAR_FREE_IP_DAILY_LIMIT: "1000",
      GEMINI_API_KEY: "",
      GEMINI_MODEL: "gemini-3.5-flash-lite",
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
      SUPABASE_URL: "",
      SUPABASE_ANON_KEY: "",
      APP_ENCRYPTION_KEY: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=",
      SENTRY_DSN: "",
      NEXT_PUBLIC_SENTRY_DSN: "",
      VERCEL: "",
      AWS_LAMBDA_FUNCTION_NAME: "",
      FUNCTIONS_WORKER_RUNTIME: "",
      // Exercise the real limiter with test-sized allowances; limiter boundaries have unit coverage.
      CLEAR_RATE_GENERATION_GUEST_LIMIT: "300",
      CLEAR_RATE_GENERATION_IP_LIMIT: "1000",
      CLEAR_RATE_MUTATION_GUEST_LIMIT: "500",
      CLEAR_RATE_MUTATION_IP_LIMIT: "3000",
      CLEAR_RATE_EXPORT_GUEST_LIMIT: "500",
      CLEAR_RATE_EXPORT_IP_LIMIT: "3000",
      CLEAR_RATE_SHARE_GUEST_LIMIT: "300",
      CLEAR_RATE_SHARE_IP_LIMIT: "2000",
      CLEAR_RATE_SKILL_GUEST_LIMIT: "300",
      CLEAR_RATE_SKILL_IP_LIMIT: "1000",
      CLEAR_RATE_AUTH_GUEST_LIMIT: "100",
      CLEAR_RATE_AUTH_IP_LIMIT: "1000",
    },
  },
});
