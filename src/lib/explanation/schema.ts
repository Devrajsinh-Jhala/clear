import { z } from "zod";

export const learnerLevelSchema = z.enum([
  "beginner",
  "student",
  "engineer",
  "researcher",
  "interview",
  "custom",
]);

export const depthSchema = z.enum(["quick", "balanced", "deep"]);

export const conceptSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  definition: z.string().min(1),
  plainExplanation: z.string().min(1),
  importance: z.string().min(1),
  dependsOn: z.array(z.string()),
});

export const conceptRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const relationshipTypeSchema = z.enum([
  "causes",
  "contains",
  "depends-on",
  "maps-to",
  "transforms",
  "calls",
  "returns",
  "precedes",
  "contrasts-with",
  "related-to",
]);

export const conceptRelationshipSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: relationshipTypeSchema,
  explanation: z.string().min(1),
});

export const analogyMappingSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
});

export const mentalModelSchema = z.object({
  intuition: z.string().min(1),
  analogy: z
    .object({
      description: z.string().min(1),
      mapping: z.array(analogyMappingSchema).min(1),
      limitations: z.array(z.string().min(1)).min(1),
    })
    .optional(),
});

export const termDefinitionSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
});

export const exampleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  setup: z.string().min(1),
  walkthrough: z.array(z.string().min(1)).min(1),
  takeaway: z.string().min(1),
});

export const visualizationTypeSchema = z.enum([
  "flowchart",
  "sequence",
  "architecture",
  "state-machine",
  "timeline",
  "hierarchy",
  "concept-map",
  "comparison",
  "pipeline",
  "data-flow",
]);

export const visualizationSpecSchema = z.object({
  id: z.string().min(1),
  type: visualizationTypeSchema,
  title: z.string().min(1),
  textEquivalent: z.string().min(1),
  mermaid: z.string().min(1).optional(),
});

const stepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
});

export const interactiveWidgetSpecSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("generic-step-flow"),
    title: z.string().min(1),
    steps: z.array(stepSchema).min(1),
  }),
  z.object({
    type: z.literal("binary-search"),
    title: z.string().min(1),
    array: z.array(z.number()).min(1),
    target: z.number(),
  }),
  z.object({
    type: z.literal("state-machine"),
    title: z.string().min(1),
    states: z.array(z.string().min(1)).min(1),
    transitions: z.array(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        on: z.string().min(1),
      }),
    ),
  }),
  z.object({
    type: z.literal("timeline"),
    title: z.string().min(1),
    events: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          detail: z.string().min(1),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("graph-traversal"),
    title: z.string().min(1),
    nodes: z.array(z.string().min(1)).min(1),
    edges: z.array(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
      }),
    ),
    start: z.string().min(1),
  }),
  z.object({
    type: z.literal("parameter-explorer"),
    title: z.string().min(1),
    formula: z.string().min(1),
    parameters: z
      .array(
        z.object({
          name: z.string().min(1),
          min: z.number(),
          max: z.number(),
          step: z.number().positive(),
          initial: z.number(),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("code-trace"),
    title: z.string().min(1),
    language: z.string().min(1),
    code: z.string().min(1),
    steps: z
      .array(
        z.object({
          id: z.string().min(1),
          line: z.number().int().positive(),
          explanation: z.string().min(1),
          locals: z.array(
            z.object({
              name: z.string().min(1),
              value: z.string().min(1),
            }),
          ),
        }),
      )
      .min(1),
  }),
]);

export const misconceptionSchema = z.object({
  misconception: z.string().min(1),
  correction: z.string().min(1),
  whyItOccurs: z.string().min(1).optional(),
});

export const verifiableClaimSchema = z.object({
  statement: z.string().min(1),
  status: z.enum(["supported", "uncertain", "unverified"]),
  note: z.string().min(1).optional(),
});

export const verificationStateSchema = z.object({
  required: z.boolean(),
  performed: z.boolean(),
  confidence: z.enum(["low", "medium", "high"]),
  claims: z.array(verifiableClaimSchema),
  caveats: z.array(z.string()),
});

export const quizItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "multiple-choice",
    "short-answer",
    "true-false",
    "ordering",
    "prediction",
  ]),
  conceptIds: z.array(z.string().min(1)).min(1),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).optional(),
  correctAnswer: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  explanation: z.string().min(1),
  difficulty: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
});

export const learningObjectiveSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  conceptIds: z.array(z.string()),
});

export const processFlowSchema = z.object({
  title: z.string().min(1),
  steps: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
      }),
    )
    .min(1),
});

export const deepDiveSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});

export const tokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
});

export const explanationDocumentSchema = z.object({
  schemaVersion: z.literal("1.0"),
  id: z.string().min(1),
  topic: z.string().min(1),
  normalizedQuestion: z.string().min(1),
  audience: z.object({
    level: learnerLevelSchema,
    assumedKnowledge: z.array(z.string()),
    desiredDepth: depthSchema,
  }),
  learningObjectives: z.array(learningObjectiveSchema).min(1),
  prerequisites: z.array(conceptRefSchema),
  essence: z.string().min(1),
  whyItMatters: z.string().min(1),
  concepts: z.array(conceptSchema).min(1),
  relationships: z.array(conceptRelationshipSchema),
  process: processFlowSchema.optional(),
  mentalModel: mentalModelSchema,
  terminology: z.array(termDefinitionSchema).min(1),
  examples: z.array(exampleSchema).min(1),
  visualizations: z.array(visualizationSpecSchema),
  interactives: z.array(interactiveWidgetSpecSchema),
  misconceptions: z.array(misconceptionSchema).min(1),
  deepDive: z.array(deepDiveSectionSchema),
  verification: verificationStateSchema,
  quiz: z.array(quizItemSchema),
  followUpSuggestions: z.array(z.string().min(1)),
  metadata: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    generatedAt: z.string().min(1),
    promptVersion: z.string().min(1),
    latencyMs: z.number().int().nonnegative().optional(),
    tokenUsage: tokenUsageSchema.optional(),
  }),
});

export const followUpResultSchema = z.object({
  reply: z.string().min(1),
  document: z.unknown(),
});

export type LearnerLevel = z.infer<typeof learnerLevelSchema>;
export type Depth = z.infer<typeof depthSchema>;
export type Concept = z.infer<typeof conceptSchema>;
export type ConceptRef = z.infer<typeof conceptRefSchema>;
export type ConceptRelationship = z.infer<typeof conceptRelationshipSchema>;
export type VisualizationSpec = z.infer<typeof visualizationSpecSchema>;
export type InteractiveWidgetSpec = z.infer<typeof interactiveWidgetSpecSchema>;
export type QuizItem = z.infer<typeof quizItemSchema>;
export type ExplanationDocument = z.infer<typeof explanationDocumentSchema>;

export const INTERACTIVE_WIDGET_TYPES = [
  "generic-step-flow",
  "binary-search",
  "state-machine",
  "timeline",
  "graph-traversal",
  "parameter-explorer",
  "code-trace",
] as const;

export const RENDERED_INTERACTIVE_TYPES = INTERACTIVE_WIDGET_TYPES;
