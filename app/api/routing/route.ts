import { readBoundedJson } from "@/src/lib/security/limits/body";
import { withApiGuard } from "@/src/lib/api/guard";
import { z } from "zod";

import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { currentLearnerId, ensureLearnerId } from "@/src/lib/learning/session";
import { listApprovedTargets } from "@/src/lib/routing/available";
import { defaultRoutingPreferences, ROUTING_TASKS } from "@/src/lib/routing/choose";
import { readRoutingPreferences, writeRoutingPreferences } from "@/src/lib/routing/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const targetSchema = z.object({
  provider: z.enum(["clear-free", "gemini", "openai", "anthropic", "xai", "compatible"]),
  model: z.string().trim().max(80),
});

const preferencesSchema = z.object({
  auto: z.boolean(),
  fallbackAllowed: z.boolean(),
  defaultTarget: targetSchema,
  tasks: z.object({
    everyday: targetSchema.optional(),
    coding: targetSchema.optional(),
    research: targetSchema.optional(),
    math: targetSchema.optional(),
  }),
});

export async function GET(request: Request) {
  return withApiGuard(request, "mutation", async () => {
    try {
      // A read shows the defaults to a new visitor; only saving creates a browser identity.
      const learnerId = await currentLearnerId();
      const [preferences, available] = await Promise.all([
        readRoutingPreferences(learnerId),
        listApprovedTargets(),
      ]);
      return Response.json({ preferences, available, tasks: ROUTING_TASKS });
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function PUT(request: Request) {
  return withApiGuard(request, "mutation", async () => {
    try {
      assertSameOrigin(request);
      const preferences = preferencesSchema.parse(await readBoundedJson(request));
      const learnerId = await ensureLearnerId();
      await writeRoutingPreferences(learnerId, {
        ...defaultRoutingPreferences(),
        ...preferences,
      });
      return Response.json({ preferences });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
