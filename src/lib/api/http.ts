import { ZodError } from "zod";

import { ClearError, toErrorBody } from "@/src/lib/api/errors";
import { assertShareWriteOrigin } from "@/src/lib/sharing/http";
import { limitResponseHeaders } from "@/src/lib/security/limits";
import { reportServerError } from "@/src/lib/monitoring/server";

export function assertSameOrigin(request: Request): void {
  assertShareWriteOrigin(request);
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ClearError) {
    if (error.status >= 500) reportServerError(error, { operation: "api", code: error.code });
    return Response.json(toErrorBody(error), { status: error.status, headers: { "Cache-Control": "private, no-store", ...limitResponseHeaders(error) } });
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "invalid_request",
          message: "Check the question and try again.",
          retryable: false,
          details: error.issues.slice(0, 5).map((issue) => issue.message),
        },
      },
      { status: 400 },
    );
  }
  // Provider/database exception text may contain private content or credentials.
  reportServerError(error, { operation: "api", code: "internal_error" });
  console.error(JSON.stringify({ event: "clear_error", operation: "api", code: "internal_error" }));
  return Response.json(
    {
      error: {
        code: "internal_error",
        message: "Something went wrong while building the explanation.",
        retryable: true,
      },
    },
    { status: 500 },
  );
}
