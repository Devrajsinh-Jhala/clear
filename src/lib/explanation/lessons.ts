import "server-only";

import { randomUUID } from "node:crypto";

import { ClearError } from "@/src/lib/api/errors";
import { continueExplanation } from "@/src/lib/explanation/follow-up";
import { reviewTeachBack } from "@/src/lib/explanation/review-teach-back";
import type { TeachBackResult } from "@/src/lib/explanation/teach-back";
import { applyTeachBackMemory } from "@/src/lib/learning/memory";
import { currentLearnerId } from "@/src/lib/learning/session";
import { readLearningProfile, writeLearningProfile } from "@/src/lib/learning/store";
import { MUTEX_FIXTURE } from "@/src/lib/explanation/fixtures/mutex";
import { generateExplanation } from "@/src/lib/explanation/generate";
import type { Depth, ExplanationDocument, LearnerLevel } from "@/src/lib/explanation/schema";
import { getConversationStore } from "@/src/lib/store";
import type { ConversationRecord } from "@/src/lib/store/types";

export async function createLesson(input: {
  question?: string;
  level: LearnerLevel;
  depth: Depth;
  customLevel?: string;
  exampleId?: "mutex";
}): Promise<ConversationRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();

  if (input.exampleId === "mutex") {
    const document: ExplanationDocument = {
      ...structuredClone(MUTEX_FIXTURE),
      id,
      audience: {
        ...MUTEX_FIXTURE.audience,
        level: input.level,
        desiredDepth: input.depth,
      },
      metadata: {
        ...MUTEX_FIXTURE.metadata,
        generatedAt: now,
      },
    };
    const record = buildRecord({
      id,
      now,
      title: document.topic,
      provider: "sample",
      model: "clear-example",
      level: input.level,
      depth: input.depth,
      question: document.normalizedQuestion,
      assistant: document.essence,
      document,
    });
    await getConversationStore().save(record);
    return record;
  }

  const question = input.question?.trim();
  if (!question) {
    throw new ClearError("invalid_request", "Enter a question to explain.", { status: 400 });
  }

  const generated = await generateExplanation({
    question,
    level: input.level,
    depth: input.depth,
    customLevel: input.customLevel,
  });
  const record = buildRecord({
    id,
    now,
    title: generated.document.topic,
    provider: generated.providerId,
    model: generated.model,
    level: input.level,
    depth: input.depth,
    question,
    assistant: generated.document.essence,
    document: generated.document,
  });
  await getConversationStore().save(record);
  return record;
}

export async function addFollowUp(input: {
  conversationId: string;
  message: string;
  activeView?: string;
}): Promise<ConversationRecord> {
  const store = getConversationStore();
  const existing = await store.get(input.conversationId);
  if (!existing?.document) {
    throw new ClearError("not_found", "That lesson is not on this server.", { status: 404 });
  }

  const continued = await continueExplanation({
    message: input.message,
    document: existing.document,
    activeView: input.activeView,
  });
  const now = new Date().toISOString();
  const record: ConversationRecord = {
    ...existing,
    title: continued.document.topic,
    updatedAt: now,
    activeProvider: continued.providerId,
    activeModel: continued.model,
    document: continued.document,
    messages: [
      ...existing.messages,
      { id: randomUUID(), role: "user", content: input.message, createdAt: now, kind: "follow-up" },
      { id: randomUUID(), role: "assistant", content: continued.reply, createdAt: now, kind: "follow-up" },
    ],
  };
  await store.save(record);
  return record;
}

export async function submitTeachBack(input: {
  conversationId: string;
  explanation: string;
}): Promise<{ record: ConversationRecord; result: TeachBackResult }> {
  const store = getConversationStore();
  const existing = await store.get(input.conversationId);
  if (!existing?.document) {
    throw new ClearError("not_found", "That lesson is not on this server.", { status: 404 });
  }
  const result = await reviewTeachBack(input.explanation, existing.document);
  const now = new Date().toISOString();
  const learnerId = await currentLearnerId();
  if (learnerId) {
    const profile = await readLearningProfile(learnerId);
    await writeLearningProfile(
      learnerId,
      applyTeachBackMemory(profile, {
        concepts: existing.document.concepts.map((concept) => ({ id: concept.id, name: concept.name })),
        verdict: result.verdict,
        missingConcepts: result.missingConcepts,
        misleadingStatements: result.misleadingStatements,
        repairedExplanation: result.repairedExplanation,
        seenAt: now,
      }),
    );
  }
  const record: ConversationRecord = {
    ...existing,
    updatedAt: now,
    messages: [
      ...existing.messages,
      { id: randomUUID(), role: "user", content: input.explanation, createdAt: now, kind: "teach-back" },
      { id: randomUUID(), role: "assistant", content: result.headline, createdAt: now, kind: "teach-back" },
    ],
  };
  await store.save(record);
  return { record, result };
}

function buildRecord(input: {
  id: string;
  now: string;
  title: string;
  provider: string;
  model: string;
  level: LearnerLevel;
  depth: Depth;
  question: string;
  assistant: string;
  document: ExplanationDocument;
}): ConversationRecord {
  return {
    id: input.id,
    title: input.title,
    createdAt: input.now,
    updatedAt: input.now,
    activeProvider: input.provider,
    activeModel: input.model,
    level: input.level,
    depth: input.depth,
    document: input.document,
    messages: [
      { id: randomUUID(), role: "user", content: input.question, createdAt: input.now },
      { id: randomUUID(), role: "assistant", content: input.assistant, createdAt: input.now },
    ],
  };
}
