import { ZodError } from "zod";

import { ClearError, toErrorBody } from "@/src/lib/api/errors";
import { redactSecrets } from "@/src/lib/ai/redact";

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ClearError("forbidden", "The request origin is not valid.", { status: 403 });
  }
  if (originHost !== host) {
    throw new ClearError("forbidden", "Cross-origin request blocked.", { status: 403 });
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ClearError) {
    return Response.json(toErrorBody(error), { status: error.status });
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
  const message = error instanceof Error ? error.message : "Unknown failure";
  console.error(redactSecrets(message));
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
