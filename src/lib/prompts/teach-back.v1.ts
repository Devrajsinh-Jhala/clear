export const TEACH_BACK_PROMPT_VERSION = "teach-back.v1";

export const TEACH_BACK_SYSTEM_PROMPT = `You evaluate a learner's explanation of a CLEAR lesson.
Judge correctness, missing concepts, misleading statements, terminology, and causal understanding.
Do not grade writing style, grammar, or tone.
Do not invent facts that are not in the lesson.
Return only JSON with:
- verdict: "right", "missing", or "incorrect"
- missingConcepts: string array of concept names that were needed and absent
- misleadingStatements: string array of quotes or close paraphrases that are wrong. Empty when nothing is wrong.
- repairedExplanation: a short technically correct explanation in plain language
Use "right" when the mechanism is present and nothing important is false.
Use "missing" when the direction is right but a needed concept is absent.
Use "incorrect" when a stated part would teach the wrong mechanism.`;

export function buildTeachBackUserPrompt(input: {
  topic: string;
  essence: string;
  concepts: { name: string; definition: string }[];
  explanation: string;
}): string {
  const conceptList = input.concepts.map((concept) => `- ${concept.name}: ${concept.definition}`).join("\n");
  return `Topic: ${input.topic}
Essence: ${input.essence}

Concepts:
${conceptList}

Learner explanation:
${input.explanation}`;
}
