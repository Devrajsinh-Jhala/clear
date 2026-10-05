import { getProvider } from "@/src/lib/ai/router";
import { redactSecrets } from "@/src/lib/ai/redact";
import type { ProviderCredential } from "@/src/lib/ai/types";
import { ClearError } from "@/src/lib/api/errors";
import { generateExplanation } from "@/src/lib/explanation/generate";
import { continueExplanation } from "@/src/lib/explanation/follow-up";
import { reviewTeachBack } from "@/src/lib/explanation/review-teach-back";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import { goldenDocument } from "./golden";
import { EVAL_CORPUS } from "./corpus.v1";
import { scoreExplanation } from "./score";
import type { CaseResult, EvalCase } from "./types";

export type LiveOptions = { provider: string; model: string; credential: ProviderCredential; extended: boolean };
export type LiveCaseResult = { canonical: CaseResult; followUp?: CaseResult; errorCode?: string; preservedConceptIds?: boolean };
export type TeachBackProbeResult = { id: string; expected: string; actual?: string; passed: boolean; errorCode?: string };

export function liveOptions(env: Record<string, string | undefined> = process.env): LiveOptions | undefined {
  if (!env.CLEAR_EVAL_LIVE || env.CLEAR_EVAL_LIVE === "0") return undefined;
  if (env.CLEAR_EVAL_LIVE !== "1" || env.CLEAR_EVAL_ACK_COST !== "1") throw new Error("Live evals require CLEAR_EVAL_LIVE=1 and CLEAR_EVAL_ACK_COST=1. They make billable provider requests.");
  if (!env.CLEAR_EVAL_PROVIDER || !env.CLEAR_EVAL_MODEL || !env.CLEAR_EVAL_API_KEY) throw new Error("Set CLEAR_EVAL_PROVIDER, CLEAR_EVAL_MODEL, and CLEAR_EVAL_API_KEY explicitly. The runner does not load .env files or reuse browser keys.");
  if (!["gemini", "openai", "anthropic", "xai", "compatible"].includes(env.CLEAR_EVAL_PROVIDER)) throw new Error("Select a real configured provider; mock is not a live quality evaluation.");
  if (env.CLEAR_EVAL_PROVIDER === "compatible" && !env.CLEAR_EVAL_BASE_URL) throw new Error("Custom providers also require CLEAR_EVAL_BASE_URL.");
  if (env.CLEAR_EVAL_EXTENDED && !["0", "1"].includes(env.CLEAR_EVAL_EXTENDED)) throw new Error("CLEAR_EVAL_EXTENDED must be 0 or 1.");
  getProvider(env.CLEAR_EVAL_PROVIDER);
  return { provider: env.CLEAR_EVAL_PROVIDER, model: env.CLEAR_EVAL_MODEL, credential: { apiKey: env.CLEAR_EVAL_API_KEY, baseUrl: env.CLEAR_EVAL_BASE_URL }, extended: env.CLEAR_EVAL_EXTENDED === "1" };
}

export function selectedCases(value: string | undefined): EvalCase[] {
  if (!value) return EVAL_CORPUS;
  const ids = [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))];
  if (!ids.length || ids.some((id) => !EVAL_CORPUS.some((item) => item.id === id))) throw new Error("CLEAR_EVAL_CASES must list existing corpus ids, separated by commas.");
  return ids.map((id) => EVAL_CORPUS.find((item) => item.id === id)!);
}

export async function evaluateLiveCase(item: EvalCase, options: LiveOptions): Promise<LiveCaseResult> {
  let document: ExplanationDocument;
  const providerOptions = { adapterId: options.provider, model: options.model, credential: options.credential };
  try {
    const generated = await generateExplanation({ question: `${item.question}\n\nInclude one quiz item with exactly this question: ${item.golden.quiz.question}`, level: item.level, depth: item.depth, sourceNote: item.sourceNote, ...providerOptions });
    document = generated.document;
  } catch (error) {
    return { canonical: scoreExplanation(item, undefined), errorCode: safeErrorCode(error) };
  }
  const canonical = redactEvaluationResult(scoreExplanation(item, document), options.credential.apiKey);
  if (!options.extended) return { canonical };
  try {
    const continued = await continueExplanation({ document, activeView: "mental-model", sourceNote: item.sourceNote, message: `Stay on this topic. Explain why this claim is misleading: ${item.knownMisconceptions[0].misconception}\nKeep the correct concept ids and the known-answer quiz question: ${item.golden.quiz.question}`, ...providerOptions });
    return { canonical, followUp: redactEvaluationResult(scoreExplanation(item, continued.document), options.credential.apiKey), preservedConceptIds: document.concepts.every((concept) => continued.document.concepts.some((updated) => updated.id === concept.id)) };
  } catch (error) {
    return { canonical, followUp: scoreExplanation(item, undefined), errorCode: safeErrorCode(error), preservedConceptIds: false };
  }
}

export const TEACH_BACK_PROBES = [
  { id: "mechanism-poor-grammar", expected: "right", explanation: "threads shared state update. same mutex lock whole read change write. critical section one thread at time; other waits then unlock. different locks do not protect same update." },
  { id: "missing-coordination", expected: "missing", explanation: "Threads can update shared state, and the critical section is where those updates happen." },
  { id: "polished-false-mechanism", expected: "incorrect", explanation: "For elegant and efficient synchronization, each thread acquires its own independent mutex. These different locks prevent all races on their shared counter." },
] as const;

export async function evaluateLiveTeachBack(options: LiveOptions): Promise<TeachBackProbeResult[]> {
  const document = goldenDocument(EVAL_CORPUS[0]);
  const results: TeachBackProbeResult[] = [];
  for (const probe of TEACH_BACK_PROBES) {
    try {
      const result = await reviewTeachBack(probe.explanation, document, { adapterId: options.provider, model: options.model, credential: options.credential });
      results.push({ id: probe.id, expected: probe.expected, actual: result.verdict, passed: result.source === "model" && result.verdict === probe.expected });
    } catch (error) { results.push({ id: probe.id, expected: probe.expected, passed: false, errorCode: safeErrorCode(error) }); }
  }
  return results;
}

function safeErrorCode(error: unknown): string {
  // Provider messages/details can contain response text or credentials. Reports
  // contain a finite app error code instead of storing those messages.
  return error instanceof ClearError ? error.code : "evaluation_failed";
}

export function redactEvaluationResult(result: CaseResult, apiKey: string): CaseResult {
  const sanitize = (text: string) => redactSecrets(apiKey ? text.replaceAll(apiKey, "[redacted]") : text).slice(0, 1200);
  return { ...result, criticalFailures: result.criticalFailures.map(sanitize), dimensions: Object.fromEntries(Object.entries(result.dimensions).map(([name, dimension]) => [name, { ...dimension, failures: dimension.failures.map(sanitize) }])) as CaseResult["dimensions"] };
}
