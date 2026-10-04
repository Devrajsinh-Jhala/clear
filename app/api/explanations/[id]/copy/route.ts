import { assertShareWriteOrigin, noStore, shareErrorResponse } from "@/src/lib/sharing/http";
import { copyLegacyLesson } from "@/src/lib/sharing/service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertShareWriteOrigin(request);
    const { id } = await context.params;
    const record = await copyLegacyLesson(id);
    return noStore(Response.json({ conversationId: record.id }));
  } catch (error) { return shareErrorResponse(error); }
}
