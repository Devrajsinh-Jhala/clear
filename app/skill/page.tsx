import { readFile } from "node:fs/promises";
import path from "node:path";

import { PageShell } from "@/components/page-shell";

export const runtime = "nodejs";

export default async function SkillPage() {
  const skill = await readFile(path.join(process.cwd(), "skills", "clear-explainer", "SKILL.md"), "utf8");
  return (
    <PageShell title="Portable CLEAR" lede="The same explanation behavior can travel as an Agent Skill.">
      <p>A downloadable ZIP of your preferences comes later. This is the base protocol.</p>
      <pre className="overflow-x-auto border border-line bg-card p-4 font-mono text-sm whitespace-pre-wrap">{skill}</pre>
    </PageShell>
  );
}
