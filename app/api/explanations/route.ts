import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { createExplanationInputSchema } from "@/src/lib/api/inputs";
import { createLesson } from "@/src/lib/explanation/lessons";
import { prepareUploads } from "@/src/lib/uploads/prepare";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const input = createExplanationInputSchema.parse({
        question: textField(form, "question"),
        level: textField(form, "level"),
        depth: textField(form, "depth"),
        customLevel: textField(form, "customLevel"),
        exampleId: textField(form, "exampleId"),
        model: textField(form, "model"),
      });
      const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
      const uploads = files.length
        ? await prepareUploads(files, {
            pdfScope: String(form.get("pdfScope") || "whole"),
            pdfPages: String(form.get("pdfPages") || ""),
          })
        : undefined;
      const record = await createLesson({ ...input, uploads });
      return Response.json({ conversationId: record.id });
    }
    const input = createExplanationInputSchema.parse(await request.json());
    const record = await createLesson(input);
    return Response.json({ conversationId: record.id });
  } catch (error) {
    return errorResponse(error);
  }
}

function textField(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value : undefined;
}
