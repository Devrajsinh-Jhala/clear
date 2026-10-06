import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ learnerId: "11111111-1111-4111-8111-111111111111", store: null as unknown, generate: vi.fn(), account: null as { id: string } | null }));
vi.mock("@/src/lib/learning/session", () => ({ currentLearnerId: async () => state.learnerId }));
vi.mock("@/src/lib/auth/session", () => ({ currentAccount: async () => state.account }));
vi.mock("@/src/lib/security/limits/store", () => ({ getLimitStore: () => state.store }));
vi.mock("@/src/lib/ai/providers/gemini", () => ({
  geminiProvider: { id: "gemini", displayName: "Gemini", capabilities: {}, generate: state.generate },
  resolveLessonModel: () => "gemini-3.6-flash",
}));

import { getProvider } from "@/src/lib/ai/router";
import { requestContext } from "@/src/lib/api/context";
import { withApiGuard } from "@/src/lib/api/guard";
import { consumeState, emptyLimitState, releaseState } from "@/src/lib/security/limits/engine";
import type { LimitStore } from "@/src/lib/security/limits/types";

function request(origin = "https://clear.example") {
  return new Request("https://clear.example/api/explanations", { method: "POST", headers: { Origin: origin } });
}
const input = { model: "gemini-3.6-flash", messages: [{ role: "user" as const, content: "Synthetic lesson" }] };

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  for (const name of ["CLEAR_AI_PAUSED", "CLEAR_FREE_PAUSED", "CLEAR_RATE_GENERATION_IP_LIMIT", "CLEAR_RATE_GENERATION_GUEST_LIMIT", "GUEST_DAILY_REQUEST_LIMIT", "CLEAR_FREE_IP_DAILY_LIMIT", "CLEAR_FREE_GLOBAL_DAILY_LIMIT"]) vi.stubEnv(name, "");
  const storage = emptyLimitState();
  state.store = { consume: async (charges, lease) => consumeState(storage, charges, lease, Date.now()), release: async (key, token) => releaseState(storage, key, token) } satisfies LimitStore;
  state.account = null;
  state.generate.mockReset().mockResolvedValue({ text: "Synthetic response" });
});
afterEach(() => vi.unstubAllEnvs());

describe("HTTP admission around actual model dispatch", () => {
  it("rejects cross-origin or missing-origin writes before any quota or work", async () => {
    const consume = vi.fn();
    state.store = { consume, release: vi.fn() };
    const handler = vi.fn(async () => Response.json({ ok: true }));
    for (const value of ["https://other.example", ""]) expect((await withApiGuard(request(value), "generation", handler)).status).toBe(403);
    expect(consume).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
  it("returns a retry time and private caching on request throttling", async () => {
    vi.stubEnv("CLEAR_RATE_GENERATION_IP_LIMIT", "1");
    const handler = vi.fn(async () => Response.json({ ok: true }));
    expect((await withApiGuard(request(), "generation", handler)).status).toBe(200);
    const denied = await withApiGuard(request(), "generation", handler);
    expect(denied.status).toBe(429);
    expect(Number(denied.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(denied.headers.get("Cache-Control")).toContain("no-store");
    expect(handler).toHaveBeenCalledTimes(1);
  });
  it("fails closed when durable admission storage fails", async () => {
    state.store = { consume: async () => { throw new Error("PRIVATE database exception"); }, release: vi.fn() };
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const response = await withApiGuard(request(), "generation", handler);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE");
    expect(handler).not.toHaveBeenCalled();
  });
  it("charges repeated Gemini dispatches including a repair, before invoking the adapter", async () => {
    vi.stubEnv("GUEST_DAILY_REQUEST_LIMIT", "1");
    const provider = getProvider("gemini");
    await requestContext.run({ request: request(), action: "generation" }, async () => {
      await provider.generate(input);
      await expect(provider.generate(input)).rejects.toMatchObject({ status: 429 });
    });
    expect(state.generate).toHaveBeenCalledTimes(1);
  });
  it("does not spend the free quota for a connected key and still honors pause", async () => {
    vi.stubEnv("GUEST_DAILY_REQUEST_LIMIT", "0");
    const provider = getProvider("gemini");
    await requestContext.run({ request: request(), action: "generation" }, async () => {
      await provider.generate(input, { apiKey: "synthetic-owned-key" });
      vi.stubEnv("CLEAR_AI_PAUSED", "true");
      await expect(provider.generate(input, { apiKey: "synthetic-owned-key" })).rejects.toMatchObject({ status: 503 });
    });
    expect(state.generate).toHaveBeenCalledTimes(1);
  });
});
