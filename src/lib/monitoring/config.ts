import { sanitizeEvent } from "@/src/lib/monitoring/privacy";
import { privateTransport } from "@/src/lib/monitoring/transport";

export function configuredDsn(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.username || url.password || url.search || url.hash || !/\/\d+$/.test(url.pathname)) return undefined;
    return value;
  } catch { return undefined; }
}

export function privateOptions(dsn: string) {
  return {
    dsn, enabled: true, debug: false, sendDefaultPii: false, defaultIntegrations: false as const, integrations: [],
    maxBreadcrumbs: 0, beforeBreadcrumb: () => null, beforeSend: sanitizeEvent,
    sendClientReports: false, tracesSampleRate: undefined, tracesSampler: undefined,
    tracePropagationTargets: [], ignoreSpans: [/.*/], beforeSendTransaction: () => null,
    beforeSendLog: () => null, beforeSendMetric: () => null,
    replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0, profileSessionSampleRate: 0,
    transport: privateTransport,
  };
}
