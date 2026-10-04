import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { teachBackInputSchema } from "@/src/lib/api/inputs";
import { submitTeachBack } from "@/src/lib/explanation/lessons";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = teachBackInputSchema.parse(await request.json());
    const { result } = await submitTeachBack({
      conversationId: id,
      explanation: input.explanation,
    });
    return Response.json({ result });
  } catch (error) {
    return errorResponse(error);
  }
}
