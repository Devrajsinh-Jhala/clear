import { describe, expect, it } from "vitest";

import { applyTeachBackMemory, emptyProfile, removeConcept } from "@/src/lib/learning/memory";

const concepts = [
  { id: "mutex", name: "Mutex" },
  { id: "thread", name: "Thread" },
];

describe("learning memory", () => {
  it("does nothing while memory is off", () => {
    const profile = emptyProfile(false);
    const next = applyTeachBackMemory(profile, {
      concepts,
      verdict: "right",
      missingConcepts: [],
      misleadingStatements: [],
      repairedExplanation: "A mutex serializes a critical section.",
      seenAt: "2026-10-04T00:00:00.000Z",
    });
    expect(next.concepts).toEqual([]);
  });

  it("marks named concepts understood and missing ones as practicing", () => {
    const next = applyTeachBackMemory(emptyProfile(true), {
      concepts,
      verdict: "missing",
      missingConcepts: ["Thread"],
      misleadingStatements: [],
      repairedExplanation: "A mutex lets one thread in.",
      seenAt: "2026-10-04T00:00:00.000Z",
    });
    expect(next.concepts.find((concept) => concept.key === "mutex")?.state).toBe("introduced");
    expect(next.concepts.find((concept) => concept.key === "thread")?.state).toBe("practicing");
  });

  it("marks a correct teach-back as understood", () => {
    const next = applyTeachBackMemory(emptyProfile(true), {
      concepts,
      verdict: "right",
      missingConcepts: [],
      misleadingStatements: [],
      repairedExplanation: "One owner at a time.",
      seenAt: "2026-10-04T00:00:00.000Z",
    });
    expect(next.concepts.every((concept) => concept.state === "understood")).toBe(true);
  });

  it("deletes one concept and its notes", () => {
    const profile = applyTeachBackMemory(emptyProfile(true), {
      concepts,
      verdict: "incorrect",
      missingConcepts: [],
      misleadingStatements: ["Any lock is enough."],
      repairedExplanation: "Both threads must use the same mutex.",
      seenAt: "2026-10-04T00:00:00.000Z",
    });
    const next = removeConcept(profile, "mutex");
    expect(next.concepts.map((concept) => concept.key)).toEqual(["thread"]);
    expect(next.misconceptions.every((item) => item.conceptKey !== "mutex")).toBe(true);
  });
});
