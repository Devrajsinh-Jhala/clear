import { describe, expect, it } from "vitest";

import { MUTEX_FIXTURE } from "@/src/lib/explanation/fixtures/mutex";
import { appendTranscript, lessonTranscript, teachBackTranscript } from "@/src/lib/voice/transcript";

describe("canonical voice transcript", () => {
  it("narrates the lesson mechanism without executable diagram or widget specs", () => {
    const text = lessonTranscript(MUTEX_FIXTURE, "understand");
    expect(text).toContain(MUTEX_FIXTURE.essence);
    expect(text).toContain(MUTEX_FIXTURE.concepts[0].definition);
    expect(text).toContain("Factual verification was not performed");
    for (const caveat of MUTEX_FIXTURE.verification.caveats) expect(text).toContain(caveat);
    expect(text).not.toContain("flowchart");
    expect(text).not.toContain('"correctAnswer"');
  });

  it("keeps the analogy label and limitations together", () => {
    const text = lessonTranscript(MUTEX_FIXTURE, "mental-model");
    expect(text).toContain("Analogy.");
    expect(text).toContain("Where the analogy stops.");
    for (const limit of MUTEX_FIXTURE.mentalModel.analogy!.limitations) expect(text).toContain(limit);
  });

  it("includes example takeaways and gives an empty deep dive a next action", () => {
    expect(lessonTranscript(MUTEX_FIXTURE, "examples")).toContain(MUTEX_FIXTURE.examples[0].takeaway);
    expect(lessonTranscript({ ...MUTEX_FIXTURE, deepDive: [] }, "deep-dive")).toContain("Ask a follow-up");
  });

  it("does not present a local teach-back check as model review", () => {
    const text = teachBackTranscript({
      verdict: "missing", headline: "One thing is missing", source: "lesson-concepts",
      missingConcepts: ["Mutex"], misleadingStatements: [], repairedExplanation: MUTEX_FIXTURE.essence,
    });
    expect(text).toContain("A model did not review the wording.");
    expect(text).toContain("Missing. Mutex");
    expect(text).toContain(MUTEX_FIXTURE.essence);
  });

  it("appends dictated words without discarding a typed draft and caps its length", () => {
    expect(appendTranscript("Why does", " this work? ", 2000)).toBe("Why does this work?");
    expect(appendTranscript("", "Mutex", 4)).toBe("Mute");
    expect(appendTranscript("Typed words", "   ", 2000)).toBe("Typed words");
  });
});
