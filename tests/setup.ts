import { vi } from "vitest";

// Server-only marks a Next bundle boundary; unit tests run in a Node server environment.
vi.mock("server-only", () => ({}));

// Tests stub the configuration they need with vi.stubEnv. Start each file from blank
// deployment settings so a developer shell or a CI job (which exports a mock provider
// and the browser-test origin for later steps) cannot change unit-test results.
for (const name of [
  "NEXT_PUBLIC_APP_URL",
  "CLEAR_ALLOWED_ORIGINS",
  "CLEAR_PROVIDER",
  "CLEAR_DATA_DIR",
  "CLEAR_TRUSTED_IP_HEADER",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "APP_ENCRYPTION_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "VERCEL",
  "VERCEL_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
]) {
  delete process.env[name];
}
