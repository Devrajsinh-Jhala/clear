import { describe, expect, it } from "vitest";

import { MUTEX_FIXTURE } from "@/src/lib/explanation/fixtures/mutex";
import { evaluateTeachBackLocally, parseTeachBackResult } from "@/src/lib/explanation/teach-back";

describe("teach-back", () => {
  it("accepts an explanation that names the concepts", () => {
    const explanation = MUTEX_FIXTURE.concepts.map((concept) => concept.name).join(" holds the next idea. ");
    const result = evaluateTeachBackLocally(`${explanation} in a critical section with a mutex.`, MUTEX_FIXTURE);
    expect(result.verdict).toBe("right");
    expect(result.headline).toBe("You got this right");
    expect(result.source).toBe("lesson-concepts");
  });

  it("names concepts the learner left out", () => {
    const result = evaluateTeachBackLocally("Two threads can update one counter at the same time.", MUTEX_FIXTURE);
    expect(result.verdict).toBe("missing");
    expect(result.headline).toBe("One thing is missing");
    expect(result.missingConcepts.length).toBeGreaterThan(0);
  });

  it("rejects a model review without a repaired explanation", () => {
    expect(() => parseTeachBackResult({ verdict: "right", missingConcepts: [], misleadingStatements: [] })).toThrow();
  });
});
