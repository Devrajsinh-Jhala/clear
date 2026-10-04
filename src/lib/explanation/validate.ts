import { ClearError } from "@/src/lib/api/errors";
import { validateConsistency } from "@/src/lib/explanation/consistency";
import {
  parseJsonText,
  prepareModelDocument,
  type DocumentStamp,
} from "@/src/lib/explanation/normalize";
import {
  explanationDocumentSchema,
  type Depth,
  type ExplanationDocument,
  type LearnerLevel,
} from "@/src/lib/explanation/schema";

export type AudienceInput = {
  level: LearnerLevel;
  desiredDepth: Depth;
  assumedKnowledge?: string[];
};

type Repair = (issues: string[], invalid: unknown) => Promise<unknown>;

export async function acceptModelOutput(input: {
  raw: unknown;
  question: string;
  audience: AudienceInput;
  stamp: DocumentStamp;
  repair?: Repair;
}): Promise<ExplanationDocument> {
  const first = evaluate(input.raw, input);
  if (first.document) return first.document;
  if (!input.repair) {
    throw invalidOutput(first.issues);
  }

  let repairedRaw: unknown;
  try {
    repairedRaw = await input.repair(first.issues, first.normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Repair request failed.";
    throw new ClearError("schema_invalid", message, {
      retryable: true,
      status: 502,
      details: first.issues,
    });
  }

  const second = evaluate(repairedRaw, input);
  if (second.document) return second.document;
  throw invalidOutput(second.issues);
}

function evaluate(
  raw: unknown,
  input: { question: string; audience: AudienceInput; stamp: DocumentStamp },
): { document?: ExplanationDocument; issues: string[]; normalized: unknown } {
  const normalized = prepareModelDocument(coerceRaw(raw), input);
  const parsed = explanationDocumentSchema.safeParse(normalized);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      normalized,
    };
  }
  const consistency = validateConsistency(parsed.data);
  if (consistency.length > 0) {
    return {
      issues: consistency.map((issue) => `${issue.path}: ${issue.message}`),
      normalized,
    };
  }
  return { document: parsed.data, issues: [], normalized };
}

function coerceRaw(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return parseJsonText(raw);
  } catch {
    return {};
  }
}

function invalidOutput(issues: string[]): ClearError {
  return new ClearError(
    "schema_invalid",
    "The explanation did not match CLEAR's format. Try again.",
    { retryable: true, status: 502, details: issues.slice(0, 12) },
  );
}
