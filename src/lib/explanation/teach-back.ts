import { z } from "zod";

import { ClearError } from "@/src/lib/api/errors";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";

export const teachBackResultSchema = z.object({
  verdict: z.enum(["right", "missing", "incorrect"]),
  missingConcepts: z.array(z.string()),
  misleadingStatements: z.array(z.string()),
  repairedExplanation: z.string().min(1),
});

export type TeachBackResult = z.infer<typeof teachBackResultSchema> & {
  headline: string;
  source: "model" | "lesson-concepts";
};

const HEADLINES = {
  right: "You got this right",
  missing: "One thing is missing",
  incorrect: "This part is slightly incorrect",
} as const;

export function withHeadline(
  result: z.infer<typeof teachBackResultSchema>,
  source: TeachBackResult["source"],
): TeachBackResult {
  return { ...result, headline: HEADLINES[result.verdict], source };
}

export function evaluateTeachBackLocally(
  explanation: string,
  document: ExplanationDocument,
): TeachBackResult {
  const words = explanation.trim().split(/\s+/).filter(Boolean);
  const haystack = explanation.toLowerCase();
  const missingConcepts = document.concepts
    .filter((concept) => !haystack.includes(concept.name.toLowerCase()))
    .map((concept) => concept.name);

  if (words.length < 12 || missingConcepts.length === document.concepts.length) {
    return withHeadline(
      {
        verdict: "missing",
        missingConcepts: missingConcepts.length > 0 ? missingConcepts : document.concepts.map((concept) => concept.name),
        misleadingStatements: [],
        repairedExplanation: document.essence,
      },
      "lesson-concepts",
    );
  }

  if (missingConcepts.length === 0) {
    return withHeadline(
      {
        verdict: "right",
        missingConcepts: [],
        misleadingStatements: [],
        repairedExplanation: document.essence,
      },
      "lesson-concepts",
    );
  }

  return withHeadline(
    {
      verdict: "missing",
      missingConcepts,
      misleadingStatements: [],
      repairedExplanation: `${document.essence} Still name: ${missingConcepts.join(", ")}.`,
    },
    "lesson-concepts",
  );
}

export function parseTeachBackResult(raw: unknown): TeachBackResult {
  const source = unwrap(raw);
  const parsed = teachBackResultSchema.safeParse({
    verdict: source.verdict,
    missingConcepts: stringList(source.missingConcepts),
    misleadingStatements: stringList(source.misleadingStatements),
    repairedExplanation: typeof source.repairedExplanation === "string" ? source.repairedExplanation.trim() : "",
  });
  if (!parsed.success) {
    throw new ClearError("schema_invalid", "The teach-back review did not come back in a usable form.", {
      retryable: true,
      status: 502,
      details: parsed.error.issues.slice(0, 8).map((issue) => issue.message),
    });
  }
  return withHeadline(parsed.data, "model");
}

function unwrap(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
