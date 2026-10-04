import { buildSampleModelOutput } from "@/src/lib/explanation/fixtures/sample";
import type { AIProvider } from "@/src/lib/ai/types";
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

function extractQuestion(content: string): string {
  const match = content.match(/Question:\s*([\s\S]*?)(?:\n\nReturn|\nReturn a JSON|$)/);
  return (match?.[1] ?? content).trim().slice(0, 500);
}
