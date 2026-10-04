import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { SKILL_RESOURCE_PATHS, type SkillFile } from "@/src/lib/skill/generate";

/** A fixed allowlist deliberately excludes uploads, credentials, lessons, and learning records. */
export async function readSkillResources(): Promise<SkillFile[]> {
  const resourceDirectory = path.join(process.cwd(), "skills", "clear-explainer");
  return Promise.all(SKILL_RESOURCE_PATHS.map(async (resourcePath) => ({
    path: resourcePath,
    content: await readFile(path.join(resourceDirectory, resourcePath), "utf8"),
  })));
}
