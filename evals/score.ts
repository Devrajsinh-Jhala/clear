import { validateConsistency } from "@/src/lib/explanation/consistency";
import { isRecord } from "@/src/lib/explanation/normalize";
import { evaluateSafeMath } from "@/src/lib/explanation/safe-math";
import { explanationDocumentSchema, type ExplanationDocument } from "@/src/lib/explanation/schema";
import { DIMENSIONS, type CaseResult, type DimensionResult, type EvalCase, type EvalDimension } from "./types";

export const RUBRIC_VERSION = "clear-structural-rubric.v1";
// Every dimension must meet its threshold; an average cannot hide a broken
// mechanism, fabricated verification, unsafe widget, or invalid answer key.
export const THRESHOLDS: Record<EvalDimension, number> = {
  correctness: 1, conceptCoverage: 1, levelAppropriateness: 1, internalConsistency: 1,
  analogyCorrectness: 1, diagramConsistency: 1, quizAnswerValidity: 1, schemaValidity: 1,
};
export const RUBRIC_LIMITS = [
  "Deterministic mechanisms use scoped regex checks, not a semantic proof of factual correctness.",
  "Analogy and diagram checks verify references, stated limits, and safe structure; a human must assess fidelity.",
  "Quiz scoring verifies a known factual probe and structural integrity of other questions, not every possible answer's meaning.",
  "Level scoring verifies declared audience, defined terms, and basic length/depth requirements, not comprehension by real learners.",
  "Offline goldens and simulated adapters do not measure live model quality, source authenticity, or browser rendering.",
];

