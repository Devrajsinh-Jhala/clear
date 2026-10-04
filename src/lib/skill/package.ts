import { strToU8, zipSync, type Zippable } from "fflate";

import { assertSkillResources, type SkillFile } from "@/src/lib/skill/generate";

export function createSkillZip(files: SkillFile[]): Uint8Array {
  assertSkillResources(files);
  const entries: Zippable = {};
  for (const file of files) {
    entries[`clear-explainer/${file.path}`] = strToU8(file.content);
  }
  return zipSync(entries, { level: 6 });
}
