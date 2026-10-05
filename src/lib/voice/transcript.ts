import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import type { TeachBackResult } from "@/src/lib/explanation/teach-back";

export const NARRATION_SECTIONS = [
  ["understand", "Understand"],
  ["mental-model", "Mental Model"],
  ["examples", "Examples"],
  ["deep-dive", "Deep Dive"],
] as const;

export type NarrationSection = (typeof NARRATION_SECTIONS)[number][0];

// Narration uses the validated lesson, including its caveats. It does not generate
// another answer or read executable diagram/widget specifications.
export function lessonTranscript(document: ExplanationDocument, section: NarrationSection): string {
  const paragraphs: string[] = [document.topic];
  switch (section) {
    case "understand":
      paragraphs.push(document.essence, document.whyItMatters);
      for (const concept of document.concepts) {
        paragraphs.push(`${concept.name}. ${concept.definition} ${concept.plainExplanation}`);
      }
      if (document.process) {
        paragraphs.push(document.process.title);
        document.process.steps.forEach((step, index) => paragraphs.push(`Step ${index + 1}. ${step.text}`));
      }
      break;
    case "mental-model":
      paragraphs.push(document.mentalModel.intuition);
      if (document.mentalModel.analogy) {
        paragraphs.push(`Analogy. ${document.mentalModel.analogy.description}`);
        document.mentalModel.analogy.mapping.forEach((mapping) => paragraphs.push(`${mapping.source} represents ${mapping.target}.`));
        paragraphs.push("Where the analogy stops.", ...document.mentalModel.analogy.limitations);
      }
      break;
    case "examples":
      for (const example of document.examples) {
        paragraphs.push(example.title, example.setup, ...example.walkthrough, `Takeaway. ${example.takeaway}`);
      }
      break;
    case "deep-dive":
      if (document.deepDive.length === 0) paragraphs.push("This lesson has no deep dive yet. Ask a follow-up to go deeper.");
      for (const detail of document.deepDive) paragraphs.push(detail.title, detail.body);
      break;
  }
  if (!document.verification.performed) {
    paragraphs.push("Factual verification was not performed for this lesson.");
  }
  paragraphs.push(...document.verification.caveats);
  return paragraphs.filter((paragraph) => paragraph.trim()).join("\n\n");
}

export function teachBackTranscript(result: TeachBackResult): string {
  return [
    result.headline,
    result.source === "model" ? "Reviewed by the selected model." : "Checked against the lesson's concept names. A model did not review the wording.",
    ...result.missingConcepts.map((concept) => `Missing. ${concept}`),
    ...result.misleadingStatements.map((statement) => `Slightly incorrect. ${statement}`),
    `Repaired explanation. ${result.repairedExplanation}`,
    result.memoryWarning,
  ].filter(Boolean).join("\n\n");
}

export function appendTranscript(current: string, spoken: string, limit: number): string {
  const addition = spoken.trim();
  if (!addition) return current;
  return `${current.trimEnd()}${current.trim() ? " " : ""}${addition}`.slice(0, limit);
}
