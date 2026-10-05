import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  useSupabase: true,
  pages: [] as number[],
  from: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
  createLesson: vi.fn(),
  checkRequestLimits: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/storage/admin", () => ({ storageAdmin: () => state.useSupabase ? { storage: { from: state.from } } : null }));
vi.mock("@/src/lib/explanation/lessons", () => ({ createLesson: state.createLesson }));
vi.mock("@/src/lib/learning/session", () => ({ currentLearnerId: async () => "11111111-1111-4111-8111-111111111111" }));
vi.mock("@/src/lib/security/limits", () => ({ checkRequestLimits: state.checkRequestLimits, limitResponseHeaders: () => ({}) }));
vi.mock("@/src/lib/api/guard", () => ({ withApiGuard: async (_request: Request, _action: string, handler: () => Promise<Response>) => handler() }));
vi.mock("@/src/lib/monitoring/server", () => ({ reportServerError: () => undefined }));
vi.mock("unpdf", async (importOriginal) => {
  const original = await importOriginal<typeof import("unpdf")>();
  return {
    ...original,
    getDocumentProxy: async (...args: Parameters<typeof original.getDocumentProxy>) => {
      const pdf = await original.getDocumentProxy(...args);
      const getPage = pdf.getPage.bind(pdf);
      pdf.getPage = async (pageNumber: number) => { state.pages.push(pageNumber); return getPage(pageNumber); };
      return pdf;
    },
  };
});

import { POST } from "@/app/api/explanations/route";
import { ClearError } from "@/src/lib/api/errors";
import { assertUploadSignature, parsePageSelection, totalUploadLimitBytes, uploadLimitBytes } from "@/src/lib/uploads/files";
import { cleanupPreparedUploads, prepareUploads, readStoredUpload } from "@/src/lib/uploads/prepare";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1kAAAAASUVORK5CYII=", "base64");
const storedName = "33333333-3333-4333-8333-333333333333.png";
const folders: string[] = [];

beforeEach(() => {
  state.useSupabase = true;
  state.pages = [];
  state.upload.mockReset().mockResolvedValue({ error: null });
  state.remove.mockReset().mockResolvedValue({ error: null });
  state.download.mockReset().mockResolvedValue({ data: new Blob([png]), error: null });
  state.from.mockReset().mockImplementation(() => ({ upload: state.upload, remove: state.remove, download: state.download }));
  state.createLesson.mockReset().mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
  state.checkRequestLimits.mockReset().mockResolvedValue(undefined);
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("MAX_UPLOAD_MB", "10");
  vi.stubEnv("MAX_TOTAL_UPLOAD_MB", "30");
  vi.stubEnv("MAX_PDF_PAGES", "40");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});

function image(name = "diagram.png") { return new File([png], name, { type: "image/png" }); }
async function pdfFile(pages = 3): Promise<File> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let page = 1; page <= pages; page++) pdf.addPage([500, 300]).drawText(`SYNTHETIC_PAGE_${page}`, { x: 30, y: 180, size: 14, font });
  return new File([new Uint8Array(await pdf.save())], "synthetic.pdf", { type: "application/pdf" });
}
function uploadRequest(file: File): Request {
  const form = new FormData();
  form.set("question", "Explain this synthetic attachment.");
  form.set("level", "beginner");
  form.set("depth", "balanced");
  form.set("files", file);
  return new Request("https://clear.example/api/explanations", { method: "POST", body: form, headers: { Origin: "https://clear.example" } });
}

