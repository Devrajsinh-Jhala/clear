import "server-only";

import { defaultGeminiModel } from "@/src/lib/ai/providers/gemini";
import { resolveGenerationProvider } from "@/src/lib/ai/router";
import { ClearError } from "@/src/lib/api/errors";
import { isRecord } from "@/src/lib/explanation/normalize";
import { acceptModelOutput } from "@/src/lib/explanation/validate";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import {
  buildFollowUpUserPrompt,
  FOLLOW_UP_PROMPT_VERSION,
  FOLLOW_UP_SYSTEM_PROMPT,
} from "@/src/lib/prompts/follow-up.v1";
import { buildRepairUserPrompt, REPAIR_SYSTEM_PROMPT } from "@/src/lib/prompts/repair.v1";

export async function continueExplanation(input: {
  message: string;
  document: ExplanationDocument;
  activeView?: string;
}): Promise<{ document: ExplanationDocument; reply: string; providerId: string; model: string }> {
  const provider = resolveGenerationProvider();
  const model = provider.id === "gemini" ? defaultGeminiModel() : "clear-mock";
  const started = Date.now();
  const response = await provider.generate({
    model,
    system: FOLLOW_UP_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildFollowUpUserPrompt({
          message: input.message,
          activeView: input.activeView,
          documentJson: JSON.stringify(stripServerFields(input.document)),
        }),
      },
    ],
    temperature: 0.3,
    maxOutputTokens: 12000,
  });

  const raw = response.structured ?? response.text;
  if (raw === undefined) {
    throw new ClearError("provider_error", "The model returned no follow-up.", {
      retryable: true,
      status: 502,
    });
  }

  const { reply, documentRaw } = splitFollowUp(raw);
  const document = await acceptModelOutput({
    raw: documentRaw,
    question: input.document.normalizedQuestion,
    audience: {
      level: input.document.audience.level,
      desiredDepth: input.document.audience.desiredDepth,
      assumedKnowledge: input.document.audience.assumedKnowledge,
    },
    stamp: {
      id: input.document.id,
      provider: provider.id,
      model,
      promptVersion: FOLLOW_UP_PROMPT_VERSION,
      latencyMs: Date.now() - started,
      tokenUsage: response.usage,
    },
    repair: async (issues, invalid) => {
      const repaired = await provider.generate({
        model,
        system: REPAIR_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildRepairUserPrompt(invalid, issues) }],
        temperature: 0,
        maxOutputTokens: 12000,
      });
      return repaired.structured ?? repaired.text;
    },
  });

  return { document, reply, providerId: provider.id, model };
}

function stripServerFields(document: ExplanationDocument): Record<string, unknown> {
  const clone = { ...document } as Record<string, unknown>;
  delete clone.schemaVersion;
  delete clone.id;
  delete clone.audience;
  delete clone.metadata;
  return clone;
}

function splitFollowUp(raw: unknown): { reply: string; documentRaw: unknown } {
  if (typeof raw === "string") {
    return { reply: "I updated the explanation.", documentRaw: raw };
  }
  if (isRecord(raw) && "document" in raw) {
    const reply = typeof raw.reply === "string" && raw.reply.trim() ? raw.reply.trim() : "I updated the explanation.";
    return { reply, documentRaw: raw.document };
  }
  return { reply: "I updated the explanation.", documentRaw: raw };
}
