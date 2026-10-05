import { ClearError } from "@/src/lib/api/errors";

export type LimitAction = "generation" | "upload" | "provider-test" | "auth" | "share" | "export" | "skill" | "mutation";

const ACTION_DEFAULTS: Record<LimitAction, { ip: number; guest: number; seconds: number }> = {
  generation: { ip: 60, guest: 20, seconds: 600 },
  upload: { ip: 30, guest: 10, seconds: 3600 },
  "provider-test": { ip: 12, guest: 6, seconds: 600 },
  auth: { ip: 12, guest: 6, seconds: 600 },
  share: { ip: 40, guest: 20, seconds: 600 },
  export: { ip: 100, guest: 50, seconds: 600 },
  skill: { ip: 60, guest: 30, seconds: 600 },
  mutation: { ip: 100, guest: 50, seconds: 600 },
};

export function configuredNumber(name: string, fallback: number, max = 1_000_000, min = 0): number {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw limitsUnavailable();
  }
  return Number(value);
}

export function actionPolicy(action: LimitAction) {
  const defaults = ACTION_DEFAULTS[action];
  const prefix = `CLEAR_RATE_${action.replace(/-/g, "_").toUpperCase()}`;
  return {
    ip: configuredNumber(`${prefix}_IP_LIMIT`, defaults.ip),
    guest: configuredNumber(`${prefix}_GUEST_LIMIT`, defaults.guest),
    windowMs: configuredNumber(`${prefix}_WINDOW_SECONDS`, defaults.seconds, 86_400, 1) * 1000,
  };
}

export function limitsUnavailable(): ClearError {
  return new ClearError("limits_unavailable", "CLEAR cannot check its usage limits right now. Please try again shortly.", { status: 503, retryable: true });
}
