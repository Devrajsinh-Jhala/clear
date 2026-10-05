import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ owned: vi.fn(), save: vi.fn(), review: vi.fn(), identity: vi.fn(), read: vi.fn(), write: vi.fn(), report: vi.fn(), flush: vi.fn() }));
vi.mock("@/src/lib/store", () => ({ getConversationStore: () => ({ save: mocks.save }) }));
vi.mock("@/src/lib/sharing/ownership", () => ({ getOwnedLesson: mocks.owned }));
vi.mock("@/src/lib/explanation/review-teach-back", () => ({ reviewTeachBack: mocks.review }));
vi.mock("@/src/lib/learning/session", () => ({ currentLearnerId: mocks.identity, ensureLearnerId: mocks.identity }));
vi.mock("@/src/lib/learning/store", () => ({ readLearningProfile: mocks.read, writeLearningProfile: mocks.write }));
vi.mock("@/src/lib/monitoring/server", () => ({ reportServerError: mocks.report, flushMonitoring: mocks.flush }));

import { ClearError } from "@/src/lib/api/errors";
import { submitTeachBack } from "@/src/lib/explanation/lessons";
import { MUTEX_FIXTURE } from "@/src/lib/explanation/fixtures/mutex";
import type { ConversationRecord } from "@/src/lib/store/types";

const owner = "22222222-2222-4222-8222-222222222222";
const id = "11111111-1111-4111-8111-111111111111";
const revision = "2026-10-05T12:00:00.123456+00:00";
let lesson: ConversationRecord;
beforeEach(() => {
  vi.clearAllMocks();
  lesson = { id, ownerLearnerId: owner, title: MUTEX_FIXTURE.topic, document: MUTEX_FIXTURE, activeProvider: "sample", activeModel: "fixture", level: "engineer", depth: "balanced", createdAt: revision, updatedAt: revision, messages: [] };
  mocks.owned.mockResolvedValue(lesson);
  mocks.save.mockResolvedValue(undefined);
  mocks.identity.mockResolvedValue(owner);
  mocks.read.mockResolvedValue({ enabled: true, concepts: [], misconceptions: [] });
  mocks.write.mockResolvedValue(undefined);
  mocks.flush.mockResolvedValue(undefined);
  mocks.review.mockResolvedValue({ verdict: "incorrect", headline: "This part is slightly incorrect", source: "model", missingConcepts: [], misleadingStatements: ["Different locks coordinate shared state."], repairedExplanation: "Use the same mutex around the whole update." });
});

describe("teach-back persistence ordering", () => {
  it("leaves learning memory and the existing conversation untouched when the revision conflicts", async () => {
    mocks.save.mockRejectedValue(new ClearError("lesson_changed", "Reload this lesson.", { status: 409 }));
    await expect(submitTeachBack({ conversationId: id, explanation: "Different locks coordinate shared state." })).rejects.toMatchObject({ code: "lesson_changed", status: 409 });
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
    expect(lesson.messages).toEqual([]);
  });

  it("commits the lesson with its exact revision before remembering an accepted misconception", async () => {
    const { record, result } = await submitTeachBack({ conversationId: id, explanation: "Different locks coordinate shared state." });
    expect(mocks.save).toHaveBeenCalledWith(record, revision);
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(mocks.read.mock.invocationCallOrder[0]);
    expect(record.messages).toHaveLength(2);
    expect(mocks.write).toHaveBeenCalledWith(owner, expect.objectContaining({ misconceptions: [expect.objectContaining({ statement: "Different locks coordinate shared state.", correction: result.repairedExplanation, status: "open" })] }));
  });

  it("keeps opted-out learning memory unchanged after a successful lesson save", async () => {
    mocks.read.mockResolvedValue({ enabled: false, concepts: [], misconceptions: [] });
    await submitTeachBack({ conversationId: id, explanation: "A study attempt." });
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it("retains saved feedback and reports a private, readable warning if memory storage fails", async () => {
    mocks.write.mockRejectedValue(new Error("PRIVATE_STORAGE_DETAIL"));
    const { record, result } = await submitTeachBack({ conversationId: id, explanation: "A study attempt." });
    expect(record.messages).toHaveLength(2);
    expect(result.memoryWarning).toContain("Your feedback was saved");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_STORAGE_DETAIL");
    expect(mocks.report).toHaveBeenCalledWith(expect.any(Error), { operation: "storage", code: "storage_unavailable" });
    expect(mocks.flush).toHaveBeenCalledOnce();
  });
});
