import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { currentLearningProfile, eraseLearningMemory, setLearningEnabled } from "@/src/lib/learning/session";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ profile: await currentLearningProfile() });
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { enabled?: boolean };
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
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    await eraseLearningMemory();
    return Response.json({ profile: { enabled: false, concepts: [], misconceptions: [] } });
  } catch (error) {
    return errorResponse(error);
  }
}
