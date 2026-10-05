import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { limitsUnavailable } from "@/src/lib/security/limits/config";

// A deployment must name a header that its edge overwrites. Unconfigured forwarding
// headers are deliberately ignored, including when a client supplies a new cookie.
export function trustedClientIp(request?: Request): string {
  const header = process.env.CLEAR_TRUSTED_IP_HEADER;
  if (!request || !header) return "unknown";
  if (!/^[a-z0-9-]{1,80}$/i.test(header)) throw limitsUnavailable();
  const candidate = request.headers.get(header)?.trim();
  if (!candidate || candidate.length > 80 || !isIP(candidate)) return "unknown";
  return isIP(candidate) === 6 ? new URL(`http://[${candidate}]/`).hostname.slice(1, -1) : candidate;
}

export function hashLimitIdentity(kind: "ip" | "guest" | "provider", value: string): string {
  let secret = process.env.CLEAR_LIMITS_SECRET || process.env.APP_ENCRYPTION_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw limitsUnavailable();
    secret = "clear-development-limit-identity";
  }
  if (process.env.NODE_ENV === "production" && secret.length < 32) throw limitsUnavailable();
  return createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex");
}

export function limitIdentities(request?: Request, learnerId?: string) {
  const ip = trustedClientIp(request);
  return {
    ip: hashLimitIdentity("ip", ip),
    // First-time visitors have no cookie yet. Share their network allowance,
    // rather than merging every new visitor into one global browser bucket.
    guest: hashLimitIdentity("guest", learnerId || `network:${ip}`),
  };
}
