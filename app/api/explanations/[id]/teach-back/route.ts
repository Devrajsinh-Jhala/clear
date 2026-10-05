import { readBoundedJson } from "@/src/lib/security/limits/body";
import { withApiGuard } from "@/src/lib/api/guard";
import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { teachBackInputSchema } from "@/src/lib/api/inputs";
import { submitTeachBack } from "@/src/lib/explanation/lessons";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiGuard(request, "generation", async () => {
    try {
      assertSameOrigin(request);
      const { id } = await context.params;
      const input = teachBackInputSchema.parse(await readBoundedJson(request));
      const { result } = await submitTeachBack({
        conversationId: id,
        explanation: input.explanation,
      });
      return Response.json({ result });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
