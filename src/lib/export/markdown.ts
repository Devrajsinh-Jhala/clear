import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import { lessonExportBlocks } from "@/src/lib/export/blocks";
import { projectExplanation, type ExportOptions } from "@/src/lib/export/document";

export function exportLessonMarkdown(document: ExplanationDocument, options: ExportOptions = {}): string {
  return lessonExportBlocks(projectExplanation(document, options), true).map((block) => {
    switch (block.kind) {
      case "heading": return `${"#".repeat(block.level)} ${escapeMarkdown(block.text)}`;
      case "paragraph": return escapeMarkdown(block.text);
      case "list": return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${escapeMarkdown(item).replace(/\n/g, "\n  ")}`).join("\n");
      case "code": {
        const longestFence = Math.max(0, ...(block.text.match(/`+/g) ?? []).map((run) => run.length));
        const fence = "`".repeat(Math.max(3, longestFence + 1));
        return `${fence}${block.language}\n${block.text}\n${fence}`;
      }
    }
  }).join("\n\n") + "\n";
}

function escapeMarkdown(text: string): string {
  const inline = text.replace(/\r\n?/g, "\n")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/([\\`*_\[\]|~])/g, "\\$1")
    // Entities render as punctuation without being reparsed as automatic links.
    .replace(/\b([a-z][a-z\d+.-]*):(?=\/\/)/gi, "$1&#58;")
    .replace(/\bwww\./gi, "www&#46;")
    .replace(/@(?=[a-z\d](?:[a-z\d-]*\.)+[a-z])/gi, "&#64;");

  return inline.split("\n").map((line) => line
    .replace(/^([ \t]*)(#{1,6})(?=[ \t]|$)/, "$1\\$2")
    .replace(/^([ \t]*)([-+])(?=[- \t]|$)/, "$1\\$2")
    .replace(/^([ \t]*\d{1,9})([.)])(?=[ \t]|$)/, "$1\\$2")
    .replace(/^([ \t]*)(=)([= \t]*)$/, "$1\\$2$3")
    // Also preserve literal closing hashes when this text is used in a heading.
    .replace(/(^|[ \t])(#+)([ \t]*)$/, (_, space: string, hashes: string, trailing: string) => `${space}${hashes.replace(/#/g, "\\#")}${trailing}`)
    .replace(/^(?= {4}| *\t)[ \t]/, (space) => space === "\t" ? "&#9;" : "&#32;")
  ).join("\n");
}
