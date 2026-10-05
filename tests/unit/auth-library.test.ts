import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ account: vi.fn(), client: vi.fn(), admin: vi.fn(), rpc: vi.fn(), cleanupUploads: vi.fn(), deleteState: vi.fn(), report: vi.fn(), flush: vi.fn() }));
vi.mock("@/src/lib/auth/session", () => ({ requireAccount: mocks.account }));
vi.mock("@/src/lib/auth/server", () => ({ createAuthClient: mocks.client }));
vi.mock("@/src/lib/storage/admin", () => ({ storageAdmin: mocks.admin }));
vi.mock("@/src/lib/storage/state", () => ({ deletePrivateState: mocks.deleteState }));
vi.mock("@/src/lib/uploads/prepare", () => ({ cleanupPreparedUploads: mocks.cleanupUploads }));
vi.mock("@/src/lib/monitoring/server", () => ({ reportServerError: mocks.report, flushMonitoring: mocks.flush }));

import { deleteAccountLesson, listAccountLessons, updateAccountLesson } from "@/src/lib/auth/library";

const USER = "550e8400-e29b-41d4-a716-446655440000";
const LESSON = "550e8400-e29b-41d4-a716-446655440001";
const OTHER_USER = "550e8400-e29b-41d4-a716-446655440002";
const JOBS = "clear_lesson_cleanup_jobs";
const JOB = { conversation_id: LESSON, owner_user_id: USER, storage_names: [`${LESSON}.pdf`] };
type Result = { data: unknown; error: unknown };
const results = new Map<string, Result[]>();
const calls: Array<{ table: string; operation: string; args: unknown[] }> = [];

