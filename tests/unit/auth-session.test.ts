import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getClaims: vi.fn(), getSession: vi.fn(), create: vi.fn() }));
vi.mock("@/src/lib/auth/server", () => ({ createAuthClient: auth.create }));

import { requestContext } from "@/src/lib/api/context";
import { accountFromClaims } from "@/src/lib/auth/claims";
import { currentAccount, requireAccount } from "@/src/lib/auth/session";

const ID = "550e8400-e29b-41d4-a716-446655440000";
const claims = () => ({ sub: ID, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, email: "synthetic@example.test" });

beforeEach(() => {
  vi.clearAllMocks();
  auth.create.mockResolvedValue({ auth: { getClaims: auth.getClaims, getSession: auth.getSession } });
  auth.getClaims.mockResolvedValue({ data: { claims: claims() }, error: null });
});

describe("verified account identity", () => {
  it("uses verified claims and never trusts getSession", async () => {
    expect(await currentAccount()).toEqual({ id: ID, email: "synthetic@example.test" });
    expect(auth.getClaims).toHaveBeenCalledOnce();
    expect(auth.getSession).not.toHaveBeenCalled();
  });
  it("caches identity only within the current guarded request", async () => {
    const request = new Request("https://clear.example.test/api/synthetic");
    await requestContext.run({ request, action: "mutation" }, async () => {
      await Promise.all([currentAccount(), currentAccount(), requireAccount()]);
    });
    expect(auth.getClaims).toHaveBeenCalledOnce();
    await requestContext.run({ request: new Request(request.url), action: "mutation" }, currentAccount);
    expect(auth.getClaims).toHaveBeenCalledTimes(2);
  });
  it("rejects a forged or expired cookie even if it contains a plausible user", async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: claims() }, error: { message: "Signature verification failed" } });
    expect(await currentAccount()).toBeNull();
    await expect(requireAccount()).rejects.toMatchObject({ status: 401, code: "sign_in_required" });
  });
  it("leaves guest behavior available when authentication is not configured", async () => {
    auth.create.mockResolvedValue(null);
    expect(await currentAccount()).toBeNull();
    expect(auth.getClaims).not.toHaveBeenCalled();
  });
  it("rejects wrong audiences, service roles, anonymous accounts and invalid subjects", () => {
    for (const patch of [{ aud: "another-app" }, { role: "service_role" }, { is_anonymous: true }, { sub: "not-a-uuid" }, { exp: 1 }, { exp: undefined }]) expect(accountFromClaims({ ...claims(), ...patch })).toBeNull();
    expect(accountFromClaims({ ...claims(), aud: ["authenticated", "extra"] })).toMatchObject({ id: ID });
  });
});
