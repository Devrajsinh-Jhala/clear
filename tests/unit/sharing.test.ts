import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationRecord, ConversationStore } from "@/src/lib/store/types";
import type { ShareStore } from "@/src/lib/sharing/types";

const state = vi.hoisted(() => ({
  learnerId: undefined as string | undefined,
  conversations: null as ConversationStore | null,
  shares: null as ShareStore | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/learning/session", () => ({
  currentLearnerId: async () => state.learnerId,
  ensureLearnerId: async () => { state.learnerId ??= randomUUID(); return state.learnerId; },
}));
vi.mock("@/src/lib/store", () => ({ getConversationStore: () => state.conversations }));
vi.mock("@/src/lib/sharing/store", () => ({ getShareStore: () => state.shares }));

import { GET, POST, DELETE } from "@/app/api/explanations/[id]/share/route";
import { POST as copy } from "@/app/api/explanations/[id]/copy/route";
import { MUTEX_FIXTURE } from "@/src/lib/explanation/fixtures/mutex";
import { addFollowUp, chooseComparison, createLesson, submitTeachBack } from "@/src/lib/explanation/lessons";
import { createFileShareStore } from "@/src/lib/sharing/file-store";
import { clientLesson, getOwnedLesson, getReadableLesson } from "@/src/lib/sharing/ownership";
import { copyLegacyLesson, getShareStatus, publishShare, readPublicShare, revokeShare } from "@/src/lib/sharing/service";
import { createFileStore } from "@/src/lib/store/file-store";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const lessonId = "33333333-3333-4333-8333-333333333333";
const timestamp = "2026-10-04T10:00:00.000Z";
const context = { params: Promise.resolve({ id: lessonId }) };

function record(owned = true): ConversationRecord {
  const document = structuredClone(MUTEX_FIXTURE);
  document.normalizedQuestion = "PRIVATE_RAW_QUESTION";
  document.audience.assumedKnowledge = ["PRIVATE_LEARNER_ASSUMPTION"];
  document.metadata.provider = "byok:openai";
  document.metadata.model = "private-model";
  document.metadata.tokenUsage = { inputTokens: 9876 };
  return {
    id: lessonId,
    ...(owned ? { ownerLearnerId: owner } : {}),
    title: document.topic,
    createdAt: timestamp,
    updatedAt: timestamp,
    activeProvider: "byok:openai",
    activeModel: "private-model",
    level: "engineer",
    depth: "balanced",
    messages: [{ id: randomUUID(), role: "user", content: "PRIVATE_CHAT_HISTORY", createdAt: timestamp }],
    attachments: [{ id: randomUUID(), filename: "PRIVATE_FILENAME", storageName: "PRIVATE_STORAGE_PATH", extractedText: "PRIVATE_ATTACHMENT_TEXT", mimeType: "application/pdf", sizeBytes: 123 }],
    document,
  };
}

