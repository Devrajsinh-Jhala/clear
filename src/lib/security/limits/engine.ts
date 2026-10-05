import type { LimitCharge, LimitDecision, LimitLease, LimitState } from "@/src/lib/security/limits/types";

const DAY_MS = 86_400_000;

export function emptyLimitState(): LimitState {
  return { version: 1, events: {}, leases: {} };
}

// Mutates only after every bucket has capacity: a rejection never spends another quota.
export function consumeState(state: LimitState, charges: LimitCharge[], lease: LimitLease | undefined, now: number): LimitDecision {
  for (const [key, events] of Object.entries(state.events)) {
    const retained = events.filter((timestamp) => timestamp > now - DAY_MS);
    if (retained.length) state.events[key] = retained;
    else delete state.events[key];
  }
  for (const [key, leases] of Object.entries(state.leases)) {
    const active = leases.filter((item) => item.expiresAt > now);
    if (active.length) state.leases[key] = active;
    else delete state.leases[key];
  }

  for (const charge of charges) {
    const start = charge.mode === "utc-day" ? Math.floor(now / DAY_MS) * DAY_MS : now - charge.windowMs;
    const active = (state.events[charge.key] ?? []).filter((timestamp) => timestamp > start || (charge.mode === "utc-day" && timestamp === start));
    if (active.length + charge.amount > charge.limit) {
      const expiry = charge.mode === "utc-day"
        ? start + DAY_MS
        : (active[Math.max(0, active.length + charge.amount - charge.limit - 1)] ?? now) + charge.windowMs;
      return { allowed: false, kind: charge.kind, retryAfterSeconds: Math.max(1, Math.ceil((expiry - now) / 1000)) };
    }
  }

  if (lease) {
    const active = state.leases[lease.key] ?? [];
    if (active.length >= lease.limit) {
      const expiry = Math.min(...active.map((item) => item.expiresAt), now + lease.ttlMs);
      return { allowed: false, kind: "concurrency", retryAfterSeconds: Math.max(1, Math.ceil((expiry - now) / 1000)) };
    }
  }

  for (const charge of charges) {
    (state.events[charge.key] ??= []).push(...Array.from({ length: charge.amount }, () => now));
  }
  if (lease) (state.leases[lease.key] ??= []).push({ token: lease.token, expiresAt: now + lease.ttlMs });
  return { allowed: true };
}

export function releaseState(state: LimitState, key: string, token: string): void {
  const active = (state.leases[key] ?? []).filter((item) => item.token !== token);
  if (active.length) state.leases[key] = active;
  else delete state.leases[key];
}
