export type MasteryState = "new" | "introduced" | "practicing" | "understood" | "needs_review";

export type ConceptMemory = {
  key: string;
  name: string;
  state: MasteryState;
  lastSeenAt: string;
};

export type MisconceptionMemory = {
  conceptKey: string;
  statement: string;
  correction: string;
  status: "open" | "resolved";
  lastSeenAt: string;
};

export type LearningProfile = {
  enabled: boolean;
  concepts: ConceptMemory[];
  misconceptions: MisconceptionMemory[];
};

export function emptyProfile(enabled = false): LearningProfile {
  return { enabled, concepts: [], misconceptions: [] };
}

export function applyTeachBackMemory(
  profile: LearningProfile,
  input: {
    concepts: { id: string; name: string }[];
    verdict: "right" | "missing" | "incorrect";
    missingConcepts: string[];
    misleadingStatements: string[];
    repairedExplanation: string;
    seenAt: string;
  },
): LearningProfile {
  if (!profile.enabled) return profile;
  const missing = new Set(input.missingConcepts.map((name) => name.toLowerCase()));
  const concepts = [...profile.concepts];

  for (const concept of input.concepts) {
    const index = concepts.findIndex((item) => item.key === concept.id);
    const current = index >= 0 ? concepts[index] : undefined;
    const wasMissing = missing.has(concept.name.toLowerCase());
    const state = nextState(current?.state, input.verdict, wasMissing);
    const next = { key: concept.id, name: concept.name, state, lastSeenAt: input.seenAt };
    if (index >= 0) concepts[index] = next;
    else concepts.push(next);
  }

  const misconceptions = [...profile.misconceptions];
  if (input.verdict === "incorrect") {
    for (const statement of input.misleadingStatements) {
      misconceptions.push({
        conceptKey: input.concepts[0]?.id ?? "lesson",
        statement,
        correction: input.repairedExplanation,
        status: "open",
        lastSeenAt: input.seenAt,
      });
    }
  }

  return { ...profile, concepts, misconceptions };
}

function nextState(
  current: MasteryState | undefined,
  verdict: "right" | "missing" | "incorrect",
  wasMissing: boolean,
): MasteryState {
  if (verdict === "incorrect") return "needs_review";
  if (wasMissing) return current === "understood" ? "needs_review" : "practicing";
  if (verdict === "right") return "understood";
  return current ?? "introduced";
}

export function removeConcept(profile: LearningProfile, conceptKey: string): LearningProfile {
  return {
    ...profile,
    concepts: profile.concepts.filter((concept) => concept.key !== conceptKey),
    misconceptions: profile.misconceptions.filter((item) => item.conceptKey !== conceptKey),
  };
}
