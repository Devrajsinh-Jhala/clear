import "server-only";

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { isUuid } from "@/src/lib/explanation/normalize";
import { emptyProfile, type LearningProfile } from "@/src/lib/learning/memory";

const root = path.join(process.cwd(), ".data", "learning");

export async function readLearningProfile(id: string | undefined): Promise<LearningProfile> {
  if (!id || !isUuid(id)) return emptyProfile(false);
  try {
    const text = await readFile(path.join(root, `${id}.json`), "utf8");
    const parsed = JSON.parse(text) as LearningProfile;
    if (!parsed || !Array.isArray(parsed.concepts) || !Array.isArray(parsed.misconceptions)) {
      return emptyProfile(false);
    }
    return parsed;
  } catch {
    return emptyProfile(false);
  }
}

export async function writeLearningProfile(id: string, profile: LearningProfile): Promise<void> {
  if (!isUuid(id)) throw new Error("Refusing to store learning memory with an invalid id.");
  await mkdir(root, { recursive: true });
  const destination = path.join(root, `${id}.json`);
  const temporary = path.join(root, `${id}.${process.pid}.tmp`);
  await writeFile(temporary, JSON.stringify(profile), "utf8");
  await rename(temporary, destination);
}

export async function deleteLearningProfile(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await rm(path.join(root, `${id}.json`), { force: true });
}
