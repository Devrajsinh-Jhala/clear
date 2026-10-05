import { readBoundedJson } from "@/src/lib/security/limits/body";
import { withApiGuard } from "@/src/lib/api/guard";
import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { followUpInputSchema } from "@/src/lib/api/inputs";
import { addFollowUp } from "@/src/lib/explanation/lessons";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiGuard(request, "generation", async () => {
    try {
      assertSameOrigin(request);
      const { id } = await context.params;
      const input = followUpInputSchema.parse(await readBoundedJson(request));
      const record = await addFollowUp({
        conversationId: id,
        message: input.message,
        activeView: input.activeView,
        provider: input.provider,
        model: input.model,
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
  });
}
