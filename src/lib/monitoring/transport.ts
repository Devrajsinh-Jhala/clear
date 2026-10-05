import { createTransport } from "@sentry/nextjs";
import type { BaseTransportOptions, Envelope, Event, Transport } from "@sentry/core";
import { sanitizeEvent } from "@/src/lib/monitoring/privacy";

export function sanitizedEnvelope(envelope: Envelope): Envelope | undefined {
  const events = envelope[1].filter((item) => item[0].type === "event").slice(0, 5).flatMap((item) => {
    const payload: unknown = item[1];
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
    const event = sanitizeEvent(payload as Event);
    return event ? [[{ type: "event" as const }, event] as [{ type: "event" }, Event]] : [];
  });
  // Attachments, session reports, feedback, profiles, logs, metrics, tracing, and
  // SDK-added envelope metadata never reach the transport, even if a future SDK
  // feature bypasses beforeSend.
  return events.length ? [{ event_id: events[0][1].event_id!, sent_at: new Date().toISOString() }, events] : undefined;
}

export function privateTransport(options: BaseTransportOptions): Transport {
  const transport = createTransport(options, async (request) => {
    const response = await fetch(options.url, { method: "POST", body: request.body as BodyInit, credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: AbortSignal.timeout(5000) });
    return { statusCode: response.status, headers: { "retry-after": response.headers.get("retry-after"), "x-sentry-rate-limits": response.headers.get("x-sentry-rate-limits") } };
  });
  return {
    send(envelope) { const safe = sanitizedEnvelope(envelope); return safe ? transport.send(safe) : Promise.resolve({}); },
    flush(timeout) { return transport.flush(timeout); },
  };
}
