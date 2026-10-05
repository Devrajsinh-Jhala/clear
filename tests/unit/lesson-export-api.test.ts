// These isolated feature tests exercise the handler; admission has its own integration tests.
vi.mock("@/src/lib/api/guard", () => ({ withApiGuard: async (_request: Request, _action: string, handler: () => Promise<Response>) => handler() }));
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/sharing/ownership", () => ({ getOwnedLesson: vi.fn() }));
vi.mock("@/src/lib/sharing/service", () => ({ readPublicShare: vi.fn() }));
vi.mock("@/src/lib/export/pdf", () => ({ exportLessonPdf: vi.fn(async () => new TextEncoder().encode("%PDF-test")) }));

import { GET as privateExport } from "@/app/api/explanations/[id]/export/route";
import { GET as publicExport } from "@/app/api/shared/[shareId]/export/route";
import { ClearError } from "@/src/lib/api/errors";
import { MUTEX_FIXTURE } from "@/src/lib/explanation/fixtures/mutex";
import { explanationDocumentSchema } from "@/src/lib/explanation/schema";
import { projectExplanation } from "@/src/lib/export/document";
import { exportLessonPdf } from "@/src/lib/export/pdf";
import { getOwnedLesson } from "@/src/lib/sharing/ownership";
import { readPublicShare } from "@/src/lib/sharing/service";
import type { ConversationRecord } from "@/src/lib/store/types";

const id = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const shareId = "A".repeat(32);
const timestamp = "2026-10-04T12:00:00.000Z";
const privateContext = { params: Promise.resolve({ id }) };
const publicContext = { params: Promise.resolve({ shareId }) };

function record(): ConversationRecord {
  const document = structuredClone(MUTEX_FIXTURE);
  document.id = id;
  document.normalizedQuestion = "PRIVATE-QUESTION";
  document.audience.assumedKnowledge = ["PRIVATE-LEARNING-PROFILE"];
  Object.assign(document.metadata, { apiKey: "PRIVATE-KEY", tokenUsage: { inputTokens: 10 } });
  Object.assign(document, { uploadedDocuments: ["PRIVATE-UPLOAD"] });
  return {
    id, ownerLearnerId: ownerId, title: document.topic, document,
    activeProvider: "sample", activeModel: "clear-example", level: "engineer", depth: "balanced",
    createdAt: timestamp, updatedAt: timestamp,
    messages: [{ id: "message", role: "user", content: "PRIVATE-CONVERSATION", createdAt: timestamp }],
    attachments: [{ id: "upload", filename: "PRIVATE-FILENAME", mimeType: "application/pdf", sizeBytes: 1, storageName: "PRIVATE-STORAGE-PATH", extractedText: "PRIVATE-UPLOAD" }],
  };
}

function privateRequest(format: string, extra = "") {
  return new Request(`https://clear.example/api/explanations/${id}/export?format=${format}${extra}`);
}

describe("lesson download boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exports only canonical teaching content, with model disclosure off by default", async () => {
    vi.mocked(getOwnedLesson).mockResolvedValue(record());
    const response = await privateExport(privateRequest("json"), privateContext);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="[a-z0-9-]+\.json"$/);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const text = await response.text();
    expect(text).not.toMatch(/PRIVATE-|ownerLearnerId|tokenUsage|latencyMs/);
    expect(text).not.toContain(ownerId);
    expect(text).not.toContain(id);
    const document = explanationDocumentSchema.parse(JSON.parse(text));
    expect(document.normalizedQuestion).toBe(document.topic);
    expect(document.metadata.provider).toBe("hidden");
    expect(document.metadata.model).toBe("hidden");
    const disclosed = await privateExport(privateRequest("json", "&includeProvider=true"), privateContext);
    expect((await disclosed.json()).metadata.provider).toBe("sample");
  });

  it("requires owner access for every private format and does not generate unauthorized PDFs", async () => {
    vi.mocked(getOwnedLesson).mockRejectedValue(new ClearError("not_found", "That private lesson is unavailable.", { status: 404 }));
    for (const format of ["markdown", "json", "pdf"]) {
      const response = await privateExport(privateRequest(format), privateContext);
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("content-disposition")).toBeNull();
    }
    expect(exportLessonPdf).not.toHaveBeenCalled();
  });

  it("serves the public snapshot and keeps its identity choice and publication date", async () => {
    const document = projectExplanation(MUTEX_FIXTURE, { exportedAt: timestamp });
    vi.mocked(readPublicShare).mockResolvedValue({ document, sharedAt: timestamp });
    const response = await publicExport(new Request(`https://clear.example/api/shared/${shareId}/export?format=json&includeProvider=true`), publicContext);
    const exported = await response.json();
    expect(response.status).toBe(200);
    expect(exported).toEqual(document);
    expect(exported.metadata.provider).toBe("hidden");
    expect(exported.metadata.generatedAt).toBe(timestamp);
    expect(getOwnedLesson).not.toHaveBeenCalled();
    const pdf = await publicExport(new Request(`https://clear.example/api/shared/${shareId}/export?format=pdf`), publicContext);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(exportLessonPdf).toHaveBeenCalledWith(document, { includeProvider: true, exportedAt: timestamp });
    const markdown = await publicExport(new Request(`https://clear.example/api/shared/${shareId}/export?format=markdown`), publicContext);
    expect(markdown.headers.get("content-type")).toContain("text/markdown");
    expect(await markdown.text()).toContain(MUTEX_FIXTURE.essence);
  });

  it("returns no snapshot or file for revoked, replaced, or unknown public links", async () => {
    vi.mocked(readPublicShare).mockResolvedValue(null);
    for (const format of ["markdown", "json", "pdf"]) {
      const response = await publicExport(new Request(`https://clear.example/api/shared/${shareId}/export?format=${format}`), publicContext);
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("content-disposition")).toBeNull();
    }
    expect(exportLessonPdf).not.toHaveBeenCalled();
  });

  it("rejects invalid choices and keeps storage or PDF failures out of error responses", async () => {
    expect((await privateExport(privateRequest("html"), privateContext)).status).toBe(400);
    expect((await privateExport(privateRequest("json", "&includeProvider=maybe"), privateContext)).status).toBe(400);
    expect(getOwnedLesson).not.toHaveBeenCalled();
    vi.mocked(getOwnedLesson).mockRejectedValue(new Error("PRIVATE-SERVER-PATH"));
    const response = await privateExport(privateRequest("pdf"), privateContext);
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const error = await response.json();
    expect(error.error.retryable).toBe(true);
    expect(JSON.stringify(error)).not.toContain("PRIVATE-SERVER-PATH");
  });
});
