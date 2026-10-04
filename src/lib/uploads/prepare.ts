import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ClearError } from "@/src/lib/api/errors";
import { extractText, getDocumentProxy } from "unpdf";
import { isUuid } from "@/src/lib/explanation/normalize";
import { assertUpload, maxPdfPages, parsePageSelection, type AllowedMime } from "@/src/lib/uploads/files";

export type PreparedAttachment = {
  id: string;
  filename: string;
  mimeType: AllowedMime;
  sizeBytes: number;
  storageName: string;
  pageCount?: number;
  extractedText?: string;
  dataBase64: string;
};

const root = path.join(process.cwd(), ".data", "uploads");

export async function prepareUploads(
  files: File[],
  options: { pdfScope?: string; pdfPages?: string },
): Promise<PreparedAttachment[]> {
  if (files.length > 3) {
    throw new ClearError("file_rejected", "Attach at most three files.", { status: 400 });
  }
  const prepared: PreparedAttachment[] = [];
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    let mimeType: AllowedMime;
    try {
      mimeType = assertUpload({ mimeType: file.type, sizeBytes: bytes.length, filename: file.name || "upload" });
    } catch (error) {
      throw new ClearError("file_rejected", error instanceof Error ? error.message : "That file is not supported.", {
        status: 400,
      });
    }
    const id = crypto.randomUUID();
    const storageName = `${id}${mimeType === "image/jpeg" ? ".jpg" : mimeType === "application/pdf" ? ".pdf" : mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".gif"}`;
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, storageName), bytes);
    const attachment: PreparedAttachment = {
      id,
      filename: file.name || storageName,
      mimeType,
      sizeBytes: bytes.length,
      storageName,
      dataBase64: bytes.toString("base64"),
    };
    if (mimeType === "application/pdf") {
      const pdf = await readPdf(bytes);
      attachment.pageCount = pdf.pageCount;
      let selected: number[];
      try {
        selected =
          options.pdfScope === "pages"
            ? parsePageSelection(options.pdfPages || "", pdf.pageCount)
            : allPages(pdf.pageCount);
      } catch (error) {
        if (error instanceof ClearError) throw error;
        throw new ClearError("file_rejected", error instanceof Error ? error.message : "Choose a valid page range.", {
          status: 400,
        });
      }
      attachment.extractedText = selected.map((page) => pdf.pages[page - 1] ?? "").join("\n\n").slice(0, 30000);
      if (options.pdfScope === "pages") attachment.dataBase64 = "";
    }
    prepared.push(attachment);
  }
  return prepared;
}

function allPages(pageCount: number): number[] {
  if (pageCount > maxPdfPages()) {
    throw new ClearError(
      "file_rejected",
      `This PDF has ${pageCount} pages. Choose a smaller page range.`,
      { status: 400 },
    );
  }
  return Array.from({ length: pageCount }, (_, index) => index + 1);
}

async function readPdf(bytes: Buffer): Promise<{ pageCount: number; pages: string[] }> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const extracted = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
    return { pageCount: extracted.totalPages, pages };
  } catch {
    throw new ClearError("file_rejected", "CLEAR could not read that PDF.", { status: 400 });
  }
}

export async function readStoredUpload(storageName: string): Promise<Buffer | null> {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|gif|pdf)$/i.test(storageName)) return null;
  const id = storageName.slice(0, 36);
  if (!isUuid(id)) return null;
  try {
    return await readFile(path.join(root, storageName));
  } catch {
    return null;
  }
}
