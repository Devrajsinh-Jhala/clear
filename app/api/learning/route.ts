import { readBoundedJson } from "@/src/lib/security/limits/body";
import { withApiGuard } from "@/src/lib/api/guard";
import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { currentLearningProfile, eraseLearningMemory, setLearningEnabled } from "@/src/lib/learning/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withApiGuard(request, "mutation", async () => {
    return Response.json({ profile: await currentLearningProfile() });
  });
}

export async function PUT(request: Request) {
  return withApiGuard(request, "mutation", async () => {
    try {
      assertSameOrigin(request);
      const body = (await readBoundedJson(request)) as { enabled?: boolean };
      if (typeof body.enabled !== "boolean") {
        return Response.json(
          { error: { code: "invalid_request", message: "Say whether learning memory is on.", retryable: false } },
          { status: 400 },
        );
      }
      return Response.json({ profile: await setLearningEnabled(body.enabled) });
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function DELETE(request: Request) {
  return withApiGuard(request, "mutation", async () => {
    try {
      assertSameOrigin(request);
      await eraseLearningMemory();
      return Response.json({ profile: { enabled: false, concepts: [], misconceptions: [] } });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
