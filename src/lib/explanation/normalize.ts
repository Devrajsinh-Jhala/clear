import { relationshipTypeSchema, visualizationTypeSchema, type Depth, type LearnerLevel } from "@/src/lib/explanation/schema";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "item";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const source = fenced?.[1] ?? trimmed;
  return JSON.parse(source);
}

export function uniqueSlug(base: string, used: Set<string>): string {
  let slug = slugify(base);
  let attempt = 2;
  while (used.has(slug)) {
    slug = `${slugify(base)}-${attempt}`;
    attempt += 1;
  }
  used.add(slug);
  return slug;
}

type AudienceInput = {
  level: LearnerLevel;
  desiredDepth: Depth;
  assumedKnowledge?: string[];
};

export type DocumentStamp = {
  id: string;
  provider: string;
  model: string;
  promptVersion: string;
  generatedAt?: string;
  latencyMs?: number;
  tokenUsage?: { inputTokens?: number; outputTokens?: number };
};

export function prepareModelDocument(
  raw: unknown,
  input: { question: string; audience: AudienceInput; stamp: DocumentStamp },
): unknown {
  const source = unwrapDocument(raw);
  const concepts = normalizeConcepts(source.concepts);
  const conceptIds = new Set(concepts.map((concept) => String(concept.id)));

  return {
    schemaVersion: "1.0",
    id: input.stamp.id,
    topic: stringOr(source.topic, input.question.slice(0, 80)),
    normalizedQuestion: stringOr(source.normalizedQuestion, input.question),
    audience: {
      level: input.audience.level,
      desiredDepth: input.audience.desiredDepth,
      assumedKnowledge: stringList(
        isRecord(source.audience) ? source.audience.assumedKnowledge : input.audience.assumedKnowledge,
      ),
    },
    learningObjectives: normalizeObjectives(source.learningObjectives, conceptIds),
    prerequisites: normalizeRefs(source.prerequisites),
    essence: stringOr(source.essence, ""),
    whyItMatters: stringOr(source.whyItMatters, ""),
    concepts,
    relationships: normalizeRelationships(source.relationships),
    process: source.process,
    mentalModel: isRecord(source.mentalModel) ? source.mentalModel : { intuition: "" },
    terminology: Array.isArray(source.terminology) ? source.terminology : [],
    examples: normalizeExamples(source.examples),
    visualizations: normalizeVisualizations(source.visualizations),
    interactives: Array.isArray(source.interactives) ? source.interactives : [],
    misconceptions: Array.isArray(source.misconceptions) ? source.misconceptions : [],
    deepDive: Array.isArray(source.deepDive) ? source.deepDive : [],
    verification: isRecord(source.verification)
      ? source.verification
      : {
          required: false,
          performed: false,
          confidence: "medium",
          claims: [],
          caveats: ["External verification was not performed."],
        },
    quiz: normalizeQuiz(source.quiz),
    followUpSuggestions: stringList(source.followUpSuggestions).slice(0, 6),
    metadata: {
      provider: input.stamp.provider,
      model: input.stamp.model,
      generatedAt: input.stamp.generatedAt ?? new Date().toISOString(),
      promptVersion: input.stamp.promptVersion,
      latencyMs: input.stamp.latencyMs,
      tokenUsage: input.stamp.tokenUsage,
    },
  };
}

function unwrapDocument(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  if (!raw.essence && isRecord(raw.document)) return raw.document;
  return raw;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeConcepts(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  return value.filter(isRecord).map((concept) => {
    const name = stringOr(concept.name, "Concept");
    const id = stringOr(concept.id, name);
    return {
      ...concept,
      id: uniqueSlug(id, used),
      name,
      dependsOn: stringList(concept.dependsOn),
    };
  });
}

function normalizeRefs(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((ref) => ({
    id: slugify(stringOr(ref.id, stringOr(ref.name, "concept"))),
    name: stringOr(ref.name, stringOr(ref.id, "Concept")),
  }));
}

function normalizeObjectives(value: unknown, conceptIds: Set<string>): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  return value.filter(isRecord).map((objective) => ({
    id: uniqueSlug(stringOr(objective.id, stringOr(objective.statement, "objective")), used),
    statement: stringOr(objective.statement, ""),
    conceptIds: stringList(objective.conceptIds).filter((id) => conceptIds.has(id)),
  }));
}

function normalizeExamples(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  return value.filter(isRecord).map((example) => ({
    ...example,
    id: uniqueSlug(stringOr(example.id, stringOr(example.title, "example")), used),
    walkthrough: stringList(example.walkthrough),
  }));
}

function normalizeVisualizations(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  return value.filter(isRecord).map((visualization) => ({
    ...visualization,
    id: uniqueSlug(stringOr(visualization.id, stringOr(visualization.title, "visual")), used),
    type: knownLabel(visualization.type, visualizationTypeSchema.options) ?? visualization.type,
  }));
}

// Models sometimes name a relationship outside the fixed list ("prevents", "enables").
// The sentence in `explanation` carries the meaning, so an unknown label becomes the
// neutral "related-to" instead of failing the whole lesson.
function normalizeRelationships(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((relationship) => isRecord(relationship)
    ? { ...relationship, type: knownLabel(relationship.type, relationshipTypeSchema.options) ?? "related-to" }
    : relationship);
}

/** Matches a label to an allowed value, ignoring case, spaces and underscores. */
function knownLabel<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== "string") return undefined;
  const slug = slugify(value);
  return allowed.find((option) => option === slug);
}

function normalizeQuiz(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  return value.filter(isRecord).map((item) => ({
    ...item,
    id: uniqueSlug(stringOr(item.id, "quiz"), used),
    conceptIds: stringList(item.conceptIds),
    difficulty: normalizeDifficulty(item.difficulty),
  }));
}

function normalizeDifficulty(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5) return 2;
  return number;
}
