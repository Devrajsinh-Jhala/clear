import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { actionPolicy } from "@/src/lib/security/limits/config";
import { consumeState, emptyLimitState, releaseState } from "@/src/lib/security/limits/engine";
import { createFileLimitStore } from "@/src/lib/security/limits/file-store";
import { hashLimitIdentity, trustedClientIp } from "@/src/lib/security/limits/identity";
import { checkRequestLimits, limitResponseHeaders, UsageLimitError, withModelLimits } from "@/src/lib/security/limits";
import { getLimitStore } from "@/src/lib/security/limits/store";
import type { LimitCharge, LimitLease, LimitState, LimitStore } from "@/src/lib/security/limits/types";

const folders: string[] = [];
const envNames = [
  "NODE_ENV", "CLEAR_LIMITS_SECRET", "APP_ENCRYPTION_KEY", "CLEAR_TRUSTED_IP_HEADER", "CLEAR_RATE_GENERATION_IP_LIMIT",
  "CLEAR_RATE_GENERATION_GUEST_LIMIT", "GUEST_DAILY_REQUEST_LIMIT", "USER_DAILY_REQUEST_LIMIT", "CLEAR_FREE_IP_DAILY_LIMIT", "CLEAR_FREE_GLOBAL_DAILY_LIMIT",
  "CLEAR_PROVIDER_CONCURRENCY_LIMIT", "CLEAR_FREE_PAUSED", "CLEAR_AI_PAUSED", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "VERCEL", "AWS_LAMBDA_FUNCTION_NAME", "FUNCTIONS_WORKER_RUNTIME", "CLEAR_LIMITS_DIRECTORY", "CLEAR_DATA_DIR",
];

beforeEach(() => {
  envNames.forEach((name) => vi.stubEnv(name, ""));
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});

function memoryStore(now = Date.parse("2026-10-05T12:00:00Z")): { store: LimitStore; state: LimitState } {
  const state = emptyLimitState();
  return {
    state,
    store: {
      consume: async (charges, lease) => consumeState(state, charges, lease, now),
      release: async (key, token) => releaseState(state, key, token),
    },
  };
}

function charge(key: string, limit = 2, amount = 1, mode: LimitCharge["mode"] = "rolling"): LimitCharge {
  return { key, limit, amount, mode, windowMs: mode === "rolling" ? 10_000 : 86_400_000, kind: "rate" };
}

function request(ip = "203.0.113.9", extraHeaders: Record<string, string> = {}): Request {
  return new Request("https://clear.example/api/explanations", { headers: { "x-edge-client-ip": ip, ...extraHeaders } });
}

function model(store: LimitStore, ip = "203.0.113.9", learnerId = randomUUID(), clearFree = true) {
  return { store, request: request(ip), learnerId, clearFree, providerId: "gemini" };
}

describe("rolling and daily admission engine", () => {
  it("uses a rolling window and returns the first time enough capacity is available", () => {
    const state = emptyLimitState();
    const rule = charge("bucket");
    expect(consumeState(state, [rule], undefined, 1000).allowed).toBe(true);
    expect(consumeState(state, [rule], undefined, 1100).allowed).toBe(true);
    expect(consumeState(state, [rule], undefined, 1200)).toEqual({ allowed: false, kind: "rate", retryAfterSeconds: 10 });
    expect(consumeState(state, [rule], undefined, 11_000).allowed).toBe(true);
    expect(state.events.bucket).toEqual([1000, 1100, 11_000]);
  });

  it("resets at UTC midnight and can reserve both calls in a comparison atomically", () => {
    const state = emptyLimitState();
    const rule = charge("daily", 2, 2, "utc-day");
    const beforeMidnight = Date.parse("2026-10-05T23:59:59.200Z");
    expect(consumeState(state, [rule], undefined, beforeMidnight).allowed).toBe(true);
    expect(consumeState(state, [rule], undefined, beforeMidnight)).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    expect(consumeState(state, [rule], undefined, Date.parse("2026-10-06T00:00:00Z")).allowed).toBe(true);
  });

  it("does not spend an earlier bucket when a later bucket rejects admission", () => {
    const state = emptyLimitState();
    const result = consumeState(state, [charge("available", 3), charge("exhausted", 0)], undefined, 2000);
    expect(result.allowed).toBe(false);
    expect(state.events).toEqual({});
  });

  it("releases only the matching concurrency lease and recovers a crashed caller at expiry", () => {
    const state = emptyLimitState();
    const lease: LimitLease = { key: "provider", token: "first", limit: 1, ttlMs: 120_000 };
    expect(consumeState(state, [charge("quota", 10)], lease, 1000).allowed).toBe(true);
    expect(consumeState(state, [charge("quota", 10)], { ...lease, token: "second" }, 2000)).toEqual({ allowed: false, kind: "concurrency", retryAfterSeconds: 119 });
    expect(state.events.quota).toHaveLength(1);
    releaseState(state, "provider", "wrong");
    expect(state.leases.provider).toHaveLength(1);
    expect(consumeState(state, [], { ...lease, token: "second" }, 121_000).allowed).toBe(true);
    releaseState(state, "provider", "second");
    expect(state.leases.provider).toBeUndefined();
  });
});

