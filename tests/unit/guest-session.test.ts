import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ value: undefined as string | undefined, set: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => name === "clear_learner" && jar.value ? { value: jar.value } : undefined,
    set: (name: string, value: string, options: unknown) => { jar.set(name, value, options); jar.value = value; },
  }),
}));

import { currentLearnerId, ensureLearnerId } from "@/src/lib/learning/session";

describe("guest browser identity", () => {
  beforeEach(() => { jar.value = undefined; jar.set.mockClear(); });
  afterEach(() => vi.unstubAllEnvs());

  it("creates an HttpOnly same-site random identity with a secure production cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const identity = await ensureLearnerId();
    expect(identity).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(jar.set).toHaveBeenCalledWith("clear_learner", identity, expect.objectContaining({ httpOnly: true, sameSite: "lax", secure: true, path: "/" }));
    await expect(currentLearnerId()).resolves.toBe(identity);
    await expect(ensureLearnerId()).resolves.toBe(identity);
    expect(jar.set).toHaveBeenCalledTimes(1);
  });

  it("reading a missing or invalid cookie does not claim a guest identity", async () => {
    for (const invalid of [undefined, "../private", "arbitrary", "00000000-0000-0000-0000-000000000000"]) {
      jar.value = invalid;
      await expect(currentLearnerId()).resolves.toBeUndefined();
      expect(jar.set).not.toHaveBeenCalled();
    }
    vi.stubEnv("NODE_ENV", "development");
    const identity = await ensureLearnerId();
    expect(identity).not.toBe("00000000-0000-0000-0000-000000000000");
    expect(jar.set).toHaveBeenCalledWith("clear_learner", identity, expect.objectContaining({ secure: false, httpOnly: true }));
  });
});
