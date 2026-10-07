import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// Optional local file for the two test accounts. It is git-ignored (".env*") and never uploaded.
try {
  process.loadEnvFile(path.resolve(__dirname, "../../.env.live.local"));
} catch {
  // No file: the guest checks still run and the account checks are skipped.
}

const baseURL = (process.env.CLEAR_LIVE_URL ?? "https://clear-explainer.vercel.app").replace(/\/+$/, "");

/**
 * Checks against the deployed site. These create real records and make a few real
 * model calls, so they run only on request (`npm run test:live`), never in CI.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.live.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  outputDir: path.resolve(__dirname, "../../.data/live-results"),
  use: {
    baseURL,
    // Traces record typed values, including passwords. Keep them off.
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    serviceWorkers: "block",
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
