import { afterEach, describe, expect, it, vi } from "vitest";
import type { Envelope } from "@sentry/core";
import type { Event } from "@sentry/nextjs";
import { configuredDsn, privateOptions } from "@/src/lib/monitoring/config";
import { errorEvent, safeRoutePattern, safeTags, sanitizeEvent } from "@/src/lib/monitoring/privacy";
import { privateTransport, sanitizedEnvelope } from "@/src/lib/monitoring/transport";
import { initializeServerMonitoring, reportServerError } from "@/src/lib/monitoring/server";
import { ClearError } from "@/src/lib/api/errors";

const sdk = vi.hoisted(() => ({ init: vi.fn(), captureEvent: vi.fn(), getClient: vi.fn(() => ({})), flush: vi.fn(async () => true), send: vi.fn(async () => ({})), transportFlush: vi.fn(async () => true) }));
vi.mock("@sentry/nextjs", () => ({ ...sdk, createTransport: vi.fn(() => ({ send: sdk.send, flush: sdk.transportFlush })) }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const SENSITIVE = "PRIVATE_PROMPT_KEY_UPLOAD_EMAIL_IP_COOKIE_71";
function privateEvent(): Event {
  return {
    event_id: "11111111111111111111111111111111", message: SENSITIVE, logentry: { message: SENSITIVE, params: [SENSITIVE] },
    server_name: SENSITIVE, release: SENSITIVE, environment: SENSITIVE, dist: SENSITIVE,
    request: { url: `https://private.invalid/learn/private-id?question=${SENSITIVE}`, headers: { authorization: SENSITIVE, cookie: SENSITIVE }, data: SENSITIVE, cookies: { clear_learner: SENSITIVE } },
    user: { id: SENSITIVE, email: "private@example.invalid", ip_address: "192.0.2.21", username: SENSITIVE },
    extra: { apiKey: SENSITIVE, prompt: SENSITIVE, upload: SENSITIVE, body: SENSITIVE },
    contexts: { private: { data: SENSITIVE }, trace: { trace_id: "22222222222222222222222222222222", span_id: "2222222222222222", op: SENSITIVE } },
    breadcrumbs: [{ message: SENSITIVE, data: { content: SENSITIVE } }], fingerprint: [SENSITIVE], transaction: SENSITIVE,
    tags: { operation: "provider", provider: "gemini", code: "provider_timeout", runtime: "nodejs", route: "/learn/[conversationId]", email: SENSITIVE, model: SENSITIVE },
    exception: { values: [{ type: SENSITIVE, value: SENSITIVE, module: SENSITIVE, mechanism: { type: SENSITIVE, data: { secret: SENSITIVE } }, stacktrace: { frames: [
      { filename: `C:/Users/${SENSITIVE}/project/src/lib/explanation/generate.ts?key=${SENSITIVE}`, function: SENSITIVE, module: SENSITIVE, abs_path: SENSITIVE, context_line: SENSITIVE, vars: { key: SENSITIVE }, lineno: 41, colno: 7, pre_context: [SENSITIVE], post_context: [SENSITIVE] },
      { filename: `https://private.invalid/_next/static/chunks/${SENSITIVE}.js?token=${SENSITIVE}`, lineno: 4, colno: 2 },
      { filename: `https://private.invalid/uploads/${SENSITIVE}.pdf`, context_line: SENSITIVE, lineno: 10 },
    ] } }] },
    debug_meta: { images: [{ type: "sourcemap", code_file: SENSITIVE, debug_id: SENSITIVE }] }, sdkProcessingMetadata: { private: SENSITIVE },
  };
}

describe("strict monitoring privacy", () => {
  it("rebuilds an error from a finite allowlist and drops every private event field", () => {
    const event = sanitizeEvent(privateEvent())!;
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(SENSITIVE);
    expect(serialized).not.toContain("private@example.invalid");
    expect(serialized).not.toContain("192.0.2.21");
    expect(serialized).not.toContain("private.invalid");
    expect(event.message).toBe("CLEAR runtime failure");
    expect(event.tags).toEqual({ operation: "provider", provider: "gemini", code: "provider_timeout", runtime: "nodejs", route: "/learn/[conversationId]" });
    expect(event.exception!.values![0].type).toBe("Error");
    expect(event.exception!.values![0].stacktrace!.frames).toEqual([{ filename: "src/lib/explanation/generate.ts", lineno: 41, colno: 7, in_app: true }, { filename: "next-client-chunk", lineno: 4, colno: 2, in_app: true }]);
    expect(Object.keys(event)).toEqual(["type", "event_id", "timestamp", "platform", "level", "logger", "message", "tags", "fingerprint", "exception"]);
    expect(event.event_id).not.toBe("11111111111111111111111111111111");
  });

  it("does not preserve unknown tag values, actual lesson addresses, or arbitrary error names", () => {
    expect(safeTags({ operation: SENSITIVE, providerId: SENSITIVE, code: SENSITIVE, routePattern: `/learn/${SENSITIVE}` })).toEqual({ operation: "unknown", provider: "unknown", code: "runtime_error", runtime: "nodejs", route: "unknown" });
    expect(safeRoutePattern("/app/api/explanations/[id]/share/route")).toBe("/api/explanations/[id]/share");
    expect(safeRoutePattern("/learn/[conversationId]?question=private")).toBe("unknown");
    expect(safeTags({ operation: "generation", providerId: "byok:anthropic", code: "provider_error", runtime: "edge" }).provider).toBe("anthropic");
    const error = new Error(SENSITIVE);
    error.name = SENSITIVE;
    error.stack = `${SENSITIVE}\n    at ${SENSITIVE} (C:/Users/${SENSITIVE}/project/src/lib/ai/router.ts:10:2)`;
    const event = errorEvent(error, { operation: "api" });
    expect(JSON.stringify(event)).not.toContain(SENSITIVE);
    expect(event.exception!.values![0].stacktrace!.frames![0].filename).toBe("src/lib/ai/router.ts");
  });

  it("drops non-error events and strips unbounded stack payloads and malformed numbers", () => {
    expect(sanitizeEvent({ type: "transaction", message: SENSITIVE })).toBeNull();
    expect(sanitizeEvent({ type: "replay_event", message: SENSITIVE })).toBeNull();
    const event = privateEvent();
    event.exception!.values![0].stacktrace!.frames = Array.from({ length: 50 }, () => ({ filename: "src/lib/ai/router.ts", lineno: Infinity, colno: -1, context_line: SENSITIVE }));
    const safe = sanitizeEvent(event)!;
    expect(safe.exception!.values![0].stacktrace!.frames).toHaveLength(20);
    expect(safe.exception!.values![0].stacktrace!.frames!.every((frame) => frame.lineno === undefined && frame.colno === undefined)).toBe(true);
  });

  it("filters all outgoing envelopes including SDK-internal events, attachments, logs, and sessions", async () => {
    const envelope = [{ event_id: SENSITIVE, trace: { transaction: SENSITIVE }, sdk: { name: SENSITIVE } }, [
      [{ type: "event" }, privateEvent()],
      [{ type: "attachment", filename: `${SENSITIVE}.pdf`, length: 5 }, SENSITIVE],
      [{ type: "session" }, { sid: SENSITIVE, did: SENSITIVE, ip_address: SENSITIVE }],
      [{ type: "log", item_count: 1 }, { items: [{ body: SENSITIVE }] }],
      [{ type: "span" }, { description: SENSITIVE }],
    ]] as unknown as Envelope;
    const safe = sanitizedEnvelope(envelope)!;
    expect(safe[1]).toHaveLength(1);
    expect(JSON.stringify(safe)).not.toContain(SENSITIVE);
    expect(Object.keys(safe[0])).toEqual(["event_id", "sent_at"]);
    const transport = privateTransport({ url: "https://sentry.invalid/api/1/envelope", recordDroppedEvent: vi.fn() });
    await transport.send(envelope);
    expect(sdk.send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(sdk.send.mock.calls)).not.toContain(SENSITIVE);
    await transport.send([{ sent_at: "now" }, [[{ type: "attachment", filename: "private.pdf", length: 5 }, SENSITIVE]]] as unknown as Envelope);
    expect(sdk.send).toHaveBeenCalledTimes(1);
  });

  it("uses no default integrations, request metadata, tracing, replay, breadcrumbs, logs, or client reports", () => {
    const options = privateOptions("https://publickey@sentry.invalid/1");
    expect(options.defaultIntegrations).toBe(false);
    expect(options.integrations).toEqual([]);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.maxBreadcrumbs).toBe(0);
    expect(options.beforeBreadcrumb()).toBeNull();
    expect(options.tracesSampleRate).toBeUndefined();
    expect(options.tracePropagationTargets).toEqual([]);
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(options.replaysOnErrorSampleRate).toBe(0);
    expect(options.beforeSendLog()).toBeNull();
    expect(options.beforeSendMetric()).toBeNull();
    expect(options.sendClientReports).toBe(false);
  });

  it("does not initialize or report with no valid configured DSN", () => {
    vi.stubEnv("SENTRY_DSN", ""); vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    initializeServerMonitoring("nodejs");
    reportServerError(new Error(SENSITIVE), { operation: "api" });
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.captureEvent).not.toHaveBeenCalled();
    expect(configuredDsn("not a DSN")).toBeUndefined();
    expect(configuredDsn("http://publickey@sentry.invalid/1")).toBeUndefined();
    expect(configuredDsn("https://publickey:private@sentry.invalid/1")).toBeUndefined();
    expect(configuredDsn("https://publickey@sentry.invalid/1?question=private")).toBeUndefined();
  });

  it("reports only safe error categories with a configured SDK, never a raw exception", () => {
    vi.stubEnv("SENTRY_DSN", "https://publickey@sentry.invalid/1");
    vi.stubEnv("NEXT_RUNTIME", "edge");
    initializeServerMonitoring("edge");
    reportServerError(new ClearError("provider_timeout", SENSITIVE, { details: { key: SENSITIVE }, status: 504 }), { operation: "provider", providerId: "gemini" });
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.captureEvent).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(sdk.captureEvent.mock.calls)).not.toContain(SENSITIVE);
    expect(sdk.captureEvent.mock.calls[0][0].tags).toMatchObject({ code: "provider_timeout", provider: "gemini", runtime: "edge" });
    sdk.captureEvent.mockImplementationOnce(() => { throw new Error(SENSITIVE); });
    expect(() => reportServerError(new Error(SENSITIVE), { operation: "api" })).not.toThrow();
  });

  it("reports an error object only once across provider and API handlers", () => {
    vi.stubEnv("SENTRY_DSN", "https://publickey@sentry.invalid/1");
    const error = new Error(SENSITIVE);
    reportServerError(error, { operation: "provider", providerId: "gemini" });
    reportServerError(error, { operation: "api" });
    expect(sdk.captureEvent).toHaveBeenCalledTimes(1);
    reportServerError(new Error(SENSITIVE), { operation: "api" });
    expect(sdk.captureEvent).toHaveBeenCalledTimes(2);
  });

  it("uses the framework route pattern while ignoring the request and awaits error delivery", async () => {
    vi.stubEnv("SENTRY_DSN", "https://publickey@sentry.invalid/1");
    const { onRequestError } = await import("@/instrumentation");
    await onRequestError(new Error(SENSITIVE), { path: `/learn/private-id?prompt=${SENSITIVE}`, method: "POST", headers: { cookie: SENSITIVE, authorization: SENSITIVE } }, { routePath: "/learn/[conversationId]", routeType: "render", routerKind: "App Router", renderSource: "react-server-components", revalidateReason: undefined });
    expect(sdk.captureEvent.mock.calls[0][0].tags.route).toBe("/learn/[conversationId]");
    expect(JSON.stringify(sdk.captureEvent.mock.calls)).not.toContain(SENSITIVE);
    expect(sdk.flush).toHaveBeenCalledWith(2000);
  });

  it("registers generic browser error handlers only with an explicitly configured public DSN", async () => {
    const handlers = new Map<string, (event: { error?: unknown; reason?: unknown }) => void>();
    vi.stubGlobal("window", { addEventListener: (name: string, handler: (event: { error?: unknown; reason?: unknown }) => void) => handlers.set(name, handler) });
    const { initializeClientMonitoring } = await import("@/src/lib/monitoring/client");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    initializeClientMonitoring();
    expect(handlers.size).toBe(0);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://publickey@sentry.invalid/1");
    initializeClientMonitoring();
    expect([...handlers.keys()]).toEqual(["error", "unhandledrejection"]);
    handlers.get("error")!({ error: new Error(SENSITIVE) });
    handlers.get("unhandledrejection")!({ reason: { prompt: SENSITIVE, key: SENSITIVE } });
    expect(sdk.captureEvent).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(sdk.captureEvent.mock.calls)).not.toContain(SENSITIVE);
    expect(sdk.captureEvent.mock.calls[0][0].tags.runtime).toBe("browser");
  });
});
