import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { createExplanationInputSchema } from "@/src/lib/api/inputs";
import { createLesson } from "@/src/lib/explanation/lessons";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = createExplanationInputSchema.parse(await request.json());
    const record = await createLesson(input);
    return Response.json({ conversationId: record.id });
  } catch (error) {
    return errorResponse(error);
  }
}
