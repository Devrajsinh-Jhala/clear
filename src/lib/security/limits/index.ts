import "server-only";

import { randomUUID } from "node:crypto";

import { ClearError } from "@/src/lib/api/errors";
import { actionPolicy, configuredNumber, limitsUnavailable, type LimitAction } from "@/src/lib/security/limits/config";
import { hashLimitIdentity, limitIdentities } from "@/src/lib/security/limits/identity";
import { getLimitStore } from "@/src/lib/security/limits/store";
import type { LimitCharge, LimitDecision, LimitStore } from "@/src/lib/security/limits/types";

export type { LimitAction } from "@/src/lib/security/limits/config";

export class UsageLimitError extends ClearError {
  readonly retryAfterSeconds: number;
  constructor(decision: Exclude<LimitDecision, { allowed: true }>) {
    const message = decision.kind === "global-quota"
      ? "CLEAR Free has reached today's shared allowance. Try again tomorrow or choose a provider you connected."
      : decision.kind === "guest-quota" || decision.kind === "ip-quota"
        ? "Today's CLEAR Free allowance for this browser or network has been used. Try again tomorrow or choose a provider you connected."
        : decision.kind === "concurrency"
          ? "That provider is busy. Please try again shortly."
          : "You're sending requests too quickly. Please wait a little and try again.";
    super(decision.kind.endsWith("quota") ? "free_quota_reached" : "rate_limited", message, {
      status: 429, retryable: true, details: { retryAfterSeconds: decision.retryAfterSeconds },
    });
    this.retryAfterSeconds = decision.retryAfterSeconds;
  }
}

export function limitResponseHeaders(error: unknown): Record<string, string> {
  return error instanceof UsageLimitError ? { "Retry-After": String(error.retryAfterSeconds), "Cache-Control": "private, no-store" } : {};
}

async function enforce(store: LimitStore, charges: LimitCharge[], lease?: Parameters<LimitStore["consume"]>[1]) {
  let result: LimitDecision;
  try {
    result = await store.consume(charges, lease);
  } catch {
    throw limitsUnavailable();
  }
  if (!result.allowed) throw new UsageLimitError(result);
}

export async function checkRequestLimits(request: Request, action: LimitAction, options: { learnerId?: string; store?: LimitStore } = {}): Promise<void> {
  const identities = limitIdentities(request, options.learnerId);
  const policy = actionPolicy(action);
  const common = { amount: 1, windowMs: policy.windowMs, mode: "rolling" as const, kind: "rate" as const };
  await enforce(options.store ?? getLimitStore(), [
    { ...common, key: `${action}:ip:${identities.ip}`, limit: policy.ip },
    { ...common, key: `${action}:guest:${identities.guest}`, limit: policy.guest },
  ]);
}

// Place around each actual model dispatch, including repairs, comparisons and
// enabled fallback. BYOK holds the same concurrency safeguard but spends no free quota.
// Attempt quota is not refunded: a failed/aborted call may still have incurred cost.
export async function withModelLimits<T>(options: {
  providerId: string;
  learnerId?: string;
  authenticated?: boolean;
  request?: Request;
  clearFree: boolean;
  units?: number;
  store?: LimitStore;
}, operation: () => Promise<T>): Promise<T> {
  if (process.env.CLEAR_AI_PAUSED === "true" || (options.clearFree && process.env.CLEAR_FREE_PAUSED === "true")) {
    throw new ClearError("provider_paused", "CLEAR has temporarily paused this model service. Please try again later.", { status: 503, retryable: true });
  }
  const identities = limitIdentities(options.request, options.learnerId);
  const amount = options.units ?? 1;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10) throw limitsUnavailable();
  // This flag is set by server-verified auth, never by a request body or cookie.
  const guestLimit = options.authenticated
    ? configuredNumber("USER_DAILY_REQUEST_LIMIT", 100)
    : configuredNumber("GUEST_DAILY_REQUEST_LIMIT", 20);
  const defaultIpLimit = configuredNumber("GUEST_DAILY_REQUEST_LIMIT", 20);
  const common = { amount, mode: "utc-day" as const, windowMs: 86_400_000 };
  const charges: LimitCharge[] = options.clearFree ? [
    { ...common, key: `free:guest:${identities.guest}`, kind: "guest-quota", limit: guestLimit },
    { ...common, key: `free:ip:${identities.ip}`, kind: "ip-quota", limit: configuredNumber("CLEAR_FREE_IP_DAILY_LIMIT", defaultIpLimit) },
    { ...common, key: "free:global", kind: "global-quota", limit: configuredNumber("CLEAR_FREE_GLOBAL_DAILY_LIMIT", 1000) },
  ] : [];
  const lease = {
    key: `provider:${hashLimitIdentity("provider", options.providerId)}`,
    token: randomUUID(),
    limit: configuredNumber("CLEAR_PROVIDER_CONCURRENCY_LIMIT", 8),
    ttlMs: 120_000,
  };
  const store = options.store ?? getLimitStore();
  await enforce(store, charges, lease);
  try {
    return await operation();
  } finally {
    // A release failure leaves a lease that expires. Do not repeat a completed model
    // request just because cleanup failed; subsequent admissions still fail closed.
    await store.release(lease.key, lease.token).catch(() => undefined);
  }
}
