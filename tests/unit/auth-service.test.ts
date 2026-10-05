import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn(), send: vi.fn(), verify: vi.fn(), claims: vi.fn(), logout: vi.fn() }));
vi.mock("@/src/lib/auth/server", () => ({ requireAuthClient: mocks.client }));

import { requestEmailCode, signOutAccount, verifyEmailCode } from "@/src/lib/auth/service";

const ID = "550e8400-e29b-41d4-a716-446655440000";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ auth: { signInWithOtp: mocks.send, verifyOtp: mocks.verify, getClaims: mocks.claims, signOut: mocks.logout } });
  mocks.send.mockResolvedValue({ error: null });
  mocks.verify.mockResolvedValue({ data: { user: { id: ID }, session: { access_token: "synthetic-secret-never-returned" } }, error: null });
  mocks.claims.mockResolvedValue({ data: { claims: { sub: ID, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 } }, error: null });
  mocks.logout.mockResolvedValue({ error: null });
});

describe("one-time email authentication", () => {
  it("requests an email code without a password or session response", async () => {
    expect(await requestEmailCode("synthetic@example.test")).toBeUndefined();
    expect(mocks.send).toHaveBeenCalledWith({ email: "synthetic@example.test", options: { shouldCreateUser: true } });
  });
  it("verifies the code and then verifies the resulting token identity", async () => {
    expect(await verifyEmailCode("synthetic@example.test", "123456")).toBeUndefined();
    expect(mocks.verify).toHaveBeenCalledWith({ email: "synthetic@example.test", token: "123456", type: "email" });
    expect(mocks.claims).toHaveBeenCalledOnce();
  });
  it("rejects mismatched verified identities without exposing session details", async () => {
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "550e8400-e29b-41d4-a716-446655440001", role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 } }, error: null });
    await expect(verifyEmailCode("synthetic@example.test", "123456")).rejects.toMatchObject({ code: "auth_failed", status: 503 });
    expect(mocks.logout).toHaveBeenCalledWith({ scope: "local" });
  });
  it("returns useful generic code errors without echoing upstream secrets or email lookup details", async () => {
    mocks.verify.mockResolvedValue({ data: { session: null, user: null }, error: { status: 400, message: "SECRET_UPSTREAM_DETAIL" } });
    await expect(verifyEmailCode("synthetic@example.test", "123456")).rejects.toMatchObject({ status: 400, message: "That code was not accepted. Check the email and code, or request a new one." });
  });
  it("signs out this browser rather than every device", async () => {
    await signOutAccount();
    expect(mocks.logout).toHaveBeenCalledWith({ scope: "local" });
  });
});
