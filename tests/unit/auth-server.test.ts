import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), cookies: vi.fn(), set: vi.fn(), getAll: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));

import { createAuthClient, requireAuthClient } from "@/src/lib/auth/server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.set.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-public-project-key");
  vi.stubEnv("NODE_ENV", "production");
  mocks.getAll.mockReturnValue([]);
  mocks.cookies.mockResolvedValue({ getAll: mocks.getAll, set: mocks.set });
  mocks.create.mockReturnValue({ synthetic: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("server authentication cookies", () => {
  it("creates a request-specific client with awaited cookies and getAll/setAll", async () => {
    await createAuthClient();
    await createAuthClient();
    expect(mocks.cookies).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    const settings = mocks.create.mock.calls[0][2];
    expect(settings.cookies.getAll()).toEqual([]);
    settings.cookies.setAll([{ name: "synthetic-session", value: "synthetic", options: { httpOnly: false, secure: false } }]);
    expect(mocks.set).toHaveBeenCalledWith("synthetic-session", "synthetic", expect.objectContaining({ httpOnly: true, sameSite: "lax", secure: true, path: "/" }));
  });
  it("allows read-only rendering while requiring OTP route writes to succeed", async () => {
    mocks.set.mockImplementation(() => { throw new Error("Read-only render cookies"); });
    await createAuthClient();
    expect(() => mocks.create.mock.calls[0][2].cookies.setAll([{ name: "synthetic-session", value: "synthetic", options: {} }])).not.toThrow();
    await createAuthClient({ writable: true });
    expect(() => mocks.create.mock.calls[1][2].cookies.setAll([{ name: "synthetic-session", value: "synthetic", options: {} }])).toThrow("Your sign-in could not be saved.");
  });
  it("uses the legacy public anon key without ever passing a service-role key", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-secret-not-for-auth-client");
    await createAuthClient();
    expect(mocks.create.mock.calls[0][1]).toBe("synthetic-anon-key");
  });
  it("keeps guest rendering available and returns an explicit sign-in unavailable error without project settings", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    expect(await createAuthClient()).toBeNull();
    await expect(requireAuthClient()).rejects.toMatchObject({ code: "auth_unavailable", status: 503 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