export function scoreExplanation(item: EvalCase, raw: unknown): CaseResult {
  const parsed = explanationDocumentSchema.safeParse(raw);
  const dimensions = Object.fromEntries(DIMENSIONS.map((name) => [name, result(0, ["No schema-valid document was available."], "Not evaluated without a valid document.")])) as Record<EvalDimension, DimensionResult>;
  if (!parsed.success) {
    dimensions.schemaValidity = result(1, parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`), "Canonical schema validation.");
    return finish(item, dimensions, ["Schema-invalid output."]);
  }
  const document = parsed.data;
  dimensions.schemaValidity = result(1, [], "Canonical schema validation; unknown fields are stripped by the application schema.");
  const criticalFailures: string[] = [];
  const teaching = teachingBlocks(document);
  const correctBlocks = [...teaching, ...document.quiz.flatMap((quiz) => [Array.isArray(quiz.correctAnswer) ? quiz.correctAnswer.join(" ") : quiz.correctAnswer, quiz.explanation])];
  const falseClaims = item.prohibitedFalseSimplifications.filter((rule) => correctBlocks.some((block) => matches(rule.pattern, block)));
  criticalFailures.push(...falseClaims.map((rule) => `Prohibited assertion: ${rule.description}`));
  const mechanismFailures = item.mechanismChecks.filter((check) => !teaching.some((block) => check.allOf.every((pattern) => matches(pattern, block)))).map((check) => `${check.id}: ${check.description}`);
  const verificationFailures: string[] = [];
  if (document.verification.performed) verificationFailures.push("External verification claimed even though this evaluator supplies no browsing tools.");
  if (item.externalVerificationRequired && (!document.verification.required || !document.verification.caveats.some((caveat) => /(?:not|cannot|unable|unverified).*(?:verif|brows)|(?:verif|brows).*(?:not|unavailable)/i.test(caveat)))) verificationFailures.push("Current facts need an explicit unverified/external-verification caveat.");
  criticalFailures.push(...verificationFailures);
  dimensions.correctness = result(item.mechanismChecks.length + 1 + (item.externalVerificationRequired ? 1 : 0), [...mechanismFailures, ...falseClaims.map((rule) => rule.description), ...verificationFailures], "Causal mechanism in teaching prose; questions, distractors, and misconception labels do not earn coverage.");

  const defined = document.concepts.map((concept) => `${concept.name}: ${concept.definition} ${concept.plainExplanation}`).concat(document.terminology.map((term) => `${term.term}: ${term.definition}`));
  const missingConcepts = item.mustCoverConcepts.filter((concept) => !defined.some((block) => concept.aliases.some((alias) => hasTerm(block, alias)))).map((concept) => `Missing defined concept: ${concept.name}`);
  dimensions.conceptCoverage = result(item.mustCoverConcepts.length, missingConcepts, "Required concepts must occur in definitions or terminology, not only the question or a diagram.");

  const levelFailures: string[] = [];
  if (document.audience.level !== item.level || document.audience.desiredDepth !== item.depth) levelFailures.push("Audience or depth differs from the requested level.");
  if (wordCount(document.essence) > 65) levelFailures.push("The one-sentence essence exceeds 65 words.");
  if (document.examples.some((example) => example.walkthrough.length < 1)) levelFailures.push("A worked example needs an actual walkthrough.");
  if (item.depth === "deep" && !document.deepDive.length) levelFailures.push("Deep depth omitted its deeper section.");
  const undefinedTerms = item.mustCoverConcepts.filter((concept) => teaching.some((block) => concept.aliases.some((alias) => hasTerm(block, alias))) && !defined.some((block) => concept.aliases.some((alias) => hasTerm(block, alias))));
  if (undefinedTerms.length) levelFailures.push(`Technical terms used without definitions: ${undefinedTerms.map((concept) => concept.name).join(", ")}`);
  if (item.level === "beginner" && document.concepts.some((concept) => wordCount(concept.definition) > 80)) levelFailures.push("Beginner concept definitions exceed 80 words.");
  dimensions.levelAppropriateness = result(6, levelFailures, "Audience, term definitions, concise essence, worked steps, and requested deep content; reading-level judgment remains manual.");

  const consistencyFailures = validateConsistency(document).map((issue) => `${issue.path}: ${issue.message}`);
  const seenConcepts = new Set<string>();
  for (const concept of document.concepts) {
    if (concept.dependsOn.some((id) => !seenConcepts.has(id))) consistencyFailures.push(`${concept.id}: Dependencies must be introduced before the dependent concept.`);
    seenConcepts.add(concept.id);
  }
  for (const [name, entries] of [["quiz", document.quiz], ["learningObjectives", document.learningObjectives], ["examples", document.examples]] as const) {
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length) consistencyFailures.push(`${name}: Duplicate ids.`);
  }
  const unsafeWidgets = inspectWidgets(raw, document);
  consistencyFailures.push(...unsafeWidgets);
  criticalFailures.push(...unsafeWidgets);
  dimensions.internalConsistency = result(1, consistencyFailures, "Canonical references, topological dependencies, unique ids, and declared safe widget behavior.");

  const analogyFailures: string[] = [];
  if (document.mentalModel.analogy) {
    const analogy = document.mentalModel.analogy;
    if (!analogy.limitations.some((limit) => limit.length >= 20 && /not|only|unlike|cannot|break|different|fails|no physical|doesn.t/i.test(limit))) analogyFailures.push("An analogy needs a substantive boundary distinguishing it from the mechanism.");
    if (analogy.mapping.some((mapping) => !item.mustCoverConcepts.some((concept) => concept.aliases.some((alias) => hasTerm(mapping.target, alias))))) analogyFailures.push("Analogy mapping targets must identify actual lesson concepts.");
  }
  dimensions.analogyCorrectness = result(2, analogyFailures, document.mentalModel.analogy ? "Mapping references and explicit analogy limits; semantic correctness needs human review." : "No analogy supplied; no false analogy is implied.");

  const diagramFailures: string[] = [];
  document.visualizations.forEach((visual, index) => {
    if (wordCount(visual.textEquivalent) < 12) diagramFailures.push(`visualizations.${index}: Text equivalent is too brief to stand alone.`);
    if (!item.mustCoverConcepts.some((concept) => concept.aliases.some((alias) => hasTerm(visual.textEquivalent, alias)))) diagramFailures.push(`visualizations.${index}: Text equivalent has no required concept reference.`);
    if (visual.mermaid && /%%\{|\bclick\b|javascript:|<\/?[a-z]|\b(?:https?|data|file):|@\{/i.test(visual.mermaid)) diagramFailures.push(`visualizations.${index}: Unsafe Mermaid instruction or external content.`);
  });
  criticalFailures.push(...diagramFailures.filter((failure) => failure.includes("Unsafe")));
  dimensions.diagramConsistency = result(Math.max(1, document.visualizations.length * 3), diagramFailures, document.visualizations.length ? "Standalone text, concept references, and safe Mermaid; full visual semantic fidelity remains manual." : "No diagram supplied; diagrams are optional when they do not help.");

  const quizFailures: string[] = [];
  const quizProbe = document.quiz.find((quiz) => normalizeQuestion(quiz.question) === normalizeQuestion(item.golden.quiz.question));
  if (!quizProbe) quizFailures.push("Missing the requested known-answer quiz probe.");
  else if (Array.isArray(quizProbe.correctAnswer) || !matches(item.golden.quiz.answerPattern, quizProbe.correctAnswer)) quizFailures.push("The known-answer quiz probe has a factually incorrect answer.");
  document.quiz.forEach((quiz, index) => {
    if (!quiz.conceptIds.length || quiz.explanation.length < 10) quizFailures.push(`quiz.${index}: An answer needs a concept reference and explanatory rationale.`);
    if (quiz.options && new Set(quiz.options).size !== quiz.options.length) quizFailures.push(`quiz.${index}: Duplicate choices.`);
  });
  if (falseClaims.length) quizFailures.push("An assertion contradicts the case's prohibited-claim rubric.");
  dimensions.quizAnswerValidity = result(document.quiz.length + 1, quizFailures, "Known factual quiz probe plus references, answer/options consistency, and rationales for other questions.");
  return finish(item, dimensions, criticalFailures);
}

function result(checks: number, failures: string[], scope: string): DimensionResult {
  return { checks, failures, scope, score: Math.max(0, 1 - failures.length / Math.max(1, checks)) };
}
function finish(item: EvalCase, dimensions: CaseResult["dimensions"], criticalFailures: string[]): CaseResult {
  return { id: item.id, domain: item.domain, passed: criticalFailures.length === 0 && DIMENSIONS.every((dimension) => dimensions[dimension].score >= THRESHOLDS[dimension]), score: DIMENSIONS.reduce((sum, dimension) => sum + dimensions[dimension].score, 0) / DIMENSIONS.length, dimensions, criticalFailures };
}
function matches(pattern: string, value: string): boolean { return new RegExp(pattern, "i").test(value); }
function hasTerm(value: string, term: string): boolean { return new RegExp(`(?:^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`, "i").test(value); }
function wordCount(value: string): number { return value.trim().split(/\s+/).filter(Boolean).length; }
function normalizeQuestion(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function teachingBlocks(document: ExplanationDocument): string[] {
  return [document.essence, document.whyItMatters, document.mentalModel.intuition,
    ...document.concepts.flatMap((concept) => [concept.definition, concept.plainExplanation]),
    ...document.relationships.map((relationship) => relationship.explanation),
    ...(document.process?.steps.map((step) => step.text) ?? []),
    ...document.examples.flatMap((example) => [example.setup, ...example.walkthrough, example.takeaway]),
    ...document.misconceptions.map((misconception) => misconception.correction),
    ...document.deepDive.map((section) => section.body), ...document.verification.caveats];
}
function inspectWidgets(raw: unknown, document: ExplanationDocument): string[] {
  const failures: string[] = [];
  if (isRecord(raw) && Array.isArray(raw.interactives)) raw.interactives.forEach((widget, index) => {
    if (isRecord(widget) && Object.keys(widget).some((key) => /^(?:javascript|js|script|html|on\w+)$/i.test(key))) failures.push(`interactives.${index}: Arbitrary executable widget fields are prohibited.`);
  });
  document.interactives.forEach((widget, index) => {
    if (widget.type === "binary-search" && widget.array.some((value, position) => position > 0 && value < widget.array[position - 1])) failures.push(`interactives.${index}: Binary search requires sorted input.`);
    if (widget.type === "parameter-explorer") {
      const variables = Object.fromEntries(widget.parameters.map((parameter) => [parameter.name, parameter.initial]));
      if (evaluateSafeMath(widget.formula, variables) === null) failures.push(`interactives.${index}: Formula is unsafe or undefined at initial values.`);
      if (widget.parameters.some((parameter) => parameter.min > parameter.max || parameter.initial < parameter.min || parameter.initial > parameter.max)) failures.push(`interactives.${index}: Parameter bounds are invalid.`);
    }
    if (widget.type === "code-trace" && widget.steps.some((step) => step.line > widget.code.split(/\r?\n/).length)) failures.push(`interactives.${index}: Trace refers to a nonexistent code line.`);
  });
  return failures;
}