describe("durable local limits", () => {
  it("serializes simultaneous requests through separate store instances without overspending", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "clear-limits-"));
    folders.push(directory);
    const first = createFileLimitStore(directory, () => 10_000);
    const second = createFileLimitStore(directory, () => 10_000);
    const results = await Promise.all(Array.from({ length: 30 }, (_, index) => (index % 2 ? first : second).consume([charge("daily", 7)])));
    expect(results.filter((result) => result.allowed)).toHaveLength(7);
    const saved = JSON.parse(await readFile(path.join(directory, "state.json"), "utf8"));
    expect(saved.events.daily).toHaveLength(7);
    expect((await createFileLimitStore(directory, () => 10_000).consume([charge("daily", 7)])).allowed).toBe(false);
  }, 20_000);

  it("fails closed on corrupt persisted state and leaves the existing budget untouched", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "clear-limits-"));
    folders.push(directory);
    await writeFile(path.join(directory, "state.json"), "not-json");
    await expect(checkRequestLimits(request(), "generation", { store: createFileLimitStore(directory) })).rejects.toMatchObject({ code: "limits_unavailable", status: 503 });
    expect(await readFile(path.join(directory, "state.json"), "utf8")).toBe("not-json");
  });

  it("rejects ephemeral production fallback and incomplete Supabase configuration", () => {
    vi.stubEnv("VERCEL", "1");
    expect(() => getLimitStore()).toThrowError("cannot check");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    expect(() => getLimitStore()).toThrowError("cannot check");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getLimitStore()).toThrowError("cannot check");
  });
});