describe("upload validation and private persistence", () => {
  it("validates all file metadata before reading any bytes or writing any storage", async () => {
    const first = image();
    const read = vi.spyOn(first, "arrayBuffer");
    const invalid = new File(["not allowed"], "page.html", { type: "text/html" });
    await expect(prepareUploads([first, invalid], {})).rejects.toMatchObject({ code: "file_rejected", status: 400 });
    expect(read).not.toHaveBeenCalled();
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("rejects disguised HTML and invalid signatures before persisting the first valid file", async () => {
    const disguised = new File(["<script>synthetic()</script>"], "disguised.png", { type: "image/png" });
    await expect(prepareUploads([image(), disguised], {})).rejects.toMatchObject({ code: "file_rejected", message: expect.stringContaining("contents") });
    expect(state.upload).not.toHaveBeenCalled();
    for (const mime of ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"] as const) {
      expect(() => assertUploadSignature(new Uint8Array(Buffer.from("<html>not media</html>")), mime)).toThrow(/contents/);
    }
  });

  it("uses only a random object path in the private Supabase bucket", async () => {
    const [prepared] = await prepareUploads([image("private-source-name.png")], {});
    expect(state.from).toHaveBeenCalledWith("clear-uploads");
    expect(prepared.storageName).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(prepared.storageName).not.toContain("private-source-name");
    expect(state.upload).toHaveBeenCalledWith(prepared.storageName, png, { contentType: "image/png", upsert: false, cacheControl: "0" });
    expect(prepared.dataBase64).toBe(png.toString("base64"));
    expect((await readStoredUpload(prepared.storageName))?.equals(png)).toBe(true);
  });

  it("removes every attempted object if a later persistence operation fails", async () => {
    state.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "PRIVATE_STORAGE_FAILURE" } });
    await expect(prepareUploads([image("first.png"), image("second.png")], {})).rejects.toMatchObject({ code: "upload_storage_failed", status: 503, message: expect.not.stringContaining("PRIVATE") });
    expect(state.upload).toHaveBeenCalledTimes(2);
    expect(state.remove).toHaveBeenCalledWith(state.upload.mock.calls.map((call) => call[0]));
  });

  it("does not hide a cleanup storage failure", async () => {
    state.remove.mockResolvedValue({ error: { message: "PRIVATE_CLEANUP_FAILURE" } });
    await expect(cleanupPreparedUploads([{ storageName: storedName }])).rejects.toMatchObject({ code: "upload_storage_failed", status: 503 });
  });

  it("distinguishes a missing object from storage/service failure and rejects traversal", async () => {
    state.download.mockResolvedValueOnce({ data: null, error: { statusCode: "404", message: "Missing" } });
    expect(await readStoredUpload(storedName)).toBeNull();
    state.download.mockResolvedValueOnce({ data: null, error: { statusCode: "503", message: "PRIVATE_DATABASE_DETAILS" } });
    await expect(readStoredUpload(storedName)).rejects.toMatchObject({ code: "upload_storage_failed", status: 503, message: expect.not.stringContaining("PRIVATE") });
    state.download.mockClear();
    expect(await readStoredUpload("../credentials/secret.png")).toBeNull();
    expect(state.download).not.toHaveBeenCalled();
    await expect(cleanupPreparedUploads([{ storageName: "../credentials/secret.png" }])).rejects.toMatchObject({ status: 503 });
    expect(state.remove).not.toHaveBeenCalled();
  });

  it("persists, reloads and cleans local uploads using the configured durable directory", async () => {
    state.useSupabase = false;
    const directory = await mkdtemp(path.join(tmpdir(), "clear-upload-"));
    folders.push(directory);
    vi.stubEnv("CLEAR_DATA_DIR", directory);
    const [prepared] = await prepareUploads([image()], {});
    expect(await readdir(path.join(directory, "uploads"))).toEqual([prepared.storageName]);
    expect((await readStoredUpload(prepared.storageName))?.equals(png)).toBe(true);
    await cleanupPreparedUploads([prepared]);
    expect(await readStoredUpload(prepared.storageName)).toBeNull();
    expect(await readdir(path.join(directory, "uploads"))).toEqual([]);
  });

  it("caps both individual and aggregate Vercel attachments at 3 MiB before reading bytes", async () => {
    vi.stubEnv("VERCEL", "1");
    expect(uploadLimitBytes()).toBe(3 * 1024 * 1024);
    expect(totalUploadLimitBytes()).toBe(3 * 1024 * 1024);
    const large = new File([new Uint8Array(2 * 1024 * 1024)], "large.png", { type: "image/png" });
    const read = vi.spyOn(large, "arrayBuffer");
    await expect(prepareUploads([large, large], {})).rejects.toMatchObject({ code: "file_rejected", message: expect.stringContaining("combined") });
    expect(read).not.toHaveBeenCalled();
    expect(state.upload).not.toHaveBeenCalled();
  });
});

