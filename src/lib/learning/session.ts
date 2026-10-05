import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { currentAccount } from "@/src/lib/auth/session";
import { accountLearnerId } from "@/src/lib/learning/identity";

import { isUuid } from "@/src/lib/explanation/normalize";
import { deleteLearningProfile, readLearningProfile, writeLearningProfile } from "@/src/lib/learning/store";
import { emptyProfile, type LearningProfile } from "@/src/lib/learning/memory";

const COOKIE = "clear_learner";

export async function currentLearnerId(): Promise<string | undefined> {
  const account = await currentAccount();
  if (account) return accountLearnerId(account.id);
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  return value && isUuid(value) ? value : undefined;
}

export async function ensureLearnerId(): Promise<string> {
  const account = await currentAccount();
  if (account) return accountLearnerId(account.id);
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && isUuid(existing)) return existing;
  const id = randomUUID();
  jar.set(COOKIE, id, cookieOptions());
  return id;
}

export async function currentLearningProfile(): Promise<LearningProfile> {
  return readLearningProfile(await currentLearnerId());
}

export async function setLearningEnabled(enabled: boolean): Promise<LearningProfile> {
  const id = await ensureLearnerId();
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

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  };
}
