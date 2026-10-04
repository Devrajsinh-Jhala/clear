import { ClearError } from "@/src/lib/api/errors";
import { lessonExportError, lessonExportResponse, readExportFormat } from "@/src/lib/api/lesson-export";
import { readPublicShare } from "@/src/lib/sharing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ shareId: string }> }) {
  try {
    const format = readExportFormat(request);
    const { shareId } = await context.params;
    const share = await readPublicShare(shareId);
    if (!share) {
      throw new ClearError("not_found", "This shared lesson is unavailable. The creator may have replaced or revoked its link.", { status: 404 });
    }
    return await lessonExportResponse(share.document, format);
  } catch (error) {
    return lessonExportError(error);
  }
}
