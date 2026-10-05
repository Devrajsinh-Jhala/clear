import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: state.rpc }) }));

import { createSupabaseLimitStore } from "@/src/lib/security/limits/supabase-store";

beforeEach(() => { state.rpc.mockReset(); });

describe("shared Supabase limiter contract", () => {
  it("sends admission charges and concurrency lease together in one atomic RPC", async () => {
    state.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    const store = createSupabaseLimitStore("https://synthetic.supabase.co", "server-only-key");
    const charge = { key: "free:global", amount: 2, limit: 100, mode: "utc-day" as const, windowMs: 86_400_000, kind: "global-quota" as const };
    const lease = { key: "provider:hash", token: "11111111-1111-4111-8111-111111111111", limit: 8, ttlMs: 120_000 };
    expect(await store.consume([charge], lease)).toEqual({ allowed: true });
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("clear_consume_limits", { p_charges: [charge], p_lease: lease });
  });

  it("returns the server's denial and Retry-After rather than a client clock estimate", async () => {
    state.rpc.mockResolvedValue({ data: { allowed: false, kind: "global-quota", retryAfterSeconds: 41 }, error: null });
    const store = createSupabaseLimitStore("https://synthetic.supabase.co", "server-only-key");
    expect(await store.consume([])).toEqual({ allowed: false, kind: "global-quota", retryAfterSeconds: 41 });
    expect(state.rpc).toHaveBeenCalledWith("clear_consume_limits", { p_charges: [], p_lease: null });
  });

  it("fails closed for missing migrations, network/database errors and malformed responses", async () => {
    const store = createSupabaseLimitStore("https://synthetic.supabase.co", "server-only-key");
    for (const result of [
      { data: null, error: { message: "PRIVATE_DATABASE_DETAILS" } },
      { data: null, error: null },
      { data: { allowed: "yes" }, error: null },
      { data: { allowed: false, kind: "arbitrary-private-error", retryAfterSeconds: 10 }, error: null },
      { data: { allowed: false, kind: "rate", retryAfterSeconds: 0 }, error: null },
    ]) {
      state.rpc.mockResolvedValueOnce(result);
      await expect(store.consume([])).rejects.toMatchObject({ code: "limits_unavailable", status: 503, message: expect.not.stringContaining("PRIVATE") });
    }
  });

  it("releases exactly the caller's lease token through the server-only RPC", async () => {
    state.rpc.mockResolvedValue({ data: null, error: null });
    const store = createSupabaseLimitStore("https://synthetic.supabase.co", "server-only-key");
    await store.release("provider:hash", "11111111-1111-4111-8111-111111111111");
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("clear_release_limit_lease", { p_key: "provider:hash", p_token: "11111111-1111-4111-8111-111111111111" });
    state.rpc.mockResolvedValue({ data: null, error: { message: "PRIVATE_RELEASE_ERROR" } });
    await expect(store.release("provider:hash", "11111111-1111-4111-8111-111111111111")).rejects.toMatchObject({ status: 503 });
  });
});
