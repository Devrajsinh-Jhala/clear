import { buildSampleModelOutput } from "@/src/lib/explanation/fixtures/sample";
import type { AIProvider } from "@/src/lib/ai/types";
import { ClearError } from "@/src/lib/api/errors";
import { isRecord } from "@/src/lib/explanation/normalize";
import { FOLLOW_UP_SYSTEM_PROMPT } from "@/src/lib/prompts/follow-up.v1";
import { TEACH_BACK_SYSTEM_PROMPT } from "@/src/lib/prompts/teach-back.v1";

export const mockProvider: AIProvider = {
  id: "mock",
  displayName: "Local mock",
  capabilities: {
    text: true,
    vision: false,
    pdf: false,
    audioInput: false,
    audioOutput: false,
    structuredOutput: true,
    toolCalling: false,
    streaming: false,
    realtime: false,
    modelDiscovery: false,
  },
  async generate(request) {
    const question = request.messages.find((message) => message.role === "user")?.content ?? "Untitled question";
    if (request.system === FOLLOW_UP_SYSTEM_PROMPT) {
      const structured = {
        reply: "Local mock: I kept the existing lesson. No model reviewed or answered this follow-up.",
        document: extractCurrentExplanation(question),
      };
      return {
        text: JSON.stringify(structured),
        structured,
        usage: { inputTokens: 0, outputTokens: 0 },
        finishReason: "stop",
      };
    }
    if (request.system === TEACH_BACK_SYSTEM_PROMPT) {
      const structured = {
        verdict: "missing",
        missingConcepts: ["Mutex"],
        misleadingStatements: [],
        repairedExplanation: "A mutex lets only one thread at a time enter a protected critical section.",
      };
      return {
        text: JSON.stringify(structured),
        structured,
        usage: { inputTokens: 0, outputTokens: 0 },
        finishReason: "stop",
      };
    }
    const structured = buildSampleModelOutput(extractQuestion(question));
    return {
      text: JSON.stringify(structured),
      structured,
      usage: { inputTokens: 0, outputTokens: 0 },
      finishReason: "stop",
    };
  },
};

function extractCurrentExplanation(content: string): Record<string, unknown> {
  const match = content.match(/(?:^|\n)Current explanation JSON:\n([\s\S]*?)\n\nLearner follow-up:/);
  try {
    const document: unknown = JSON.parse(match?.[1] ?? "null");
    if (isRecord(document)) return document;
  } catch {
    // The follow-up service remains responsible for validating lesson content.
  }
  throw new ClearError("schema_invalid", "The local mock could not read the current lesson.", {
    status: 502,
  });
}

function extractQuestion(content: string): string {
  const match = content.match(/Question:\s*([\s\S]*?)(?:\n\nReturn|\nReturn a JSON|$)/);
  return (match?.[1] ?? content).trim().slice(0, 500);
}
