import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import { projectExplanation, type ExportOptions } from "@/src/lib/export/document";

export function exportLessonJson(document: ExplanationDocument, options: ExportOptions = {}): string {
  return `${JSON.stringify(projectExplanation(document, options), null, 2)}\n`;
}
