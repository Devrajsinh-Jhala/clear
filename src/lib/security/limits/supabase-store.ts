import "server-only";

import { createClient } from "@supabase/supabase-js";

import { limitsUnavailable } from "@/src/lib/security/limits/config";
import type { LimitDecision, LimitKind, LimitStore } from "@/src/lib/security/limits/types";

const KINDS: LimitKind[] = ["rate", "guest-quota", "ip-quota", "global-quota", "concurrency"];

export function createSupabaseLimitStore(url: string, secret: string): LimitStore {
  const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async consume(charges, lease) {
      const { data, error } = await client.rpc("clear_consume_limits", { p_charges: charges, p_lease: lease ?? null });
      if (error || !data || typeof data.allowed !== "boolean") throw limitsUnavailable();
      if (data.allowed) return { allowed: true };
      if (!KINDS.includes(data.kind) || !Number.isSafeInteger(data.retryAfterSeconds) || data.retryAfterSeconds < 1) throw limitsUnavailable();
      return data as LimitDecision;
    },
    async release(key, token) {
      const { error } = await client.rpc("clear_release_limit_lease", { p_key: key, p_token: token });
      if (error) throw limitsUnavailable();
    },
  };
}
