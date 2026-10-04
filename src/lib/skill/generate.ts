import { skillPreferencesSchema, type SkillPreferences } from "@/src/lib/skill/preferences";

export type SkillFile = { path: string; content: string };

export const SKILL_RESOURCE_PATHS = [
  "SKILL.md",
  "references/clear-protocol.md",
  "references/explanation-patterns.md",
  "references/safety-and-accuracy.md",
  "examples/software.md",
  "examples/mathematics.md",
  "examples/science.md",
] as const;

const LEVEL_INSTRUCTIONS: Record<SkillPreferences["level"], string> = {
  beginner: "Assume no specialist background. Start from familiar ideas and define each prerequisite before using it.",
  student: "Build on classroom fundamentals. Connect each new concept to its prerequisites and include a worked problem.",
  engineer: "Assume practical technical experience. Explain implementation choices, constraints, failure cases, and tradeoffs.",
  researcher: "Assume domain fluency while checking unfamiliar prerequisites. State assumptions, formal limits, evidence, and open questions.",
  interview: "Assume the learner is preparing to explain technical ideas aloud. Connect a concise account of the mechanism to a worked example and its limits.",
};

const DEPTH_INSTRUCTIONS: Record<SkillPreferences["depth"], string> = {
  quick: "Give the essence, one small concrete example, and the most important caveat. Offer deeper detail instead of expanding every section.",
  balanced: "Explain the essence and mechanism, give a worked example, and address the most likely misconception. Add other representations when they help.",
  deep: "Develop the mechanism step by step. Include prerequisites, a worked example, edge cases, relevant formal detail, and limitations.",
};

/** Only public, checked-in protocol resources belong in a portable skill. */
export function assertSkillResources(resources: SkillFile[]): void {
  const allowed = new Set<string>(SKILL_RESOURCE_PATHS);
  const seen = new Set<string>();
  if (resources.length !== SKILL_RESOURCE_PATHS.length) {
    throw new Error("The skill package must contain exactly seven protocol and example files.");
  }
  for (const resource of resources) {
    if (!allowed.has(resource.path) || seen.has(resource.path) || typeof resource.content !== "string") {
      throw new Error("The skill package contains an unexpected or duplicate resource.");
    }
    seen.add(resource.path);
  }
}

/** Shared by the preview and download; no user records or server state are read here. */
export function buildSkillFiles(preferences: SkillPreferences, resources: SkillFile[]): SkillFile[] {
  const selected = skillPreferencesSchema.parse(preferences);
  assertSkillResources(resources);

  const instructions = [
    "## Learner preferences",
    "",
    "Apply these defaults when the learner has not given a more specific instruction in the current conversation. Keep accuracy and necessary safety guidance at every depth.",
    "",
    `- Learner level: ${selected.level}. ${LEVEL_INSTRUCTIONS[selected.level]}`,
    `- Preferred depth: ${selected.depth}. ${DEPTH_INSTRUCTIONS[selected.depth]}`,
    selected.analogies === "avoid"
      ? "- Analogies: avoid analogies and metaphors. Explain the real mechanism with literal language and concrete examples."
      : "- Analogies: use one only when it clarifies the mechanism. Label it as an analogy, map its parts to the real concept, and state where it breaks down.",
    selected.visuals === "text-only"
      ? "- Visuals: use text only. Describe structure, flow, and state changes in words or numbered steps instead of diagrams or image prompts."
      : "- Visuals: use an accessible diagram when structure, flow, or relationships matter and the host supports it. Always include a text equivalent; fall back to words when rendering is unavailable.",
    selected.interviewMode
      ? "- Interview mode: on. Include a short spoken answer, then one likely interviewer follow-up and its reasoning. Coach the explanation without claiming to predict interview outcomes."
      : "- Interview mode: off. Teach for understanding without adding interview drills unless the learner asks for them.",
    selected.quiz
      ? "- Recall checks: offer one or two focused questions after teaching. Let the learner attempt them before revealing answers, then repair any misconception."
      : "- Recall checks: do not add unsolicited quizzes or ask the learner to answer a comprehension question. Use an explained verification example instead; provide a quiz when explicitly requested.",
    selected.verbosity === "concise"
      ? "- Verbosity: concise. Use short paragraphs and remove repetition. Cover the selected depth without forcing every protocol section into each answer."
      : "- Verbosity: detailed. Make intermediate reasoning steps explicit and use helpful headings. Expand within the selected depth without repetition or unrelated tangents.",
    "",
  ].join("\n");

  return resources.map((resource) => ({
    ...resource,
    content: resource.path === "SKILL.md"
      ? `${resource.content.trimEnd()}\n\n${instructions}`
      : resource.content,
  }));
}
