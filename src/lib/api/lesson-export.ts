import "server-only";

import { ClearError, toErrorBody } from "@/src/lib/api/errors";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import { exportLessonJson } from "@/src/lib/export/json";
import { exportLessonMarkdown } from "@/src/lib/export/markdown";
import { safeDownloadFilename } from "@/src/lib/export/filename";
import { exportLessonPdf } from "@/src/lib/export/pdf";

export type LessonExportFormat = "markdown" | "json" | "pdf";

const DOWNLOAD_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Cookie",
};

export function readExportFormat(request: Request): LessonExportFormat {
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "markdown" && format !== "json" && format !== "pdf") {
    throw new ClearError("invalid_request", "Choose Markdown, JSON, or PDF for the download.", { status: 400 });
  }
  return format;
}

export function readProviderExportChoice(request: Request): boolean {
  const choice = new URL(request.url).searchParams.get("includeProvider");
  if (choice === null || choice === "false") return false;
  if (choice === "true") return true;
  throw new ClearError("invalid_request", "Choose whether to include the model name and try again.", { status: 400 });
}

/** Input must be a projected owner export or the creator's frozen public snapshot. */
export async function lessonExportResponse(document: ExplanationDocument, format: LessonExportFormat): Promise<Response> {
  const options = { includeProvider: true, exportedAt: document.metadata.generatedAt };
  const body = format === "pdf"
    ? new Uint8Array(await exportLessonPdf(document, options))
    : format === "json" ? exportLessonJson(document, options) : exportLessonMarkdown(document, options);
  const contentType = format === "pdf" ? "application/pdf"
    : format === "json" ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8";
  return new Response(body, {
    headers: {
      ...DOWNLOAD_HEADERS,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeDownloadFilename(document.topic, format)}"`,
    },
  });
}

export function lessonExportError(error: unknown): Response {
  if (error instanceof ClearError) {
    return Response.json(toErrorBody(error), { status: error.status, headers: DOWNLOAD_HEADERS });
  }
  return Response.json({
    error: { code: "export_failed", message: "The lesson download could not be prepared. Please try again.", retryable: true },
  }, { status: 500, headers: DOWNLOAD_HEADERS });
}
