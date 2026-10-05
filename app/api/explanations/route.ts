import { readBoundedJson, readBoundedFormData } from "@/src/lib/security/limits/body";
import { withApiGuard } from "@/src/lib/api/guard";
import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { createExplanationInputSchema } from "@/src/lib/api/inputs";
import { createLesson } from "@/src/lib/explanation/lessons";
import { cleanupPreparedUploads, prepareUploads, type PreparedAttachment } from "@/src/lib/uploads/prepare";
import { checkRequestLimits } from "@/src/lib/security/limits";
import { currentLearnerId } from "@/src/lib/learning/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withApiGuard(request, 'generation', async () => {
  let pendingUploads: PreparedAttachment[] | undefined;
  try {
    assertSameOrigin(request);
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await readBoundedFormData(request);
      const input = createExplanationInputSchema.parse({
        question: textField(form, "question"),
        level: textField(form, "level"),
        depth: textField(form, "depth"),
        customLevel: textField(form, "customLevel"),
        exampleId: textField(form, "exampleId"),
        model: textField(form, "model"),
        provider: textField(form, "provider"),
        compareProvider: textField(form, "compareProvider"),
        compareModel: textField(form, "compareModel"),
      });
      const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
      if (files.length) await checkRequestLimits(request, "upload", { learnerId: await currentLearnerId() });
      const uploads = files.length
        ? await prepareUploads(files, {
            pdfScope: String(form.get("pdfScope") || "whole"),
            pdfPages: String(form.get("pdfPages") || ""),
          })
        : undefined;
      pendingUploads = uploads;
      const record = await createLesson({ ...input, uploads });
      pendingUploads = undefined;
      return Response.json({ conversationId: record.id });
    }
    const input = createExplanationInputSchema.parse(await readBoundedJson(request));
    const record = await createLesson(input);
    return Response.json({ conversationId: record.id });
  } catch (error) {
    if (pendingUploads) {
      try { await cleanupPreparedUploads(pendingUploads); }
      catch (cleanupError) { return errorResponse(cleanupError); }
    }
    return errorResponse(error);
  }
  });
}

function textField(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value : undefined;
}