function query(table: string) {
  const chain: Record<string, unknown> = {};
  for (const operation of ["select", "eq", "order", "limit", "update", "upsert", "delete"]) {
    chain[operation] = (...args: unknown[]) => { calls.push({ table, operation, args }); return chain; };
  }
  chain.maybeSingle = () => Promise.resolve(results.get(table)?.shift() ?? { data: null, error: null });
  chain.then = (resolve: (value: Result) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(results.get(table)?.shift() ?? { data: [], error: null }).then(resolve, reject);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  results.clear();
  calls.length = 0;
  mocks.account.mockResolvedValue({ id: USER, email: "synthetic@example.test" });
  mocks.client.mockResolvedValue({ from: query });
  mocks.admin.mockReturnValue({ from: query, rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.cleanupUploads.mockResolvedValue(undefined);
  mocks.deleteState.mockResolvedValue(undefined);
  mocks.flush.mockResolvedValue(undefined);
});

describe("account library ownership", () => {
  it("lists only the verified account's title/model metadata and favorites", async () => {
    results.set("conversations", [{ data: [{ id: LESSON, title: "Synthetic saved lesson", active_provider: "sample", active_model: "clear-example", updated_at: "2026-10-05T00:00:00Z", archived_at: null }], error: null }]);
    results.set("saved_lessons", [{ data: [{ conversation_id: LESSON }], error: null }]);
    expect(await listAccountLessons()).toEqual([{ id: LESSON, title: "Synthetic saved lesson", provider: "sample", model: "clear-example", updatedAt: "2026-10-05T00:00:00Z", archived: false, favorite: true }]);
    for (const table of ["conversations", "saved_lessons"]) expect(calls).toContainEqual({ table, operation: "eq", args: ["user_id", USER] });
    expect(calls).toContainEqual({ table: "conversations", operation: "limit", args: [100] });
  });
  it("stops before database access when no verified account exists", async () => {
    mocks.account.mockRejectedValue(new Error("Sign in required"));
    await expect(listAccountLessons()).rejects.toThrow("Sign in required");
    await expect(deleteAccountLesson(LESSON)).rejects.toThrow("Sign in required");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses favorites, rename, archive and deletion of a foreign lesson", async () => {
    for (const change of [{ action: "favorite", favorite: true } as const, { action: "rename", title: "Other title" } as const, { action: "archive", archived: true } as const]) {
      results.set("conversations", [{ data: null, error: null }]);
      await expect(updateAccountLesson(LESSON, change)).rejects.toMatchObject({ status: 404 });
    }
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(deleteAccountLesson(LESSON)).rejects.toMatchObject({ status: 404 });
    expect(mocks.rpc).toHaveBeenCalledWith("clear_delete_account_lesson", { p_conversation_id: LESSON, p_owner_user_id: USER });
    expect(mocks.cleanupUploads).not.toHaveBeenCalled();
    expect(mocks.deleteState).not.toHaveBeenCalled();
    expect(calls.filter((call) => ["delete", "upsert", "update"].includes(call.operation))).toEqual([]);
  });
  it("waits for the committed parent/outbox transaction before removing media, then acknowledges last", async () => {
    let commit!: (result: Result) => void;
    mocks.rpc.mockImplementation(() => new Promise<Result>((resolve) => { commit = resolve; }));
    results.set(JOBS, [{ data: JOB, error: null }, { data: [], error: null }]);
    const deletion = deleteAccountLesson(LESSON);
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalled());
    expect(mocks.cleanupUploads).not.toHaveBeenCalled();
    expect(mocks.deleteState).not.toHaveBeenCalled();
    commit({ data: true, error: null });
    expect(await deletion).toEqual({ deleted: true, cleanupPending: false });
    expect(mocks.cleanupUploads).toHaveBeenCalledWith([{ storageName: `${LESSON}.pdf` }]);
    expect(mocks.deleteState).toHaveBeenCalledWith("lesson-meta", LESSON);
    expect(mocks.cleanupUploads.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteState.mock.invocationCallOrder[0]);
    expect(calls).toContainEqual({ table: JOBS, operation: "delete", args: [] });
    expect(calls.filter((call) => call.operation === "delete").map((call) => call.table)).toEqual([JOBS]);
    expect(calls.filter((call) => call.table === JOBS && call.operation === "eq" && call.args[0] === "owner_user_id")).toHaveLength(2);
    expect(mocks.rpc).toHaveBeenCalledWith("clear_delete_account_lesson", { p_conversation_id: LESSON, p_owner_user_id: USER });
  });
  it("never removes originals or metadata when the database deletion rolls back", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "PRIVATE_SQL_DETAIL" } });
    await expect(deleteAccountLesson(LESSON)).rejects.toMatchObject({ status: 503, message: "Your library could not be reached. Please try again shortly." });
    expect(mocks.cleanupUploads).not.toHaveBeenCalled();
    expect(mocks.deleteState).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
  it.each([
    { ...JOB, storage_names: ["../another-user/private.pdf"] },
    { ...JOB, owner_user_id: OTHER_USER },
  ])("preserves malformed or foreign cleanup jobs without exposing their private paths", async (job) => {
    results.set(JOBS, [{ data: job, error: null }]);
    const response = await deleteAccountLesson(LESSON);
    expect(response).toEqual({ deleted: true, cleanupPending: true });
    expect(JSON.stringify(response)).not.toContain("storage_names");
    expect(mocks.cleanupUploads).not.toHaveBeenCalled();
    expect(mocks.deleteState).not.toHaveBeenCalled();
    expect(calls.filter((call) => call.operation === "delete")).toEqual([]);
    expect(mocks.flush).toHaveBeenCalledTimes(1);
  });
  it("retains the cleanup job after partial media failure, then retries it even though the parent is gone", async () => {
    results.set(JOBS, [{ data: JOB, error: null }, { data: JOB, error: null }, { data: [], error: null }]);
    mocks.cleanupUploads.mockRejectedValueOnce(new Error("PRIVATE_OBJECT_FAILURE"));
    expect(await deleteAccountLesson(LESSON)).toEqual({ deleted: true, cleanupPending: true });
    expect(mocks.deleteState).not.toHaveBeenCalled();
    expect(calls.filter((call) => call.operation === "delete")).toEqual([]);
    expect(await deleteAccountLesson(LESSON)).toEqual({ deleted: true, cleanupPending: false });
    expect(mocks.cleanupUploads).toHaveBeenCalledTimes(2);
    expect(mocks.deleteState).toHaveBeenCalledTimes(1);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(calls.some((call) => call.table === "conversations")).toBe(false);
  });
  it("retains the job when lesson metadata or job acknowledgement fails", async () => {
    results.set(JOBS, [{ data: JOB, error: null }, { data: JOB, error: null }, { data: null, error: { message: "PRIVATE_ACK_DETAIL" } }, { data: JOB, error: null }, { data: [], error: null }]);
    mocks.deleteState.mockRejectedValueOnce(new Error("PRIVATE_META_FAILURE"));
    expect(await deleteAccountLesson(LESSON)).toEqual({ deleted: true, cleanupPending: true });
    expect(calls.filter((call) => call.operation === "delete")).toEqual([]);
    expect(await deleteAccountLesson(LESSON)).toEqual({ deleted: true, cleanupPending: true });
    expect(await deleteAccountLesson(LESSON)).toEqual({ deleted: true, cleanupPending: false });
    expect(mocks.cleanupUploads).toHaveBeenCalledTimes(3);
  });
  it("truthfully reports committed deletion with pending cleanup if the outbox cannot be read", async () => {
    results.set(JOBS, [{ data: null, error: { message: "PRIVATE_OUTBOX_DETAIL" } }]);
    expect(await deleteAccountLesson(LESSON)).toEqual({ deleted: true, cleanupPending: true });
    expect(mocks.cleanupUploads).not.toHaveBeenCalled();
    expect(mocks.deleteState).not.toHaveBeenCalled();
  });
  it("accepts a missing job after another worker has already completed cleanup", async () => {
    results.set(JOBS, [{ data: null, error: null }]);
    expect(await deleteAccountLesson(LESSON)).toEqual({ deleted: true, cleanupPending: false });
    expect(mocks.cleanupUploads).not.toHaveBeenCalled();
  });
  it("retries at most five pending jobs from the verified account on library load", async () => {
    const jobs = Array.from({ length: 6 }, (_, index) => ({ ...JOB, conversation_id: `550e8400-e29b-41d4-a716-44665544000${index + 3}` }));
    results.set(JOBS, [{ data: jobs, error: null }]);
    expect(await listAccountLessons()).toEqual([]);
    expect(mocks.cleanupUploads).toHaveBeenCalledTimes(5);
    expect(mocks.deleteState).toHaveBeenCalledTimes(5);
    expect(calls).toContainEqual({ table: JOBS, operation: "eq", args: ["owner_user_id", USER] });
    expect(calls).toContainEqual({ table: JOBS, operation: "limit", args: [5] });
  });
  it("continues loading the library when queued cleanup fails", async () => {
    results.set(JOBS, [{ data: [JOB], error: null }]);
    mocks.cleanupUploads.mockRejectedValue(new Error("PRIVATE_OBJECT_FAILURE"));
    expect(await listAccountLessons()).toEqual([]);
    expect(calls.filter((call) => call.operation === "delete")).toEqual([]);
    expect(mocks.report).toHaveBeenCalledWith(expect.any(Error), { operation: "storage", code: "storage_unavailable" });
    expect(mocks.flush).toHaveBeenCalledTimes(1);
  });
  it("surfaces database read failures without showing an empty successful library", async () => {
    results.set("conversations", [{ data: null, error: { message: "PRIVATE_SQL_DETAIL" } }]);
    await expect(listAccountLessons()).rejects.toMatchObject({ status: 503, message: "Your library could not be reached. Please try again shortly." });
  });
});
