import "server-only";

import { ClearError } from "@/src/lib/api/errors";
import { currentLearnerId } from "@/src/lib/learning/session";
import { getConversationStore } from "@/src/lib/store";
import type { ConversationRecord } from "@/src/lib/store/types";

export type LessonAccess = { record: ConversationRecord; legacy: boolean };

/** Ownerless records predate private guest lessons: read-only, never auto-claimed. */
export async function getReadableLesson(id: string): Promise<LessonAccess> {
  const record = await getConversationStore().get(id);
  if (!record?.document) throw lessonNotFound();
  if (!record.ownerLearnerId) return { record, legacy: true };
  const learnerId = await currentLearnerId();
  if (!learnerId || record.ownerLearnerId !== learnerId) throw lessonNotFound();
  return { record, legacy: false };
}

export async function getOwnedLesson(id: string): Promise<ConversationRecord> {
  const access = await getReadableLesson(id);
  if (access.legacy) throw lessonNotFound();
  return access.record;
}

/** Omit bearer ownership even when the lesson belongs to the current browser. */
export function clientLesson(record: ConversationRecord): ConversationRecord {
  const copy = { ...record };
  delete copy.ownerLearnerId;
  return copy;
}

function lessonNotFound() {
  return new ClearError("not_found", "That private lesson is not available in this browser.", { status: 404 });
}