function request(method: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
  return new Request(`https://clear.example/api/explanations/${lessonId}/share`, {
    method,
    headers: { Origin: "https://clear.example", "Content-Type": "application/json", ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("private guest lessons and share snapshots", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "clear-sharing-"));
    state.conversations = createFileStore(path.join(root, "lessons"));
    state.shares = createFileShareStore(path.join(root, "shares"));
    state.learnerId = owner;
    await state.conversations.save(record());
  });

  afterEach(async () => {
    if (!path.resolve(root).startsWith(path.resolve(tmpdir(), "clear-sharing-"))) throw new Error("Unexpected test directory.");
    await rm(root, { recursive: true, force: true });
  });

  it("new sample lessons belong to a random browser identity and omit it from client records", async () => {
    state.learnerId = undefined;
    const created = await createLesson({ exampleId: "mutex", level: "beginner", depth: "quick" });
    expect(created.ownerLearnerId).toBe(state.learnerId);
    expect(created.ownerLearnerId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(getOwnedLesson(created.id)).resolves.toMatchObject({ id: created.id });
    const client = clientLesson(created);
    expect(client).not.toHaveProperty("ownerLearnerId");
    expect(JSON.stringify(client)).not.toContain(created.ownerLearnerId!);
    expect(created.ownerLearnerId).toBeTruthy();
  });

  it("wrong browser, omitted identity, and invalid paths cannot read or mutate private lessons", async () => {
    for (const learnerId of [other, undefined]) {
      state.learnerId = learnerId;
      await expect(getOwnedLesson(lessonId)).rejects.toMatchObject({ status: 404 });
      await expect(getReadableLesson(lessonId)).rejects.toMatchObject({ status: 404 });
      await expect(addFollowUp({ conversationId: lessonId, message: "Change it" })).rejects.toMatchObject({ status: 404 });
      await expect(submitTeachBack({ conversationId: lessonId, explanation: "Review it" })).rejects.toMatchObject({ status: 404 });
      await expect(chooseComparison({ conversationId: lessonId, optionId: "unknown", use: true })).rejects.toMatchObject({ status: 404 });
      await expect(publishShare(lessonId, { showProvider: false })).rejects.toMatchObject({ status: 404 });
      await expect(revokeShare(lessonId)).rejects.toMatchObject({ status: 404 });
    }
    state.learnerId = owner;
    for (const id of ["../package", "", randomUUID()]) await expect(getOwnedLesson(id)).rejects.toMatchObject({ status: 404 });
    expect((await state.conversations!.get(lessonId))?.messages).toHaveLength(1);
  });

  it("legacy records stay read-only and are never automatically claimed", async () => {
    await state.conversations!.save(record(false));
    state.learnerId = undefined;
    await expect(getReadableLesson(lessonId)).resolves.toMatchObject({ legacy: true });
    expect(state.learnerId).toBeUndefined();
    await expect(getOwnedLesson(lessonId)).rejects.toMatchObject({ status: 404 });
    await expect(publishShare(lessonId, { showProvider: false })).rejects.toMatchObject({ status: 404 });
    expect((await state.conversations!.get(lessonId))?.ownerLearnerId).toBeUndefined();
  });

  it("legacy copies preserve teaching content but exclude all old history, attachments, and provider linkage", async () => {
    await state.conversations!.save(record(false));
    state.learnerId = undefined;
    const copied = await copyLegacyLesson(lessonId);
    expect(copied.id).not.toBe(lessonId);
    expect(copied.ownerLearnerId).toBe(state.learnerId);
    expect(copied.messages).toEqual([]);
    expect(copied.attachments).toBeUndefined();
    expect(copied.activeProvider).toBe("clear-free");
    expect(copied.document?.essence).toBe(MUTEX_FIXTURE.essence);
    expect(copied.document?.metadata.provider).toBe("clear-copy");
    expect(JSON.stringify(copied)).not.toMatch(/PRIVATE_|private-model|byok:openai|9876/);
    expect((await state.conversations!.get(lessonId))?.ownerLearnerId).toBeUndefined();
    await expect(copyLegacyLesson(copied.id)).rejects.toMatchObject({ status: 400 });
  });

  it("publishes an explicit frozen allowlisted snapshot, with provider hidden by default", async () => {
    await expect(getShareStatus(lessonId)).resolves.toEqual({ active: false, stale: false });
    const shared = await publishShare(lessonId, { showProvider: false });
    expect(shared.path).toMatch(/^\/shared\/[A-Za-z0-9_-]{32}$/);
    const slug = shared.path!.split("/").at(-1)!;
    const publicPayload = await readPublicShare(slug);
    expect(Object.keys(publicPayload!).sort()).toEqual(["document", "sharedAt"]);
    expect(publicPayload?.document.metadata.provider).toBe("hidden");
    expect(JSON.stringify(publicPayload)).not.toMatch(/PRIVATE_|private-model|byok:openai|9876|ownerLearnerId|conversationId/);
    const changed = record();
    changed.updatedAt = "2026-10-04T10:01:00.000Z";
    changed.document!.essence = "The owner revised this lesson.";
    await state.conversations!.save(changed);
    expect((await readPublicShare(slug))?.document.essence).toBe(MUTEX_FIXTURE.essence);
    await expect(getShareStatus(lessonId)).resolves.toMatchObject({ active: true, stale: true, sourceUpdatedAt: timestamp });
  });

  it("replacement and revocation immediately remove access through older slugs", async () => {
    const first = await publishShare(lessonId, { showProvider: false });
    const second = await publishShare(lessonId, { showProvider: true });
    const firstSlug = first.path!.split("/").at(-1)!;
    const secondSlug = second.path!.split("/").at(-1)!;
    expect(firstSlug).not.toBe(secondSlug);
    await expect(readPublicShare(firstSlug)).resolves.toBeNull();
    expect((await readPublicShare(secondSlug))?.document.metadata.provider).toBe("byok:openai");
    expect((await readPublicShare(secondSlug))?.document.metadata.tokenUsage).toBeUndefined();
    await expect(revokeShare(lessonId)).resolves.toEqual({ active: false, stale: false });
    await expect(readPublicShare(secondSlug)).resolves.toBeNull();
    await expect(getShareStatus(lessonId)).resolves.toEqual({ active: false, stale: false });
    await expect(revokeShare(lessonId)).resolves.toEqual({ active: false, stale: false });
  });

  it("concurrent publication leaves exactly one tracked active link and a single state file", async () => {
    const statuses = await Promise.all(Array.from({ length: 8 }, () => publishShare(lessonId, { showProvider: false })));
    const payloads = await Promise.all(statuses.map((status) => readPublicShare(status.path!.split("/").at(-1)!)));
    expect(payloads.filter(Boolean)).toHaveLength(1);
    expect((await readdir(path.join(root, "shares"))).filter((name) => name.endsWith(".json"))).toEqual([`${lessonId}.json`]);
    await revokeShare(lessonId);
    for (const status of statuses) await expect(readPublicShare(status.path!.split("/").at(-1)!)).resolves.toBeNull();
    for (const slug of ["../package", lessonId, "bad", "a".repeat(33)]) await expect(readPublicShare(slug)).resolves.toBeNull();
  });

  it("share APIs reject missing/cross/protocol origins and unknown private fields, with no-store errors", async () => {
    const rejectedHeaders: Record<string, string>[] = [{ Origin: "" }, { Origin: "https://evil.example" }, { Origin: "http://clear.example" }, { "Sec-Fetch-Site": "cross-site" }];
    for (const headers of rejectedHeaders) {
      const response = await POST(request("POST", { showProvider: false }, headers), context);
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    for (const body of [{ showProvider: "false" }, { showProvider: false, ownerLearnerId: owner }, {}, { showProvider: false, document: MUTEX_FIXTURE }]) {
      expect((await POST(request("POST", body), context)).status).toBe(body && JSON.stringify(body).length > 256 ? 413 : 400);
    }
    const successful = await POST(request("POST", { showProvider: false }), context);
    expect(successful.status).toBe(200);
    const payload = await successful.json();
    expect(payload.share.active).toBe(true);
    expect(successful.headers.get("vary")).toBe("Cookie");
    expect((await GET(request("GET"), context)).status).toBe(200);
    state.learnerId = other;
    for (const response of [await GET(request("GET"), context), await POST(request("POST", { showProvider: false }), context), await DELETE(request("DELETE"), context)]) {
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
  });

  it("copy API emits only the new private address and refuses unrelated browser access", async () => {
    state.learnerId = other;
    expect((await copy(request("POST"), context)).status).toBe(404);
    await state.conversations!.save(record(false));
    const response = await copy(request("POST"), context);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(Object.keys(payload)).toEqual(["conversationId"]);
    await expect(getOwnedLesson(payload.conversationId)).resolves.toMatchObject({ ownerLearnerId: other });
    expect((await copy(request("POST", undefined, { Origin: "https://evil.example" }), context)).status).toBe(403);
  });

  it("validates the browser's public origin behind a reverse proxy and rejects forwarding chains", async () => {
    const proxyRequest = (headers: Record<string, string> = {}) => new Request(`http://localhost:3000/api/explanations/${lessonId}/share`, {
      method: "POST",
      headers: {
        Origin: "https://clear.example",
        Host: "clear.example",
        "X-Forwarded-Host": "clear.example",
        "X-Forwarded-Proto": "https",
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ showProvider: false }),
    });
    expect((await POST(proxyRequest(), context)).status).toBe(200);
    expect((await POST(proxyRequest({ Host: "localhost:3000" }), context)).status).toBe(200);
    for (const headers of [
      { "X-Forwarded-Host": "clear.example, localhost:3000" },
      { "X-Forwarded-Proto": "https, http" },
      { "X-Forwarded-Host": "evil.example" },
      { "X-Forwarded-Proto": "http" },
      { Origin: "https://user:password@clear.example" },
      { Origin: "https://clear.example/path" },
      { "X-Forwarded-Host": "clear.example/path" },
    ] as Record<string, string>[]) {
      expect((await POST(proxyRequest(headers), context)).status).toBe(403);
    }
    const hostOnlyRequest = new Request(`http://localhost:3000/api/explanations/${lessonId}/share`, {
      method: "DELETE",
      headers: { Origin: "https://clear.example", Host: "clear.example", "X-Forwarded-Proto": "https" },
    });
    expect((await DELETE(hostOnlyRequest, context)).status).toBe(200);
  });
});
