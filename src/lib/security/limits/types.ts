export type LimitKind = "rate" | "guest-quota" | "ip-quota" | "global-quota" | "concurrency";

export type LimitCharge = {
  key: string;
  limit: number;
  amount: number;
  windowMs: number;
  mode: "rolling" | "utc-day";
  kind: Exclude<LimitKind, "concurrency">;
};

export type LimitLease = { key: string; token: string; limit: number; ttlMs: number };

export type LimitDecision =
  | { allowed: true }
  | { allowed: false; kind: LimitKind; retryAfterSeconds: number };

export interface LimitStore {
  consume(charges: LimitCharge[], lease?: LimitLease): Promise<LimitDecision>;
  release(key: string, token: string): Promise<void>;
}

export type LimitState = {
  version: 1;
  events: Record<string, number[]>;
  leases: Record<string, { token: string; expiresAt: number }[]>;
};
