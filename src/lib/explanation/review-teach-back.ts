import "server-only";

import { ClearError } from "@/src/lib/api/errors";
import { defaultGeminiModel } from "@/src/lib/ai/providers/gemini";
import { resolveGenerationProvider } from "@/src/lib/ai/router";
import {
  evaluateTeachBackLocally,
  parseTeachBackResult,
  type TeachBackResult,
} from "@/src/lib/explanation/teach-back";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import { buildTeachBackUserPrompt, TEACH_BACK_SYSTEM_PROMPT } from "@/src/lib/prompts/teach-back.v1";

export async function reviewTeachBack(
  explanation: string,
  document: ExplanationDocument,
): Promise<TeachBackResult> {
  try {
    const provider = resolveGenerationProvider();
    const model = provider.id === "gemini" ? defaultGeminiModel() : "clear-mock";
    const response = await provider.generate({
      model,
      system: TEACH_BACK_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildTeachBackUserPrompt({
            topic: document.topic,
            essence: document.essence,
            concepts: document.concepts.map((concept) => ({
              name: concept.name,
              definition: concept.definition,
            })),
            explanation,
          }),
        },
      ],
      temperature: 0.2,
      maxOutputTokens: 2000,
    });
    return parseTeachBackResult(response.structured ?? response.text);
  } catch (error) {
    if (error instanceof ClearError && error.code === "provider_not_configured") {
      return evaluateTeachBackLocally(explanation, document);
    }
    throw error;
  }
}
