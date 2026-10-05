import { withApiGuard } from "@/src/lib/api/guard";
import { lessonExportError, lessonExportResponse, readExportFormat, readProviderExportChoice } from "@/src/lib/api/lesson-export";
import { ClearError } from "@/src/lib/api/errors";
import { projectExplanation } from "@/src/lib/export/document";
import { getOwnedLesson } from "@/src/lib/sharing/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiGuard(request, "export", async () => {
    try {
      const format = readExportFormat(request);
      const includeProvider = readProviderExportChoice(request);
      const { id } = await context.params;
      const conversation = await getOwnedLesson(id);
      if (!conversation.document) {
        throw new ClearError("not_found", "That lesson is not available in this browser.", { status: 404 });
      }
      const document = projectExplanation(conversation.document, { includeProvider });
      return await lessonExportResponse(document, format);
    } catch (error) {
      return lessonExportError(error);
    }
  });
}
