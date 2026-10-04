import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { isUuid } from "@/src/lib/explanation/normalize";
import { deleteLearningProfile, readLearningProfile, writeLearningProfile } from "@/src/lib/learning/store";
import { emptyProfile, type LearningProfile } from "@/src/lib/learning/memory";

const COOKIE = "clear_learner";

export async function currentLearnerId(): Promise<string | undefined> {
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  return value && isUuid(value) ? value : undefined;
}

export async function currentLearningProfile(): Promise<LearningProfile> {
  return readLearningProfile(await currentLearnerId());
}

export async function setLearningEnabled(enabled: boolean): Promise<LearningProfile> {
  const jar = await cookies();
  let id = jar.get(COOKIE)?.value;
  if (!id || !isUuid(id)) {
    id = randomUUID();
    jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 400 });
  }
  const existing = await readLearningProfile(id);
  const profile = { ...existing, enabled };
  await writeLearningProfile(id, profile);
  return profile;
}

export async function eraseLearningMemory(): Promise<void> {
  const id = await currentLearnerId();
  if (!id) return;
  await deleteLearningProfile(id);
  await writeLearningProfile(id, emptyProfile(false));
}
