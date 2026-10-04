import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: { message: string } | null };

const state = vi.hoisted(() => ({
  results: {} as Record<string, QueryResult>,
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: state.from })),
}));

import { MUTEX_FIXTURE } from "@/src/lib/explanation/fixtures/mutex";
import { createSupabaseStore } from "@/src/lib/store/supabase-store";

const lessonId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const timestamp = "2026-10-04T10:00:00.000Z";

function query(table: string) {
  return {
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    limit() { return this; },
    maybeSingle() { return Promise.resolve(state.results[table]); },
    then<TResult1 = QueryResult, TResult2 = never>(
      fulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(state.results[table]).then(fulfilled, rejected);
    },
  };
}

describe("Supabase lesson reads", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://clear-test.supabase.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-key");
    state.from.mockReset();
    state.from.mockImplementation(query);
    state.results = {
      conversations: {
        data: {
          id: lessonId, guest_owner_id: ownerId, title: MUTEX_FIXTURE.topic,
          active_provider: "sample", active_model: "clear-example", level: "engineer", depth: "balanced",
          created_at: timestamp, updated_at: timestamp,
        },
        error: null,
      },
      messages: {
        data: [{ id: "message", role: "user", content: { text: "Follow up", kind: "follow-up" }, created_at: timestamp }],
        error: null,
      },
      explanation_documents: { data: [{ document: MUTEX_FIXTURE, created_at: timestamp }], error: null },
      attachments: {
        data: [{ id: "upload", mime_type: "application/pdf", storage_path: "private.pdf", size_bytes: 12, metadata: { filename: "notes.pdf", extractedText: "Quoted source" } }],
        error: null,
      },
    };
  });

  afterEach(() => vi.unstubAllEnvs());

  it("reports a missing guest ownership column as a database setup failure instead of a missing lesson", async () => {
    state.results.conversations = { data: null, error: { message: "column conversations.guest_owner_id does not exist" } };
    await expect(createSupabaseStore()!.get(lessonId)).rejects.toMatchObject({ code: "database_not_ready", status: 503 });
    expect(state.from.mock.calls.map(([table]) => table)).toEqual(["conversations"]);
  });

  it.each(["conversations", "messages", "explanation_documents", "attachments"])(
    "propagates %s query failures instead of returning absent or partial teaching data",
    async (table) => {
      state.results[table].error = { message: `Read failed for ${table}` };
      await expect(createSupabaseStore()!.get(lessonId)).rejects.toThrow(`Read failed for ${table}`);
    },
  );

  it("returns null for a valid missing record without requesting its children", async () => {
    state.results.conversations = { data: null, error: null };
    await expect(createSupabaseStore()!.get(lessonId)).resolves.toBeNull();
    expect(state.from.mock.calls.map(([table]) => table)).toEqual(["conversations"]);
  });

  it("preserves ownership and complete lesson content when every query succeeds", async () => {
    const record = await createSupabaseStore()!.get(lessonId);
    expect(record).toMatchObject({
      id: lessonId, ownerLearnerId: ownerId, createdAt: timestamp, updatedAt: timestamp,
      messages: [{ role: "user", content: "Follow up", kind: "follow-up" }],
      document: MUTEX_FIXTURE,
      attachments: [{ filename: "notes.pdf", storageName: "private.pdf", extractedText: "Quoted source" }],
    });
  });
});
