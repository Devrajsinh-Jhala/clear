import "server-only";

import { randomUUID } from "node:crypto";

import { defaultGeminiModel } from "@/src/lib/ai/providers/gemini";
import { resolveGenerationProvider } from "@/src/lib/ai/router";
import type { AIProvider } from "@/src/lib/ai/types";
import { ClearError } from "@/src/lib/api/errors";
import { acceptModelOutput } from "@/src/lib/explanation/validate";
import type { Depth, ExplanationDocument, LearnerLevel } from "@/src/lib/explanation/schema";
import {
  buildCanonicalUserPrompt,
  CANONICAL_SYSTEM_PROMPT,
  PROMPT_VERSION,
} from "@/src/lib/prompts/canonical-explanation.v1";
import { buildRepairUserPrompt, REPAIR_SYSTEM_PROMPT } from "@/src/lib/prompts/repair.v1";

export async function generateExplanation(input: {
  question: string;
  level: LearnerLevel;
  depth: Depth;
  customLevel?: string;
}): Promise<{ document: ExplanationDocument; providerId: string; model: string }> {
  const provider = resolveGenerationProvider();
  const model = provider.id === "gemini" ? defaultGeminiModel() : "clear-mock";
  return generateWithProvider(provider, model, input);
}

async function generateWithProvider(
  provider: AIProvider,
  model: string,
  input: { question: string; level: LearnerLevel; depth: Depth; customLevel?: string },
): Promise<{ document: ExplanationDocument; providerId: string; model: string }> {
  const started = Date.now();
  const response = await provider.generate({
    model,
    system: CANONICAL_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildCanonicalUserPrompt(input) }],
    temperature: input.depth === "quick" ? 0.2 : 0.4,
    maxOutputTokens: input.depth === "deep" ? 12000 : 8000,
  });
  const raw = response.structured ?? response.text;
  if (raw === undefined) {
    throw new ClearError("provider_error", "The model returned no explanation.", {
      retryable: true,
      status: 502,
    });
  }

  const document = await acceptModelOutput({
    raw,
    question: input.question,
    audience: {
      level: input.level,
      desiredDepth: input.depth,
      assumedKnowledge: input.customLevel ? [input.customLevel] : [],
    },
    stamp: {
      id: randomUUID(),
      provider: provider.id,
      model,
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - started,
      tokenUsage: response.usage,
    },
    repair: (issues, invalid) => repairOnce(provider, model, issues, invalid),
  });

  return { document, providerId: provider.id, model };
}

async function repairOnce(
  provider: AIProvider,
  model: string,
  issues: string[],
  invalid: unknown,
): Promise<unknown> {
  const response = await provider.generate({
    model,
    system: REPAIR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildRepairUserPrompt(invalid, issues) }],
    temperature: 0,
    maxOutputTokens: 8000,
  });
  if (response.structured !== undefined) return response.structured;
  if (response.text) return response.text;
  throw new ClearError("schema_invalid", "CLEAR could not repair the explanation.", {
    retryable: true,
    status: 502,
  });
}
