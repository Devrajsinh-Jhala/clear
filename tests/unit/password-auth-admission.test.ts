import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LimitStore } from "@/src/lib/security/limits/types";

const state = vi.hoisted(() => ({ login: vi.fn(), signup: vi.fn(), store: null as LimitStore | null, consume: vi.fn() }));
vi.mock("@/src/lib/auth/service", () => ({ signInWithPassword: state.login, signUpWithPassword: state.signup }));
vi.mock("@/src/lib/learning/session", () => ({ currentLearnerId: async () => undefined }));
vi.mock("@/src/lib/security/limits/store", () => ({ getLimitStore: () => state.store }));
vi.mock("@/src/lib/monitoring/server", () => ({ reportServerError: () => undefined, flushMonitoring: async () => undefined }));

import { POST as signIn } from "@/app/api/auth/sign-in/route";
import { POST as signUp } from "@/app/api/auth/sign-up/route";
import { ClearError } from "@/src/lib/api/errors";
import { consumeState, emptyLimitState, releaseState } from "@/src/lib/security/limits/engine";

const EMAIL = "synthetic@example.test";
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  for (const name of ["CLEAR_LIMITS_SECRET", "APP_ENCRYPTION_KEY", "CLEAR_TRUSTED_IP_HEADER", "CLEAR_RATE_AUTH_IP_LIMIT", "CLEAR_RATE_AUTH_GUEST_LIMIT", "CLEAR_RATE_AUTH_WINDOW_SECONDS"]) vi.stubEnv(name, "");
  state.login.mockReset().mockResolvedValue(undefined);
  state.signup.mockReset().mockResolvedValue({ signedIn: true, needsConfirmation: false });
  const storage = emptyLimitState();
  state.consume.mockReset().mockImplementation(async (charges, lease) => consumeState(storage, charges, lease, Date.now()));
  state.store = { consume: state.consume, release: async (key, token) => releaseState(storage, key, token) };
});
afterEach(() => { vi.unstubAllEnvs(); });

function request(body: unknown, action: "sign-in" | "sign-up" = "sign-in", origin = "https://clear.example"): Request {
  return new Request(`https://clear.example/api/auth/${action}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("password authentication admission", () => {
  it("trims the email, preserves the password, and returns no credentials or tokens", async () => {
    const response = await signIn(request({ email: ` ${EMAIL} `, password: " preserved password " }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ signedIn: true });
    expect(state.login).toHaveBeenCalledExactlyOnceWith(EMAIL, " preserved password ");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Vary")).toContain("Cookie");
  });

  it("permits existing short passwords at login but requires8characters for signup", async () => {
    expect((await signIn(request({ email: EMAIL, password: "x" }))).status).toBe(200);
    expect((await signUp(request({ email: EMAIL, password: "short" }, "sign-up"))).status).toBe(400);
    expect(state.signup).not.toHaveBeenCalled();
    const response = await signUp(request({ email: EMAIL, password: "eight888" }, "sign-up"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ signedIn: true, needsConfirmation: false });
  });

  it("keeps confirmation-needed distinct from signed-in signup", async () => {
    state.signup.mockResolvedValue({ signedIn: false, needsConfirmation: true });
    const response = await signUp(request({ email: EMAIL, password: "password123" }, "sign-up"));
    expect(await response.json()).toEqual({ signedIn: false, needsConfirmation: true });
  });

  it.each([
    { email: "not-an-email", password: "password123" },
    { email: `${"x".repeat(255)}@example.test`, password: "password123" },
    { email: EMAIL, password: "" },
    { email: EMAIL, password: "x".repeat(129) },
    { email: EMAIL, password: "password123", admin: true },
  ])("rejects invalid or extra fields before invoking an auth service", async (body) => {
    expect((await signIn(request(body))).status).toBe(400);
    expect((await signUp(request(body, "sign-up"))).status).toBe(400);
    expect(state.login).not.toHaveBeenCalled();
    expect(state.signup).not.toHaveBeenCalled();
  });

  it("rejects missing/cross-site Origin before any quota admission or auth work", async () => {
    for (const route of [signIn, signUp]) for (const origin of ["", "https://attacker.invalid"]) {
      expect((await route(request({ email: EMAIL, password: "password123" }, "sign-in", origin))).status).toBe(403);
    }
    expect(state.consume).not.toHaveBeenCalled();
    expect(state.login).not.toHaveBeenCalled();
    expect(state.signup).not.toHaveBeenCalled();
  });

  it("bounds request bytes before schema/auth work even without a size header", async () => {
    const oversized = request({ email: EMAIL, password: "x".repeat(3000) });
    const response = await signIn(oversized);
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("payload_too_large");
    expect(state.login).not.toHaveBeenCalled();
  });

  it("shares a durable auth rate bucket between signup and login and returns Retry-After", async () => {
    vi.stubEnv("CLEAR_RATE_AUTH_IP_LIMIT", "1");
    expect((await signIn(request({ email: EMAIL, password: "password123" }))).status).toBe(200);
    const denied = await signUp(request({ email: EMAIL, password: "password123" }, "sign-up"));
    expect(denied.status).toBe(429);
    expect(Number(denied.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(state.signup).not.toHaveBeenCalled();
  });

  it("fails closed on quota storage failure and retains generic login errors", async () => {
    state.consume.mockRejectedValueOnce(new Error("PRIVATE_DATABASE_DETAILS"));
    const unavailable = await signIn(request({ email: EMAIL, password: "password123" }));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("PRIVATE_DATABASE");
    expect(state.login).not.toHaveBeenCalled();
    state.login.mockRejectedValue(new ClearError("auth_failed", "The email or password was not accepted. Check both and try again.", { status: 401 }));
    const denied = await signIn(request({ email: EMAIL, password: "password123" }));
    expect(denied.status).toBe(401);
    expect((await denied.json()).error.code).toBe("auth_failed");
  });
});
