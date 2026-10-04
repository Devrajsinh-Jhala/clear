import "server-only";

import { ClearError } from "@/src/lib/api/errors";
import { selectGeneration } from "@/src/lib/ai/router";
import type { ProviderCredential } from "@/src/lib/ai/types";
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
  options: { model?: string; adapterId?: string; credential?: ProviderCredential } = {},
): Promise<TeachBackResult> {
  try {
    const selected = selectGeneration(options);
    const response = await selected.provider.generate({
      model: selected.model,
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
    }, selected.credential);
    return parseTeachBackResult(response.structured ?? response.text);
  } catch (error) {
    if (error instanceof ClearError && error.code === "provider_not_configured" && !options.adapterId) {
      return evaluateTeachBackLocally(explanation, document);
    }
    throw error;
  }
}
