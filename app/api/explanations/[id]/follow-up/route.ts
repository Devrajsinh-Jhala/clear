import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { followUpInputSchema } from "@/src/lib/api/inputs";
import { addFollowUp } from "@/src/lib/explanation/lessons";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = followUpInputSchema.parse(await request.json());
    const record = await addFollowUp({
      conversationId: id,
      message: input.message,
      activeView: input.activeView,
    });
    return Response.json({
      reply: record.messages.at(-1)?.content ?? "",
      document: record.document,
      messages: record.messages,
      activeProvider: record.activeProvider,
      activeModel: record.activeModel,
      title: record.title,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
