export type LessonExportFormat = "markdown" | "json" | "pdf";

export function safeDownloadFilename(topic: string, format: LessonExportFormat): string {
  const extension = { markdown: "md", json: "json", pdf: "pdf" }[format];
  if (!extension) throw new Error("Choose a supported export format.");
  const slug = topic.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "").toLowerCase();
  return `clear-${slug || "lesson"}.${extension}`;
}
