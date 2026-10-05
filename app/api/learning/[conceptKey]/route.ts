import { withApiGuard } from "@/src/lib/api/guard";
import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { removeConcept } from "@/src/lib/learning/memory";
import { currentLearnerId } from "@/src/lib/learning/session";
import { readLearningProfile, writeLearningProfile } from "@/src/lib/learning/store";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ conceptKey: string }> },
) {
  return withApiGuard(request, "mutation", async () => {
    try {
      assertSameOrigin(request);
      const id = await currentLearnerId();
      const { conceptKey } = await context.params;
      if (!id) return Response.json({ profile: { enabled: false, concepts: [], misconceptions: [] } });
      const profile = removeConcept(await readLearningProfile(id), decodeURIComponent(conceptKey));
      await writeLearningProfile(id, profile);
      return Response.json({ profile });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
