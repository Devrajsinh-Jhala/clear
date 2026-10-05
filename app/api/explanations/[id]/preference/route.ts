import { readBoundedJson } from "@/src/lib/security/limits/body";
import { withApiGuard } from "@/src/lib/api/guard";
import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { comparisonChoiceSchema } from "@/src/lib/api/inputs";
import { chooseComparison } from "@/src/lib/explanation/lessons";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiGuard(request, "mutation", async () => {
    try {
      assertSameOrigin(request);
      const { id } = await context.params;
      const input = comparisonChoiceSchema.parse(await readBoundedJson(request));
      const result = await chooseComparison({
        conversationId: id,
        optionId: input.optionId,
        rating: input.rating,
        use: input.use,
      });
      return Response.json({
        document: result.record.document,
        activeProvider: result.record.activeProvider,
        activeModel: result.record.activeModel,
        title: result.record.title,
        meta: result.meta,
      });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
