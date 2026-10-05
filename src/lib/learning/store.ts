import "server-only";

import { isUuid } from "@/src/lib/explanation/normalize";
import { emptyProfile, type LearningProfile } from "@/src/lib/learning/memory";
import { deletePrivateState, readPrivateState, writePrivateState } from "@/src/lib/storage/state";

export async function readLearningProfile(id: string | undefined): Promise<LearningProfile> {
  if (!id || !isUuid(id)) return emptyProfile(false);
  const parsed = await readPrivateState<LearningProfile>("learning", id);
  if (!parsed) return emptyProfile(false);
  if (!Array.isArray(parsed.concepts) || !Array.isArray(parsed.misconceptions)) throw new Error("The stored learning profile is invalid.");
  return parsed;
}

export async function writeLearningProfile(id: string, profile: LearningProfile): Promise<void> {
  if (!isUuid(id)) throw new Error("Refusing to store learning memory with an invalid id.");
  await writePrivateState("learning", id, profile);
}

export async function deleteLearningProfile(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await deletePrivateState("learning", id);
}
