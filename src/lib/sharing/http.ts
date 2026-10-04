import { ZodError } from "zod";

import { ClearError, toErrorBody } from "@/src/lib/api/errors";

export function assertShareWriteOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || !origin) throw forbiddenOrigin();
  try {
    const requestUrl = new URL(request.url);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host;
    const protocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.slice(0, -1);
    // Forwarding headers must name one origin, never a proxy chain or URL-shaped value.
    if (!host || /[\s,/@\\?#]/u.test(host) || !["http", "https"].includes(protocol)) throw forbiddenOrigin();
    const expected = new URL(`${protocol}://${host}`);
    const supplied = new URL(origin);
    if (supplied.origin !== origin || supplied.origin !== expected.origin || supplied.username || supplied.password) throw forbiddenOrigin();
  } catch { throw forbiddenOrigin(); }
}

export function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export function shareErrorResponse(error: unknown): Response {
  if (error instanceof ClearError) return noStore(Response.json(toErrorBody(error), { status: error.status }));
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return noStore(Response.json({ error: { code: "invalid_request", message: "Choose valid sharing options and try again.", retryable: false } }, { status: 400 }));
  }
  return noStore(Response.json({ error: { code: "share_unavailable", message: "Sharing could not be updated. Try again.", retryable: true } }, { status: 503 }));
}

function forbiddenOrigin() {
  return new ClearError("forbidden", "Sharing requests must come from this CLEAR page.", { status: 403 });
}
