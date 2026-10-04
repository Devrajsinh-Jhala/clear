import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { comparisonChoiceSchema } from "@/src/lib/api/inputs";
import { chooseComparison } from "@/src/lib/explanation/lessons";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = comparisonChoiceSchema.parse(await request.json());
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
}
