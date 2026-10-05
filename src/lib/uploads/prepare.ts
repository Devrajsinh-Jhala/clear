import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { getDocumentProxy } from "unpdf";

import { ClearError } from "@/src/lib/api/errors";
import { isUuid } from "@/src/lib/explanation/normalize";
import { storageAdmin } from "@/src/lib/storage/admin";
import { assertLocalPersistence, dataDirectory } from "@/src/lib/storage/path";
import { assertUpload, assertUploadSignature, extensionForMime, maxPdfPages, parsePageSelection, totalUploadLimitBytes, type AllowedMime } from "@/src/lib/uploads/files";

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

const BUCKET = "clear-uploads";
const TEXT_LIMIT = 30_000;

function filesystemCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
}

function storageFailure(): ClearError {
  return new ClearError("upload_storage_failed", "CLEAR could not securely save or read those files. Please try again shortly.", { status: 503, retryable: true });
}

function rejected(message: string): ClearError {
  return new ClearError("file_rejected", message, { status: 400 });
}

function validStorageName(storageName: string): boolean {
  return /^[0-9a-f-]{36}\.(png|jpg|webp|gif|pdf)$/i.test(storageName) && isUuid(storageName.slice(0, 36));
}

export async function prepareUploads(files: File[], options: { pdfScope?: string; pdfPages?: string }): Promise<PreparedAttachment[]> {
  if (files.length > 3) throw rejected("Attach at most three files.");
  if (options.pdfScope && !["whole", "pages"].includes(options.pdfScope)) throw rejected("Choose the whole PDF or a page range.");
  if (files.reduce((total, file) => total + file.size, 0) > totalUploadLimitBytes()) {
    throw rejected(`The combined files exceed the ${Math.round(totalUploadLimitBytes() / 1024 / 1024)} MB attachment limit. Use smaller files.`);
  }
  // Validate metadata for every file before loading bytes, and validate/parse every
  // loaded file before the first storage write. A rejected batch leaves no uploads.
  const types: AllowedMime[] = files.map((file) => {
    try { return assertUpload({ mimeType: file.type, sizeBytes: file.size, filename: file.name || "upload" }); }
    catch (error) { throw rejected(error instanceof Error ? error.message : "That file is not supported."); }
  });
  const validated: { bytes: Buffer; attachment: PreparedAttachment }[] = [];
  for (const [index, file] of files.entries()) {
    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      assertUpload({ mimeType: file.type, sizeBytes: bytes.length, filename: file.name || "upload" });
      assertUploadSignature(bytes, types[index]);
    } catch (error) { throw rejected(error instanceof Error ? error.message : "That file is not supported."); }
    const id = randomUUID();
    const mimeType = types[index];
    const storageName = `${id}${extensionForMime(mimeType)}`;
    const attachment: PreparedAttachment = {
      id, filename: file.name || storageName, mimeType, sizeBytes: bytes.length, storageName, dataBase64: bytes.toString("base64"),
    };
    if (mimeType === "application/pdf") {
      const pdf = await readPdf(bytes, options);
      attachment.pageCount = pdf.pageCount;
      attachment.extractedText = pdf.text;
      if (options.pdfScope === "pages") attachment.dataBase64 = "";
    }
    validated.push({ bytes, attachment });
  }
  const attempted: PreparedAttachment[] = [];
  try {
    for (const { bytes, attachment } of validated) {
      attempted.push(attachment);
      await persistUpload(bytes, attachment);
    }
  } catch (error) {
    // Include the failed attempt: a storage timeout may have written the object.
    await cleanupPreparedUploads(attempted);
    throw error;
  }
  return validated.map(({ attachment }) => attachment);
}

async function persistUpload(bytes: Buffer, attachment: PreparedAttachment): Promise<void> {
  try {
    const client = storageAdmin();
    if (client) {
      const { error } = await client.storage.from(BUCKET).upload(attachment.storageName, bytes, { contentType: attachment.mimeType, upsert: false, cacheControl: "0" });
      if (error) throw error;
      return;
    }
    assertLocalPersistence();
    const root = dataDirectory("uploads");
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, attachment.storageName), bytes, { flag: "wx", mode: 0o600 });
  } catch { throw storageFailure(); }
}