describe("real PDF page selection", () => {
  it("extracts only selected pages and sends text instead of the full PDF for a page range", async () => {
    const [prepared] = await prepareUploads([await pdfFile()], { pdfScope: "pages", pdfPages: "2" });
    expect(prepared.pageCount).toBe(3);
    expect(prepared.extractedText).toContain("SYNTHETIC_PAGE_2");
    expect(prepared.extractedText).not.toContain("SYNTHETIC_PAGE_1");
    expect(prepared.extractedText).not.toContain("SYNTHETIC_PAGE_3");
    expect(state.pages).toEqual([2]);
    expect(prepared.dataBase64).toBe("");
  });

  it("preserves the original PDF for whole-document provider input", async () => {
    const file = await pdfFile(2);
    const [prepared] = await prepareUploads([file], { pdfScope: "whole" });
    expect(prepared.extractedText).toContain("SYNTHETIC_PAGE_1");
    expect(prepared.extractedText).toContain("SYNTHETIC_PAGE_2");
    expect(state.pages).toEqual([1, 2]);
    expect(Buffer.from(prepared.dataBase64, "base64")).toEqual(Buffer.from(await file.arrayBuffer()));
  });

  it("checks PDF page limits and invalid selections before extracting any pages or persisting a batch", async () => {
    vi.stubEnv("MAX_PDF_PAGES", "2");
    const file = await pdfFile();
    await expect(prepareUploads([image(), file], { pdfScope: "whole" })).rejects.toMatchObject({ code: "file_rejected", message: expect.stringContaining("page range") });
    expect(state.pages).toEqual([]);
    expect(state.upload).not.toHaveBeenCalled();
    await expect(prepareUploads([file], { pdfScope: "pages", pdfPages: "8" })).rejects.toMatchObject({ code: "file_rejected" });
    expect(state.pages).toEqual([]);
    expect(state.upload).not.toHaveBeenCalled();
    expect(() => parsePageSelection("1-100000000", 100000000)).toThrow(/too many/);
  });

  it("rejects a malformed PDF without saving a previously valid image", async () => {
    const malformed = new File(["%PDF-1.7\nmalformed synthetic file"], "bad.pdf", { type: "application/pdf" });
    await expect(prepareUploads([image(), malformed], {})).rejects.toMatchObject({ code: "file_rejected", status: 400 });
    expect(state.upload).not.toHaveBeenCalled();
  });
});

describe("generation route upload lifetime", () => {
  it("cleans prepared media when lesson generation fails", async () => {
    state.createLesson.mockRejectedValue(new ClearError("provider_timeout", "Try again shortly.", { status: 504, retryable: true }));
    const response = await POST(uploadRequest(image()));
    expect(response.status).toBe(504);
    expect((await response.json()).error.code).toBe("provider_timeout");
    expect(state.remove).toHaveBeenCalledWith([state.upload.mock.calls[0][0]]);
    expect(state.checkRequestLimits).toHaveBeenCalledWith(expect.any(Request), "upload", { learnerId: "11111111-1111-4111-8111-111111111111" });
  });

  it("keeps media for a saved lesson and surfaces cleanup failures after a failed generation", async () => {
    const response = await POST(uploadRequest(image()));
    expect(response.status).toBe(200);
    expect(state.remove).not.toHaveBeenCalled();
    state.createLesson.mockRejectedValue(new ClearError("provider_timeout", "Try again shortly.", { status: 504 }));
    state.remove.mockResolvedValue({ error: { message: "PRIVATE_CLEANUP_ERROR" } });
    const failed = await POST(uploadRequest(image()));
    expect(failed.status).toBe(503);
    expect((await failed.json()).error.code).toBe("upload_storage_failed");
  });
});
