import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import { lessonExportBlocks, type ExportBlock } from "@/src/lib/export/blocks";
import { projectExplanation, type ExportOptions } from "@/src/lib/export/document";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_BOTTOM = 65;
const INK = rgb(0.13, 0.18, 0.15);
const MUTED = rgb(0.39, 0.44, 0.4);
const TEAL = rgb(0.11, 0.4, 0.36);
const LINE = rgb(0.86, 0.89, 0.85);
const CODE_BACKGROUND = rgb(0.95, 0.96, 0.94);
let fontAssets: Promise<[Buffer, Buffer]> | undefined;

function loadFontAssets() {
  if (!fontAssets) {
    const directory = path.join(process.cwd(), "src", "lib", "export", "fonts");
    fontAssets = Promise.all([readFile(path.join(directory, "DejaVuSans.ttf")), readFile(path.join(directory, "LICENSE.txt"))]);
    fontAssets.catch(() => { fontAssets = undefined; });
  }
  return fontAssets;
}

/** Creates a paginated, self-contained PDF. Never fetches URLs or renders model HTML. */
export async function exportLessonPdf(document: ExplanationDocument, options: ExportOptions = {}): Promise<Uint8Array> {
  const published = projectExplanation(document, options);
  const [fontBytes, licenseBytes] = await loadFontAssets();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  pdf.setTitle(published.topic);
  pdf.setAuthor("CLEAR");
  pdf.setCreator("CLEAR lesson export");
  pdf.setSubject("Learning notes from a CLEAR explanation");
  pdf.setCreationDate(new Date(published.metadata.generatedAt));
  pdf.setModificationDate(new Date(published.metadata.generatedAt));
  await pdf.attach(licenseBytes, "DejaVu-font-license.txt", { mimeType: "text/plain", description: "License for the embedded DejaVu Sans font" });
  const blocks = lessonExportBlocks(published, false);
  const supported = new Set(font.getCharacterSet());
  let notationUsed = false;
  const printable = (text: string) => Array.from(text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ")).map((character) => {
    if (character === "\n") return character;
    const codepoint = character.codePointAt(0)!;
    if (supported.has(codepoint) && codepoint >= 32 && codepoint !== 127) return character;
    notationUsed = true;
    return `[U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}]`;
  }).join("");
  // Decide on the notation notice before laying out the first page.
  for (const block of blocks) {
    if (block.kind === "list") block.items.forEach(printable);
    else printable(block.text);
  }
  if (notationUsed) blocks.splice(2, 0, { kind: "paragraph", text: "Some characters use Unicode codepoint notation, such as [U+4F60], because the embedded font does not contain their glyphs. JSON and Markdown preserve the original text." });
  let page: PDFPage;
  let y = 0;
  const newPage = () => {
    if (pdf.getPageCount() >= 500) throw new Error("This lesson is too long for a PDF. Download JSON or Markdown instead.");
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawText("CLEAR", { x: MARGIN, y: PAGE_HEIGHT - 36, size: 9, font, color: TEAL });
    page.drawText("LEARNING NOTES", { x: MARGIN + 49, y: PAGE_HEIGHT - 36, size: 8, font, color: MUTED });
    page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 47 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 47 }, thickness: 0.6, color: LINE });
    y = PAGE_HEIGHT - 75;
  };
  const ensure = (height: number) => { if (y - height < BODY_BOTTOM) newPage(); };
  const lines = (text: string, size: number, width = CONTENT_WIDTH) => wrapPdfText(printable(text), font, size, width);
  const drawLines = (content: string[], size: number, lineHeight: number, x = MARGIN, code = false, color = INK) => {
    for (const line of content) {
      ensure(lineHeight);
      if (code) page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_WIDTH, height: lineHeight + 0.4, color: CODE_BACKGROUND });
      if (line) page.drawText(line, { x, y, size, font, color });
      y -= lineHeight;
    }
  };
  const headingStart = (index: number, level: number) => {
    let height = 0;
    for (const following of blocks.slice(index + 1, index + 4)) {
      if (following.kind === "heading") {
        if (following.level <= level) break;
        height += lines(following.text, 11.4).length * 15 + 10;
      } else if (following.kind === "paragraph") height += Math.min(lines(following.text, 10.1).length, 3) * 15 + 8;
      else if (following.kind === "list") { height += Math.min(lines(following.items[0] ?? "", 10.1, CONTENT_WIDTH - 18).length, 3) * 15 + 8; break; }
      else { height += 35; break; }
    }
    return Math.max(36, Math.min(height, 155));
  };
  const drawBlock = (block: ExportBlock, index: number) => {
    if (block.kind === "heading") {
      const size = block.level === 1 ? 25 : block.level === 2 ? 15 : 11.4;
      const lineHeight = size * 1.32;
      const content = lines(block.text, size);
      const gap = block.level === 1 ? 0 : block.level === 2 ? 14 : 6;
      ensure(Math.min(content.length * lineHeight, 110) + gap + headingStart(index, block.level));
      y -= gap;
      drawLines(content, size, lineHeight, MARGIN, false, block.level === 1 ? INK : TEAL);
      if (block.level === 2) { page.drawLine({ start: { x: MARGIN, y: y + 3 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 3 }, thickness: 0.5, color: LINE }); y -= 7; }
      else y -= block.level === 1 ? 11 : 4;
      return;
    }
    if (block.kind === "list") {
      block.items.forEach((item, index) => {
        const prefix = block.ordered ? `${index + 1}.` : "•";
        const content = lines(item, 10.1, CONTENT_WIDTH - 18);
        ensure(Math.min(content.length, 2) * 15);
        page.drawText(prefix, { x: MARGIN, y, size: 9.5, font, color: TEAL });
        drawLines(content, 10.1, 15, MARGIN + 18);
        y -= 4;
      });
      y -= 4;
      return;
    }
    if (block.kind === "code") {
      const content = lines(block.text, 9.1, CONTENT_WIDTH - 20);
      ensure(35); y -= 6;
      drawLines(content, 9.1, 13.5, MARGIN + 10, true);
      y -= 12;
      return;
    }
    const content = lines(block.text, 10.1);
    ensure(Math.min(content.length, 2) * 15);
    drawLines(content, 10.1, 15);
    y -= 8;
  };
  newPage();
  blocks.forEach(drawBlock);
  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawLine({ start: { x: MARGIN, y: 49 }, end: { x: PAGE_WIDTH - MARGIN, y: 49 }, thickness: 0.5, color: LINE });
    current.drawText("CLEAR · Understand the mechanism", { x: MARGIN, y: 33, size: 8, font, color: MUTED });
    const number = `${index + 1} / ${pages.length}`;
    current.drawText(number, { x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(number, 8), y: 33, size: 8, font, color: MUTED });
  });
  return pdf.save();
}

/** Split even uninterrupted code/URLs by measured glyph widths, preserving every character. */
export function wrapPdfText(text: string, font: Pick<PDFFont, "widthOfTextAtSize">, size: number, maxWidth: number): string[] {
  const output: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) { output.push(""); continue; }
    let line = "";
    let width = 0;
    for (const token of paragraph.match(/\s+|\S+/gu) ?? []) {
      const tokenWidth = font.widthOfTextAtSize(token, size);
      if (width + tokenWidth <= maxWidth) { line += token; width += tokenWidth; continue; }
      if (tokenWidth <= maxWidth) {
        if (line) output.push(line);
        line = token; width = tokenWidth;
        continue;
      }
      for (const character of Array.from(token)) {
        const characterWidth = font.widthOfTextAtSize(character, size);
        if (line && width + characterWidth > maxWidth) { output.push(line); line = ""; width = 0; }
        line += character; width += characterWidth;
      }
    }
    if (line) output.push(line);
  }
  return output;
}