export async function cleanupPreparedUploads(uploads: Pick<PreparedAttachment, "storageName">[]): Promise<void> {
  if (!uploads.length) return;
  const names = uploads.map((upload) => upload.storageName);
  if (names.some((name) => !validStorageName(name))) throw storageFailure();
  try {
    const client = storageAdmin();
    if (client) {
      const { error } = await client.storage.from(BUCKET).remove(names);
      if (error) throw error;
      return;
    }
    assertLocalPersistence();
    const results = await Promise.allSettled(names.map(async (name) => {
      try { await unlink(path.join(dataDirectory("uploads"), name)); }
      catch (error) { if (filesystemCode(error) !== "ENOENT") throw error; }
    }));
    if (results.some((result) => result.status === "rejected")) throw storageFailure();
  } catch { throw storageFailure(); }
}

export async function readStoredUpload(storageName: string): Promise<Buffer | null> {
  if (!validStorageName(storageName)) return null;
  try {
    const client = storageAdmin();
    if (client) {
      const { data, error } = await client.storage.from(BUCKET).download(storageName);
      if (error) {
        if ("statusCode" in error && String(error.statusCode) === "404") return null;
        throw error;
      }
      if (!data) throw storageFailure();
      return Buffer.from(await data.arrayBuffer());
    }
    assertLocalPersistence();
    return await readFile(path.join(dataDirectory("uploads"), storageName));
  } catch (error) {
    if (filesystemCode(error) === "ENOENT") return null;
    throw storageFailure();
  }
}

async function readPdf(bytes: Buffer, options: { pdfScope?: string; pdfPages?: string }): Promise<{ pageCount: number; text: string }> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const operation = async () => {
    pdf = await getDocumentProxy(new Uint8Array(bytes), { disableFontFace: true, maxImageSize: 4_000_000, stopAtErrors: true });
    if (timedOut) { await pdf.loadingTask.destroy(); throw rejected("That PDF took too long to read. Use a smaller file."); }
    const pageCount = pdf.numPages;
    if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 2000) throw rejected("Use a PDF with at most 2,000 pages.");
    let selected: number[];
    try {
      if (options.pdfScope === "pages") selected = parsePageSelection(options.pdfPages || "", pageCount);
      else {
        if (pageCount > maxPdfPages()) throw new Error(`This PDF has ${pageCount} pages. Choose a smaller page range.`);
        selected = Array.from({ length: pageCount }, (_, index) => index + 1);
      }
    } catch (error) { throw rejected(error instanceof Error ? error.message : "Choose a valid page range."); }
    let text = "";
    for (const pageNumber of selected) {
      if (text.length >= TEXT_LIMIT || timedOut) break;
      const page = await pdf.getPage(pageNumber);
      const reader = page.streamTextContent().getReader();
      try {
        while (text.length < TEXT_LIMIT && !timedOut) {
          const chunk = await reader.read();
          if (chunk.done) break;
          const content = chunk.value as { items: { str?: string; hasEOL?: boolean }[] };
          for (const item of content.items) {
            if (typeof item.str !== "string") continue;
            text += `${item.str}${item.hasEOL ? "\n" : " "}`.slice(0, TEXT_LIMIT - text.length);
            if (text.length >= TEXT_LIMIT) break;
          }
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
        page.cleanup();
      }
      text += "\n\n".slice(0, TEXT_LIMIT - text.length);
    }
    return { pageCount, text: text.trim() };
  };
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { timedOut = true; void pdf?.loadingTask.destroy().catch(() => undefined); reject(rejected("That PDF took too long to read. Use a smaller file.")); }, 15_000);
      }),
    ]);
  } catch (error) {
    if (error instanceof ClearError) throw error;
    throw rejected("CLEAR could not read that PDF. Use an unencrypted, readable PDF.");
  } finally {
    if (timer) clearTimeout(timer);
    await pdf?.loadingTask.destroy().catch(() => undefined);
  }
}
