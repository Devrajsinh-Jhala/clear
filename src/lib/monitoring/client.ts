import * as Sentry from "@sentry/nextjs";
import { configuredDsn, privateOptions } from "@/src/lib/monitoring/config";
import { errorEvent } from "@/src/lib/monitoring/privacy";

let initialized = false;
export function initializeClientMonitoring(): void {
  const dsn = configuredDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (!dsn || initialized || typeof window === "undefined") return;
  try {
    Sentry.init({ ...privateOptions(dsn), initialScope: { tags: { runtime: "browser" } } });
    initialized = true;
    const capture = (error: unknown) => { try { Sentry.captureEvent(errorEvent(error, { operation: "client", code: "runtime_error", runtime: "browser" })); } catch { /* No raw error logs. */ } };
    window.addEventListener("error", (event) => capture(event.error));
    window.addEventListener("unhandledrejection", (event) => capture(event.reason));
  } catch { /* Monitoring must not prevent hydration or interaction. */ }
}
