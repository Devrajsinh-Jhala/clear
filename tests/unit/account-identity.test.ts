import { afterEach, describe, expect, it, vi } from "vitest";
import { accountLearnerId } from "@/src/lib/learning/identity";
import { securityHeaders } from "@/src/lib/security/headers";
import { deploymentChecks } from "@/src/lib/deployment/config";

afterEach(() => vi.unstubAllEnvs());
describe("account identity and deployment boundaries", () => {
  it("separates the account vault from public UUIDs and persists across devices", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const account = "11111111-1111-4111-8111-111111111111";
    const identity = accountLearnerId(account);
    expect(identity).not.toBe(account);
    expect(identity).toMatch(/^[a-f0-9-]{36}$/);
    expect(accountLearnerId(account)).toBe(identity);
    expect(accountLearnerId("22222222-2222-4222-8222-222222222222")).not.toBe(identity);
    vi.stubEnv("APP_ENCRYPTION_KEY", "");
    expect(() => accountLearnerId(account)).toThrow("Account storage");
  });
  it("restricts executable content with a request nonce in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    const headers = securityHeaders("synthetic-nonce");
    expect(headers["Content-Security-Policy"]).toContain("script-src 'self' 'nonce-synthetic-nonce' 'strict-dynamic'");
    expect(headers["Content-Security-Policy"]).not.toContain("unsafe-eval");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Permissions-Policy"]).toContain("microphone=(self)");
    expect(headers["Cache-Control"]).toContain("no-store");
  });
  it("does not label missing configuration as deployment ready or print values", () => {
    const checks = deploymentChecks({ NEXT_PUBLIC_APP_URL: "http://localhost:3000", APP_ENCRYPTION_KEY: "PRIVATE-invalid-key", CLEAR_PROVIDER: "mock" });
    expect(checks.every((check) => check.ready)).toBe(false);
    expect(JSON.stringify(checks)).not.toContain("PRIVATE");
  });
});
