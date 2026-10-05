import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import { PROMPT_VERSION } from "@/src/lib/prompts/canonical-explanation.v1";
import type { EvalCase } from "./types";

// This assembles hand-authored reference content, never model output. Offline
// scoring validates the harness and reference contracts, not a provider's quality.
export function goldenDocument(item: EvalCase): ExplanationDocument {
  const ids = item.mustCoverConcepts.map((concept) => concept.id);
  return {
    schemaVersion: "1.0", id: `eval-${item.id}`, topic: item.id.replaceAll("-", " "), normalizedQuestion: item.question,
    audience: { level: item.level, desiredDepth: item.depth, assumedKnowledge: [] },
    learningObjectives: [{ id: "explain-mechanism", statement: "Explain the mechanism and its limitations.", conceptIds: ids }],
    prerequisites: [], essence: item.golden.essence,
    whyItMatters: item.golden.example.takeaway,
    concepts: item.mustCoverConcepts.map((concept) => ({ id: concept.id, name: concept.name, definition: concept.definition, plainExplanation: concept.definition, importance: "This concept is needed to explain the mechanism.", dependsOn: concept.dependsOn ?? [] })),
    relationships: item.mustCoverConcepts.flatMap((concept) => (concept.dependsOn ?? []).map((dependency) => ({ from: concept.id, to: dependency, type: "depends-on" as const, explanation: `${concept.name} builds on the earlier concept.` }))),
    process: { title: "Mechanism", steps: item.golden.mechanism.map((text, index) => ({ id: `step-${index + 1}`, text })) },
    mentalModel: { intuition: item.golden.mechanism.join(" "), analogy: item.golden.analogy },
    terminology: item.mustCoverConcepts.map((concept) => ({ term: concept.name, definition: concept.definition })),
    examples: [{ id: "worked-example", ...item.golden.example }],
    visualizations: [{ id: "mechanism-diagram", type: "flowchart", title: "Mechanism", ...item.golden.diagram }],
    interactives: [], misconceptions: item.knownMisconceptions,
    deepDive: item.depth === "deep" ? [{ id: "assumptions", title: "Assumptions and limitations", body: item.golden.caveats.join(" ") }] : [],
    verification: { required: item.externalVerificationRequired === true, performed: false, confidence: item.externalVerificationRequired ? "low" : "high", claims: [{ statement: item.golden.essence, status: item.externalVerificationRequired ? "unverified" : "supported" }], caveats: item.golden.caveats },
    quiz: [{ id: "mechanism-probe", type: "multiple-choice", conceptIds: ids, question: item.golden.quiz.question, options: item.golden.quiz.options, correctAnswer: item.golden.quiz.correctAnswer, explanation: item.golden.quiz.explanation, difficulty: 2 }],
    followUpSuggestions: ["Which assumption matters here?", "Can you show another example?", "What is a common misconception?"],
    metadata: { provider: "golden-reference", model: "hand-authored", generatedAt: "2026-10-05T00:00:00.000Z", promptVersion: PROMPT_VERSION },
  };
}

export function modelFields(document: ExplanationDocument): Record<string, unknown> {
  const { schemaVersion: _schema, id: _id, audience: _audience, metadata: _metadata, ...fields } = document;
  // Destructuring deliberately prevents eval transport from copying ownership or
  // provider metadata to model context.
  void _schema; void _id; void _audience; void _metadata;
  return fields;
}