describe("identity and anti-bypass safeguards", () => {
  it("keeps first-time visitors on different trusted networks independent without making missing headers bypass limits", async () => {
    vi.stubEnv("CLEAR_TRUSTED_IP_HEADER", "x-edge-client-ip");
    vi.stubEnv("CLEAR_RATE_GENERATION_GUEST_LIMIT", "1");
    vi.stubEnv("CLEAR_RATE_GENERATION_IP_LIMIT", "100");
    const { store } = memoryStore();
    await checkRequestLimits(request("203.0.113.1"), "generation", { store });
    await checkRequestLimits(request("203.0.113.2"), "generation", { store });
    await expect(checkRequestLimits(request("203.0.113.1"), "generation", { store })).rejects.toMatchObject({ status: 429 });
    vi.stubEnv("CLEAR_TRUSTED_IP_HEADER", "");
    const untrusted = memoryStore();
    await checkRequestLimits(request("203.0.113.1"), "generation", { store: untrusted.store });
    await expect(checkRequestLimits(request("203.0.113.2"), "generation", { store: untrusted.store })).rejects.toMatchObject({ status: 429 });
  });

  it("ignores untrusted forwarding headers and rotating browser cookies cannot bypass the IP rate bucket", async () => {
    vi.stubEnv("CLEAR_RATE_GENERATION_IP_LIMIT", "2");
    vi.stubEnv("CLEAR_RATE_GENERATION_GUEST_LIMIT", "100");
    const { store } = memoryStore();
    for (const number of [1, 2]) {
      await checkRequestLimits(request(`203.0.113.${number}`, { "x-forwarded-for": `198.51.100.${number}`, Cookie: `clear_learner=${randomUUID()}` }), "generation", { store, learnerId: randomUUID() });
    }
    await expect(checkRequestLimits(request("203.0.113.3", { "x-forwarded-for": "198.51.100.3" }), "generation", { store, learnerId: randomUUID() })).rejects.toMatchObject({ status: 429 });
    expect(trustedClientIp(request())).toBe("unknown");
  });

  it("uses only the explicitly overwritten edge header, rejects chains, and canonicalizes IPv6", () => {
    vi.stubEnv("CLEAR_TRUSTED_IP_HEADER", "x-edge-client-ip");
    expect(trustedClientIp(request("203.0.113.9", { "x-forwarded-for": "1.1.1.1" }))).toBe("203.0.113.9");
    expect(trustedClientIp(request("203.0.113.9, 198.51.100.8"))).toBe("unknown");
    expect(trustedClientIp(request("2001:0db8:0:0:0:0:0:1"))).toBe("2001:db8::1");
    expect(trustedClientIp(request("203.0.113.9:443"))).toBe("unknown");
  });

  it("stores HMAC identities rather than raw addresses, browser IDs, or provider keys", async () => {
    vi.stubEnv("CLEAR_TRUSTED_IP_HEADER", "x-edge-client-ip");
    const { store, state } = memoryStore();
    const learnerId = randomUUID();
    await checkRequestLimits(request(), "generation", { store, learnerId });
    await withModelLimits(model(store, "203.0.113.9", learnerId), async () => "ok");
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("203.0.113.9");
    expect(serialized).not.toContain(learnerId);
    expect(serialized).not.toContain("gemini");
    expect(hashLimitIdentity("ip", "203.0.113.9")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires a strong secret in production and rejects malformed operational caps", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => hashLimitIdentity("ip", "203.0.113.9")).toThrow();
    vi.stubEnv("CLEAR_LIMITS_SECRET", "short");
    expect(() => hashLimitIdentity("ip", "203.0.113.9")).toThrow();
    vi.stubEnv("CLEAR_LIMITS_SECRET", "a".repeat(32));
    expect(hashLimitIdentity("ip", "203.0.113.9")).toHaveLength(64);
    vi.stubEnv("CLEAR_RATE_GENERATION_IP_LIMIT", "Infinity");
    expect(() => actionPolicy("generation")).toThrow();
  });
});

describe("provider attempts and cost quotas", () => {
  beforeEach(() => { vi.stubEnv("CLEAR_TRUSTED_IP_HEADER", "x-edge-client-ip"); });

  it("daily IP quota blocks new browser IDs on the same network", async () => {
    vi.stubEnv("GUEST_DAILY_REQUEST_LIMIT", "100");
    vi.stubEnv("CLEAR_FREE_IP_DAILY_LIMIT", "2");
    const { store } = memoryStore();
    const dispatch = vi.fn(async () => "ok");
    await withModelLimits(model(store), dispatch);
    await withModelLimits(model(store), dispatch);
    await expect(withModelLimits(model(store), dispatch)).rejects.toMatchObject({ code: "free_quota_reached", status: 429 });
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("enforces a global daily free budget across different browsers and networks", async () => {
    vi.stubEnv("CLEAR_FREE_GLOBAL_DAILY_LIMIT", "2");
    const { store, state } = memoryStore();
    await withModelLimits(model(store, "203.0.113.1"), async () => "ok");
    await withModelLimits(model(store, "203.0.113.2"), async () => "ok");
    await expect(withModelLimits(model(store, "203.0.113.3"), async () => "unreachable")).rejects.toThrowError("shared allowance");
    expect(state.events["free:global"]).toHaveLength(2);
  });

  it("counts failed attempts, repairs, retries and enabled fallback when each is actually dispatched", async () => {
    vi.stubEnv("GUEST_DAILY_REQUEST_LIMIT", "3");
    const { store, state } = memoryStore();
    const options = model(store);
    await expect(withModelLimits(options, async () => { throw new Error("provider failed after dispatch"); })).rejects.toThrow("provider failed");
    await withModelLimits(options, async () => "repair");
    await withModelLimits(options, async () => "fallback or retry");
    const fourth = vi.fn(async () => "must not run");
    await expect(withModelLimits(options, fourth)).rejects.toBeInstanceOf(UsageLimitError);
    expect(fourth).not.toHaveBeenCalled();
    expect(state.events["free:global"]).toHaveLength(3);
    expect(state.leases).toEqual({});
  });

  it("BYOK remains request-limited but never spends or depends on the free allowance", async () => {
    vi.stubEnv("GUEST_DAILY_REQUEST_LIMIT", "0");
    vi.stubEnv("CLEAR_FREE_IP_DAILY_LIMIT", "0");
    vi.stubEnv("CLEAR_FREE_GLOBAL_DAILY_LIMIT", "0");
    const { store, state } = memoryStore();
    await expect(withModelLimits(model(store, "203.0.113.9", randomUUID(), false), async () => "own key")).resolves.toBe("own key");
    expect(state.events).toEqual({});
    vi.stubEnv("CLEAR_RATE_GENERATION_IP_LIMIT", "0");
    await expect(checkRequestLimits(request(), "generation", { store, learnerId: randomUUID() })).rejects.toMatchObject({ status: 429 });
  });

  it("uses the signed-in allowance only when server-verified auth is supplied", async () => {
    vi.stubEnv("GUEST_DAILY_REQUEST_LIMIT", "1");
    vi.stubEnv("USER_DAILY_REQUEST_LIMIT", "2");
    vi.stubEnv("CLEAR_FREE_IP_DAILY_LIMIT", "100");
    const { store } = memoryStore();
    const options = { ...model(store), authenticated: true };
    await withModelLimits(options, async () => "first");
    await withModelLimits(options, async () => "second");
    await expect(withModelLimits(options, async () => "third")).rejects.toMatchObject({ code: "free_quota_reached" });
    const guest = model(store);
    await withModelLimits(guest, async () => "first");
    await expect(withModelLimits(guest, async () => "second")).rejects.toMatchObject({ code: "free_quota_reached" });
  });

  it("denies extra concurrent calls before charging them and releases completed calls", async () => {
    vi.stubEnv("CLEAR_PROVIDER_CONCURRENCY_LIMIT", "1");
    const { store, state } = memoryStore();
    let complete!: () => void;
    let admitted!: () => void;
    const entered = new Promise<void>((resolve) => { admitted = resolve; });
    const first = withModelLimits(model(store), async () => { admitted(); await new Promise<void>((resolve) => { complete = resolve; }); return "first"; });
    await entered;
    await expect(withModelLimits(model(store), async () => "second")).rejects.toThrowError("busy");
    expect(state.events["free:global"]).toHaveLength(1);
    complete();
    await first;
    await expect(withModelLimits(model(store), async () => "third")).resolves.toBe("third");
  });

  it("supports an operational free-only pause while BYOK remains available", async () => {
    vi.stubEnv("CLEAR_FREE_PAUSED", "true");
    const { store } = memoryStore();
    await expect(withModelLimits(model(store), async () => "unreachable")).rejects.toMatchObject({ code: "provider_paused", status: 503 });
    await expect(withModelLimits(model(store, "203.0.113.9", randomUUID(), false), async () => "own key")).resolves.toBe("own key");
    vi.stubEnv("CLEAR_AI_PAUSED", "true");
    await expect(withModelLimits(model(store, "203.0.113.9", randomUUID(), false), async () => "unreachable")).rejects.toMatchObject({ status: 503 });
  });

  it("fails closed on an admission storage failure and returns safe retry headers", async () => {
    const dispatch = vi.fn(async () => "unreachable");
    const store: LimitStore = { consume: async () => { throw new Error("SECRET_DATABASE_CONNECTION"); }, release: async () => undefined };
    await expect(withModelLimits(model(store), dispatch)).rejects.toMatchObject({ code: "limits_unavailable", status: 503, message: expect.not.stringContaining("SECRET_DATABASE") });
    expect(dispatch).not.toHaveBeenCalled();
    const error = new UsageLimitError({ allowed: false, kind: "rate", retryAfterSeconds: 17 });
    expect(limitResponseHeaders(error)).toEqual({ "Retry-After": "17", "Cache-Control": "private, no-store" });
    expect(limitResponseHeaders(new Error())).toEqual({});
  });
});
