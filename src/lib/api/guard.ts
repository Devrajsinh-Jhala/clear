import "server-only";

import { requestContext } from "@/src/lib/api/context";
import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { currentLearnerId } from "@/src/lib/learning/session";
import { checkRequestLimits, type LimitAction } from "@/src/lib/security/limits";
import { flushMonitoring } from "@/src/lib/monitoring/server";

export async function withApiGuard(request: Request, action: LimitAction, handler: () => Promise<Response>): Promise<Response> {
  return requestContext.run({ request, action }, async () => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) assertSameOrigin(request);
      await checkRequestLimits(request, action, { learnerId: await currentLearnerId() });
      const response = await handler();
      response.headers.set("Cache-Control", "private, no-store, max-age=0");
      response.headers.set("X-Content-Type-Options", "nosniff");
      if (!(response.headers.get("Vary") || "").split(",").some((value) => value.trim().toLowerCase() === "cookie")) response.headers.append("Vary", "Cookie");
      if (response.status >= 400) await flushMonitoring();
      return response;
    } catch (error) {
      const response = errorResponse(error);
      response.headers.set("Cache-Control", "private, no-store, max-age=0");
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Vary", "Cookie");
      if (response.status >= 400) await flushMonitoring();
      return response;
    }
  });
}
