import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { PROMPT_VERSION } from "@/src/lib/prompts/canonical-explanation.v1";
import { FOLLOW_UP_PROMPT_VERSION } from "@/src/lib/prompts/follow-up.v1";
import { TEACH_BACK_PROMPT_VERSION } from "@/src/lib/prompts/teach-back.v1";
import { REPAIR_PROMPT_VERSION } from "@/src/lib/prompts/repair.v1";
import { CORPUS_VERSION, EVAL_CORPUS } from "./corpus.v1";
import { goldenDocument } from "./golden";
import { evaluateLiveCase, evaluateLiveTeachBack, liveOptions, selectedCases, type LiveCaseResult, type TeachBackProbeResult } from "./live";
import { LAUNCH_GATE, launchGate, meetsLaunchCase, RUBRIC_LIMITS, RUBRIC_VERSION, scoreExplanation, THRESHOLDS } from "./score";

vi.mock("server-only", () => ({}));

const options = liveOptions();
const cases = selectedCases(process.env.CLEAR_EVAL_CASES);
const mode = options ? "live-provider" : "offline-reference";
const results: LiveCaseResult[] = [];
let teachBack: TeachBackProbeResult[] = [];

describe(`CLEAR ${mode} evaluation`, () => {
  for (const item of cases) {
    it(`${item.domain}: ${item.id}`, async () => {
      const result = options ? await evaluateLiveCase(item, options) : { canonical: scoreExplanation(item, goldenDocument(item)) };
      results.push(result);
      // Hand-authored goldens must meet the strict bar; live lessons must meet the launch gate.
      const accepted = (outcome: typeof result.canonical) => options ? meetsLaunchCase(outcome) : outcome.passed;
      expect(accepted(result.canonical), JSON.stringify({ score: result.canonical.score, critical: result.canonical.criticalFailures, dimensions: result.canonical.dimensions })).toBe(true);
      if (options?.extended) {
        expect(result.followUp && accepted(result.followUp), JSON.stringify(result.followUp?.dimensions)).toBe(true);
        expect(result.preservedConceptIds).toBe(true);
      }
    });
  }
  it.skipIf(!options || cases.length !== EVAL_CORPUS.length)("the full live corpus meets the launch gate", () => {
    const gate = launchGate(results.map((result) => result.canonical), EVAL_CORPUS.length);
    expect(gate, `mean ${gate.meanScore.toFixed(3)} (needs ${LAUNCH_GATE.minimumMeanScore})`).toMatchObject({ passed: true, failingCases: [] });
  });
  it.skipIf(!options?.extended)("teach-back judges the mechanism rather than writing style", async () => {
    teachBack = await evaluateLiveTeachBack(options!);
    expect(teachBack.filter((result) => !result.passed)).toEqual([]);
  });
});

afterAll(async () => {
  const directory = path.resolve(".data/evals");
  await mkdir(directory, { recursive: true });
  const reportPath = path.join(directory, options ? "latest-live.json" : "latest-offline.json");
  const canonicalPassed = results.filter((result) => options ? meetsLaunchCase(result.canonical) : result.canonical.passed).length;
  const strictPassed = results.filter((result) => result.canonical.passed).length;
  const gate = launchGate(results.map((result) => result.canonical), cases.length);
  const followUpPassed = results.filter((result) => result.followUp && (options ? meetsLaunchCase(result.followUp) : result.followUp.passed) && result.preservedConceptIds).length;
  const summary = {
    canonical: { attempted: results.length, passed: canonicalPassed, strictPassed, meanScore: Number(gate.meanScore.toFixed(4)) },
    followUp: { attempted: results.filter((result) => result.followUp).length, passed: followUpPassed, status: options?.extended ? "evaluated" : "not-run" },
    teachBack: { attempted: teachBack.length, passed: teachBack.filter((result) => result.passed).length, status: options?.extended ? "evaluated" : "not-run" },
  };
  const report = {
    reportVersion: "1.0", mode, generatedAt: new Date().toISOString(), corpusVersion: CORPUS_VERSION, rubricVersion: RUBRIC_VERSION,
    promptVersions: { canonical: PROMPT_VERSION, followUp: FOLLOW_UP_PROMPT_VERSION, teachBack: TEACH_BACK_PROMPT_VERSION, repair: REPAIR_PROMPT_VERSION },
    provider: options?.provider ?? "none", model: options?.model ?? "hand-authored reference", selectedCaseIds: cases.map((item) => item.id),
    fullCorpus: cases.length === EVAL_CORPUS.length, thresholds: THRESHOLDS, launchGate: { ...LAUNCH_GATE, meanScore: gate.meanScore, failingCases: gate.failingCases }, limitations: RUBRIC_LIMITS, summary, results, teachBack,
    passed: results.length === cases.length && canonicalPassed === cases.length && (!options || gate.passed) && (!options?.extended || followUpPassed === cases.length && teachBack.length === 3 && teachBack.every((result) => result.passed)),
    liveQualityMeasured: Boolean(options),
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const description = options ? `${options.provider}/${options.model} measured on synthetic questions` : "hand-authored goldens; no live provider requests or model-quality claim";
  console.info(`CLEAR ${mode}: ${canonicalPassed}/${cases.length} canonical cases passed (${description}); mean score ${gate.meanScore.toFixed(3)}, ${strictPassed} strict.\nFollow-up: ${summary.followUp.status}; teach-back: ${summary.teachBack.status}.\nReport: ${reportPath}`);
});
