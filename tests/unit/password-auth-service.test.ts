import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn(), login: vi.fn(), signup: vi.fn(), claims: vi.fn(), logout: vi.fn() }));
vi.mock("@/src/lib/auth/server", () => ({ requireAuthClient: mocks.client }));

import { signInWithPassword, signUpWithPassword } from "@/src/lib/auth/service";

const ID = "550e8400-e29b-41d4-a716-446655440000";
const EMAIL = "synthetic@example.test";
const PASSWORD = " private password with spaces ";
const SECRET = "PRIVATE_UPSTREAM_PASSWORD_TOKEN_ACCOUNT_DETAILS";
const claims = () => ({ sub: ID, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
const signedIn = () => ({ data: { user: { id: ID }, session: { access_token: SECRET, refresh_token: SECRET } }, error: null });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ auth: { signInWithPassword: mocks.login, signUp: mocks.signup, getClaims: mocks.claims, signOut: mocks.logout } });
  mocks.login.mockResolvedValue(signedIn());
  mocks.signup.mockResolvedValue(signedIn());
  mocks.claims.mockResolvedValue({ data: { claims: claims() }, error: null });
  mocks.logout.mockResolvedValue({ error: null });
});

describe("email/password authentication service", () => {
  it("preserves the password exactly and verifies the resulting sign-in identity", async () => {
    expect(await signInWithPassword(EMAIL, PASSWORD)).toBeUndefined();
    expect(mocks.login).toHaveBeenCalledExactlyOnceWith({ email: EMAIL, password: PASSWORD });
    expect(mocks.claims).toHaveBeenCalledOnce();
    expect(mocks.logout).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 422])("uses a generic401 for rejected credentials with upstream status%s", async (status) => {
    mocks.login.mockResolvedValue({ data: { user: null, session: null }, error: { status, message: SECRET } });
    await expect(signInWithPassword(EMAIL, PASSWORD)).rejects.toMatchObject({ code: "auth_failed", status: 401, retryable: false, message: "The email or password was not accepted. Check both and try again." });
    expect(mocks.claims).not.toHaveBeenCalled();
  });

  it("never reports sign-in from a user object without an authenticated session", async () => {
    mocks.login.mockResolvedValue({ data: { user: { id: ID }, session: null }, error: null });
    await expect(signInWithPassword(EMAIL, PASSWORD)).rejects.toMatchObject({ status: 401 });
    expect(mocks.claims).not.toHaveBeenCalled();
  });

  it.each([
    { ...claims(), sub: "550e8400-e29b-41d4-a716-446655440001" },
    { ...claims(), aud: "anonymous" },
    { ...claims(), role: "anon" },
    { ...claims(), is_anonymous: true },
    { ...claims(), exp: 1 },
  ])("rejects invalid verified claims and clears the local session", async (invalid) => {
    mocks.claims.mockResolvedValue({ data: { claims: invalid }, error: null });
    await expect(signInWithPassword(EMAIL, PASSWORD)).rejects.toMatchObject({ code: "auth_failed", status: 503 });
    expect(mocks.logout).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });

  it("returns no raw detail when verification or the SDK throws", async () => {
    mocks.claims.mockRejectedValue(new Error(SECRET));
    mocks.logout.mockRejectedValue(new Error(SECRET));
    await expect(signInWithPassword(EMAIL, PASSWORD)).rejects.toMatchObject({ status: 503, message: expect.not.stringContaining(SECRET) });
    mocks.login.mockRejectedValue(new Error(SECRET));
    await expect(signInWithPassword(EMAIL, PASSWORD)).rejects.toMatchObject({ status: 503, message: expect.not.stringContaining(SECRET) });
    mocks.signup.mockRejectedValue(new Error(SECRET));
    await expect(signUpWithPassword(EMAIL, PASSWORD)).rejects.toMatchObject({ status: 503, message: expect.not.stringContaining(SECRET) });
  });

  it("returns a retryable generic failure for upstream rate limits and outages", async () => {
    for (const method of [mocks.login, mocks.signup]) {
      method.mockResolvedValueOnce({ data: { user: null, session: null }, error: { status: 429, message: SECRET } });
    }
    await expect(signInWithPassword(EMAIL, PASSWORD)).rejects.toMatchObject({ status: 429, retryable: true, message: expect.not.stringContaining(SECRET) });
    await expect(signUpWithPassword(EMAIL, PASSWORD)).rejects.toMatchObject({ status: 429, retryable: true, message: expect.not.stringContaining(SECRET) });
    mocks.login.mockResolvedValue({ data: { user: null, session: null }, error: { status: 503, message: SECRET } });
    await expect(signInWithPassword(EMAIL, PASSWORD)).rejects.toMatchObject({ status: 503, retryable: true });
  });

  it("reports immediate signup only after verifying the returned session", async () => {
    expect(await signUpWithPassword(EMAIL, PASSWORD)).toEqual({ signedIn: true, needsConfirmation: false });
    expect(mocks.signup).toHaveBeenCalledExactlyOnceWith({ email: EMAIL, password: PASSWORD });
    expect(mocks.claims).toHaveBeenCalledOnce();
  });

  it("reports confirmation-needed without fabricating a session or revealing account existence", async () => {
    for (const user of [{ id: ID, identities: [] }, null]) {
      mocks.signup.mockResolvedValue({ data: { user, session: null }, error: null });
      expect(await signUpWithPassword(EMAIL, PASSWORD)).toEqual({ signedIn: false, needsConfirmation: true });
    }
    expect(mocks.claims).not.toHaveBeenCalled();
    expect(mocks.logout).not.toHaveBeenCalled();
  });

  it("rejects an unverified signup session instead of returning success", async () => {
    mocks.claims.mockResolvedValue({ data: { claims: { ...claims(), sub: "550e8400-e29b-41d4-a716-446655440001" } }, error: null });
    await expect(signUpWithPassword(EMAIL, PASSWORD)).rejects.toMatchObject({ code: "auth_failed", status: 503 });
    expect(mocks.logout).toHaveBeenCalledWith({ scope: "local" });
    mocks.signup.mockResolvedValue({ data: { user: null, session: { access_token: SECRET } }, error: null });
    await expect(signUpWithPassword(EMAIL, PASSWORD)).rejects.toMatchObject({ status: 503 });
  });

  it("does not disclose duplicate accounts or password-policy details from the upstream response", async () => {
    mocks.signup.mockResolvedValue({ data: { user: null, session: null }, error: { status: 422, message: `${EMAIL} ${PASSWORD} ${SECRET}` } });
    await expect(signUpWithPassword(EMAIL, PASSWORD)).rejects.toMatchObject({ status: 400, retryable: false, message: "An account could not be created. Check your details or try signing in." });
  });
});
