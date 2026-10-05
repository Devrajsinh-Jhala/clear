import type { ErrorEvent, Event, StackFrame } from "@sentry/nextjs";

const OPERATIONS = new Set(["api", "provider", "generation", "follow-up", "teach-back", "repair", "upload", "provider-test", "share", "export", "skill", "mutation", "storage", "request", "client", "unknown"]);
const PROVIDERS = new Set(["gemini", "openai", "anthropic", "xai", "compatible", "mock", "clear-free", "unknown"]);
const CODES = new Set(["internal_error", "provider_error", "provider_timeout", "provider_unreachable", "provider_not_configured", "provider_unavailable", "provider_key_invalid", "provider_quota", "provider_paused", "model_unavailable", "schema_invalid", "invalid_request", "not_found", "forbidden", "file_rejected", "payload_too_large", "unsafe_provider_url", "encryption_not_configured", "storage_unavailable", "share_storage_unavailable", "limits_unavailable", "rate_limited", "free_quota_reached", "runtime_error"]);
const ROUTES = new Set(["/", "/about", "/privacy", "/terms", "/settings", "/library", "/progress", "/skill", "/learn/[conversationId]", "/shared/[shareId]", "/api/explanations", "/api/explanations/[id]/copy", "/api/explanations/[id]/export", "/api/explanations/[id]/follow-up", "/api/explanations/[id]/preference", "/api/explanations/[id]/share", "/api/explanations/[id]/teach-back", "/api/shared/[shareId]/export", "/api/learning", "/api/learning/[conceptKey]", "/api/providers", "/api/providers/test", "/api/routing", "/api/skills/export"]);
const ERROR_TYPES = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "AggregateError", "ClearError"]);
const SOURCE_FILES = ["src/lib/explanation/generate.ts", "src/lib/explanation/follow-up.ts", "src/lib/explanation/validate.ts", "src/lib/explanation/review-teach-back.ts", "src/lib/ai/router.ts", "src/lib/api/http.ts", "src/lib/api/guard.ts", "src/lib/storage/state.ts", "src/lib/uploads/prepare.ts", "src/lib/security/limits/index.ts", "components/lesson/LessonWorkspace.tsx", "components/lesson/ShareExportPanel.tsx", "app/page.tsx", "app/error.tsx", "app/global-error.tsx"];

export type ErrorContext = { operation: string; providerId?: string; code?: string; runtime?: "nodejs" | "edge" | "browser"; routePattern?: string };

export function safeRoutePattern(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  // Only framework route patterns can match. Never generalize a private URL by
  // copying its segments, query, UUID, public slug, or user-supplied text.
  const candidate = value.replace(/^\/app(?=\/)/, "").replace(/\/(?:page|route)$/, "");
  return ROUTES.has(candidate) ? candidate : "unknown";
}

export function safeTags(context: ErrorContext): Record<string, string> {
  const provider = context.providerId?.replace(/^byok:/, "");
  return {
    operation: OPERATIONS.has(context.operation) ? context.operation : "unknown",
    provider: provider && PROVIDERS.has(provider) ? provider : "unknown",
    code: context.code && CODES.has(context.code) ? context.code : "runtime_error",
    runtime: context.runtime && ["nodejs", "edge", "browser"].includes(context.runtime) ? context.runtime : "nodejs",
    route: safeRoutePattern(context.routePattern),
  };
}

export function sanitizeEvent(event: Event): ErrorEvent | null {
  try {
    if (event.type !== undefined) return null;
    const tags = safeTags({ operation: stringTag(event, "operation"), providerId: stringTag(event, "provider"), code: stringTag(event, "code"), runtime: stringTag(event, "runtime") as ErrorContext["runtime"], routePattern: stringTag(event, "route") });
    const input = event.exception?.values?.[0];
    const frames = input?.stacktrace?.frames?.slice(-20).map(safeFrame).filter((frame): frame is StackFrame => frame !== undefined) ?? [];
    const eventId = globalThis.crypto?.randomUUID().replaceAll("-", "");
    if (!eventId) return null;
    return {
      type: undefined, event_id: eventId, timestamp: Date.now() / 1000, platform: "javascript", level: "error",
      logger: "clear", message: "CLEAR runtime failure", tags,
      fingerprint: ["clear", tags.operation, tags.provider, tags.code],
      exception: { values: [{ type: input?.type && ERROR_TYPES.has(input.type) ? input.type : "Error", value: "CLEAR runtime failure", ...(frames.length ? { stacktrace: { frames } } : {}) }] },
    };
  } catch { return null; }
}

export function errorEvent(error: unknown, context: ErrorContext): ErrorEvent {
  let type = "Error";
  let frames: StackFrame[] = [];
  try {
    if (error instanceof Error) {
      type = ERROR_TYPES.has(error.name) ? error.name : "Error";
      // First line contains the original message and is deliberately ignored.
      frames = (error.stack ?? "").split("\n").slice(1, 21).flatMap((line) => {
        const location = line.match(/(?:\(|\s)([^\s()]+):(\d+):(\d+)\)?$/);
        const frame = location ? safeFrame({ filename: location[1], lineno: Number(location[2]), colno: Number(location[3]) }) : undefined;
        return frame ? [frame] : [];
      }).reverse();
    }
  } catch { /* Hostile thrown values never become telemetry. */ }
  return { type: undefined, message: "CLEAR runtime failure", tags: safeTags(context), exception: { values: [{ type, value: "CLEAR runtime failure", ...(frames.length ? { stacktrace: { frames } } : {}) }] } };
}

function stringTag(event: Event, name: string): string { return typeof event.tags?.[name] === "string" ? event.tags[name] : "unknown"; }
function safeFrame(frame: StackFrame): StackFrame | undefined {
  if (typeof frame.filename !== "string") return undefined;
  const path = frame.filename.replaceAll("\\", "/").split(/[?#]/, 1)[0];
  let filename = SOURCE_FILES.find((known) => path === known || path.endsWith(`/${known}`));
  if (!filename && path.includes("/_next/static/chunks/")) filename = "next-client-chunk";
  if (!filename && /\/\.next\/server\/chunks\//.test(path)) filename = "next-server-chunk";
  if (!filename) return undefined;
  const safeNumber = (value: unknown): number | undefined => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value < 10_000_000 ? value : undefined;
  return { filename, lineno: safeNumber(frame.lineno), colno: safeNumber(frame.colno), in_app: true };
}
