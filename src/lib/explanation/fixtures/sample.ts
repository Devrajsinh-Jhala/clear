import type { DocumentStamp } from "@/src/lib/explanation/normalize";
import type { AudienceInput } from "@/src/lib/explanation/validate";

export function buildSampleModelOutput(question: string): Record<string, unknown> {
  const topic = question.trim().slice(0, 80) || "Untitled question";
  return {
    topic,
    normalizedQuestion: question.trim(),
    learningObjectives: [
      {
        id: "grasp-the-idea",
        statement: `Explain ${topic} without skipping the mechanism.`,
        conceptIds: ["core-idea"],
      },
    ],
    prerequisites: [],
    essence: `${topic} is best learned by naming the mechanism, then checking it against one concrete case.`,
    whyItMatters: "A correct short explanation gives you a model you can test, instead of a pile of terms.",
    concepts: [
      {
        id: "core-idea",
        name: "Core idea",
        definition: `The core idea is the mechanism that makes ${topic} work.`,
        plainExplanation: "Start with what changes, what causes the change, and what would make the explanation false.",
        importance: "Later details only help after this mechanism is stable.",
        dependsOn: [],
      },
    ],
    relationships: [],
    mentalModel: {
      intuition: "Hold one mechanism still, then vary one assumption and see what changes.",
    },
    terminology: [
      { term: "Mechanism", definition: "The part of the explanation that says what actually happens, not only what it is called." },
    ],
    examples: [
      {
        id: "worked-case",
        title: "One concrete case",
        setup: `Use a small instance of this question: ${topic}`,
        walkthrough: [
          "Name the starting state.",
          "Apply the mechanism once.",
          "Check the result against the essence.",
        ],
        takeaway: "If the small case fails, the essence is not ready yet.",
      },
    ],
    visualizations: [],
    interactives: [],
    misconceptions: [
      {
        misconception: "A familiar analogy is the same thing as the mechanism.",
        correction: "An analogy is an intuition aid. The mechanism still has to be stated on its own.",
      },
    ],
    deepDive: [],
    verification: {
      required: false,
      performed: false,
      confidence: "medium",
      claims: [],
      caveats: ["This sample was produced locally and was not checked against an external source."],
    },
    quiz: [],
    followUpSuggestions: ["Show a worked example.", "Where does the simple picture break?"],
  };
}

export function sampleStamp(provider = "mock"): DocumentStamp {
  return {
    id: crypto.randomUUID(),
    provider,
    model: provider === "mock" ? "clear-mock" : "clear-example",
    promptVersion: "canonical-explanation.v1",
  };
}

export function sampleAudience(level: AudienceInput["level"] = "student", desiredDepth: AudienceInput["desiredDepth"] = "balanced"): AudienceInput {
  return { level, desiredDepth, assumedKnowledge: [] };
}
