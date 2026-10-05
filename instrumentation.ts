import type { Instrumentation } from "next";

export async function register() {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const { initializeServerMonitoring } = await import("@/src/lib/monitoring/server");
  initializeServerMonitoring(process.env.NEXT_RUNTIME === "edge" ? "edge" : "nodejs");
}

export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const { reportServerError, flushMonitoring } = await import("@/src/lib/monitoring/server");
  // Actual paths, queries, request headers, and bodies are deliberately ignored.
  reportServerError(error, { operation: "request", routePattern: context.routePath });
  await flushMonitoring();
};
