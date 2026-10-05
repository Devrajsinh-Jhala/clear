import "server-only";
import * as Sentry from "@sentry/nextjs";
import { ClearError } from "@/src/lib/api/errors";
import { configuredDsn, privateOptions } from "@/src/lib/monitoring/config";
import { errorEvent, type ErrorContext } from "@/src/lib/monitoring/privacy";

function serverDsn() { return configuredDsn(process.env.SENTRY_DSN) ?? configuredDsn(process.env.NEXT_PUBLIC_SENTRY_DSN); }
const reported = new WeakSet<object>();

export function initializeServerMonitoring(runtime: "nodejs" | "edge"): void {
  const dsn = serverDsn();
  if (!dsn) return;
  try { Sentry.init({ ...privateOptions(dsn), enableOpenTelemetrySetup: false, enableRuntimeChannelInjection: false, includeLocalVariables: false, serverName: "clear", environment: process.env.NODE_ENV, initialScope: { tags: { runtime } } }); } catch { /* Monitoring must never prevent a lesson. */ }
}

export function reportServerError(error: unknown, context: Pick<ErrorContext, "operation" | "providerId" | "code" | "routePattern">): void {
  if (!serverDsn() || !Sentry.getClient()) return;
  const objectError = typeof error === "object" && error !== null ? error : undefined;
  if (objectError && reported.has(objectError)) return;
  try {
    Sentry.captureEvent(errorEvent(error, { ...context, code: context.code ?? (error instanceof ClearError ? error.code : "internal_error"), runtime: process.env.NEXT_RUNTIME === "edge" ? "edge" : "nodejs" }));
    if (objectError) reported.add(objectError);
  } catch { /* Never log the original error. */ }
}

export async function flushMonitoring(): Promise<void> {
  if (!serverDsn() || !Sentry.getClient()) return;
  try { await Sentry.flush(2000); } catch { /* A monitoring outage cannot change the API response. */ }
}
