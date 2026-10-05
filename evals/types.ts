import type { Depth, LearnerLevel } from "@/src/lib/explanation/schema";

export type MechanismCheck = { id: string; description: string; allOf: string[] };
export type GoldenConcept = { id: string; name: string; definition: string; aliases: string[]; dependsOn?: string[] };
export type EvalCase = {
  id: string;
  domain: "programming" | "operating-systems" | "networking" | "databases" | "mathematics" | "ml" | "physics" | "general-science";
  question: string;
  level: LearnerLevel;
  depth: Depth;
  sourceNote?: string;
  mustCoverConcepts: GoldenConcept[];
  mechanismChecks: MechanismCheck[];
  knownMisconceptions: { misconception: string; correction: string }[];
  prohibitedFalseSimplifications: { description: string; pattern: string }[];
  golden: {
    essence: string;
    mechanism: string[];
    example: { title: string; setup: string; walkthrough: string[]; takeaway: string };
    analogy?: { description: string; mapping: { source: string; target: string }[]; limitations: string[] };
    diagram: { textEquivalent: string; mermaid: string };
    quiz: { question: string; options: string[]; correctAnswer: string; explanation: string; answerPattern: string };
    caveats: string[];
  };
  externalVerificationRequired?: boolean;
};

export const DIMENSIONS = ["correctness", "conceptCoverage", "levelAppropriateness", "internalConsistency", "analogyCorrectness", "diagramConsistency", "quizAnswerValidity", "schemaValidity"] as const;
export type EvalDimension = (typeof DIMENSIONS)[number];
export type DimensionResult = { score: number; checks: number; failures: string[]; scope: string };
export type CaseResult = {
  id: string;
  domain: EvalCase["domain"];
  passed: boolean;
  score: number;
  dimensions: Record<EvalDimension, DimensionResult>;
  criticalFailures: string[];
};
