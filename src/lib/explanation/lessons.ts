import "server-only";

import { randomUUID } from "node:crypto";

import { loadLessonCredential, loadOwnCredential } from "@/src/lib/ai/credential-service";
import { byokProviderLabel, isByokProvider, parseStoredProvider } from "@/src/lib/ai/byok";
import { listApprovedTargets } from "@/src/lib/routing/available";
import { chooseRoute, isRouteProvider, shouldUseClearFreeFallback, type RouteDecision } from "@/src/lib/routing/choose";
import { readLessonMeta, readRoutingPreferences, writeLessonMeta, type CompareOption, type CompareRating, type LessonMeta } from "@/src/lib/routing/store";
import { ClearError } from "@/src/lib/api/errors";
import { continueExplanation } from "@/src/lib/explanation/follow-up";
import { reviewTeachBack } from "@/src/lib/explanation/review-teach-back";
import type { TeachBackResult } from "@/src/lib/explanation/teach-back";
import { applyTeachBackMemory } from "@/src/lib/learning/memory";
import { currentLearnerId, ensureLearnerId } from "@/src/lib/learning/session";
import { getOwnedLesson } from "@/src/lib/sharing/ownership";
import { readLearningProfile, writeLearningProfile } from "@/src/lib/learning/store";
import { MUTEX_FIXTURE } from "@/src/lib/explanation/fixtures/mutex";
import { generateExplanation } from "@/src/lib/explanation/generate";
import type { PreparedAttachment } from "@/src/lib/uploads/prepare";
import { readStoredUpload } from "@/src/lib/uploads/prepare";
import type { Depth, ExplanationDocument, LearnerLevel } from "@/src/lib/explanation/schema";
import { getConversationStore } from "@/src/lib/store";
import type { ConversationRecord, LessonAttachment } from "@/src/lib/store/types";

export async function createLesson(input: {
  question?: string;
  level: LearnerLevel;
  depth: Depth;
  customLevel?: string;
  exampleId?: "mutex";
  uploads?: PreparedAttachment[];
  model?: string;
  provider?: string;
  compareProvider?: string;
  compareModel?: string;
}): Promise<ConversationRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const ownerLearnerId = await ensureLearnerId();

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
      ownerLearnerId,
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

  if (input.compareProvider) {
    return createComparison({ ...input, question, id, now, ownerLearnerId });
  }

  const preferences = await readRoutingPreferences(await currentLearnerId());
  const available = await listApprovedTargets();
  const media = mediaFlags(input.uploads);
  const explicit = input.provider && input.provider !== "auto" && isRouteProvider(input.provider)
    ? { provider: input.provider, model: input.model ?? "" }
    : undefined;
  let decision = chooseRoute({
    question,
    sourceLength: media.sourceLength,
    hasPdf: media.hasPdf,
    hasImage: media.hasImage,
    preferences,
    available,
    explicit,
    forceAuto: input.provider === "auto",
  });
  let fallbackNote = decision.fallback
    ? "The requested provider was not available. Fallback is on, so this lesson used CLEAR Free."
    : undefined;
  let generated;
  try {
    generated = await generateFor(decision, { ...input, question });
  } catch (error) {
    if (!shouldUseClearFreeFallback({
      error,
      provider: decision.provider,
      alreadyFellBack: decision.fallback,
      fallbackAllowed: preferences.fallbackAllowed,
      clearFreeAvailable: available.some((target) => target.provider === "clear-free"),
    })) {
      throw error;
    }
    const failed = decision.provider === "clear-free" ? "CLEAR Free" : byokProviderLabel(decision.provider);
    const reason = error instanceof ClearError ? error.message : "The provider failed.";
    decision = {
      provider: "clear-free",
      model: available.find((target) => target.provider === "clear-free")?.model ?? "",
      reason: "fallback",
      fallback: true,
    };
    generated = await generateFor(decision, { ...input, question });
    fallbackNote = `${failed} failed (${reason}). Fallback is on, so this lesson used CLEAR Free.`;
  }
  const record = buildRecord({
    id,
    ownerLearnerId,
    now,
    title: generated.document.topic,
    provider: generated.providerId,
    model: generated.model,
    level: input.level,
    depth: input.depth,
    question,
    assistant: generated.document.essence,
    document: generated.document,
    attachments: storedAttachments(input.uploads),
  });
  await getConversationStore().save(record);
  if (fallbackNote) await writeLessonMeta(id, { fallbackNote });
  return record;
}

export async function addFollowUp(input: {
  conversationId: string;
  message: string;
  activeView?: string;
  provider?: string;
  model?: string;
}): Promise<ConversationRecord> {
  const store = getConversationStore();
  const existing = await getOwnedLesson(input.conversationId);
  if (!existing.document) throw new ClearError("not_found", "That lesson is not available.", { status: 404 });

  const turn = await followUpTurn(existing, input.provider, input.model);
  const continued = await continueExplanation({
    message: input.message,
    document: existing.document,
    activeView: input.activeView,
    sourceNote: sourceNote(existing.attachments),
    attachments: await imageAttachments(existing.attachments),
    model: turn.model,
    adapterId: turn.ownKey?.provider,
    credential: turn.ownKey?.credential,
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
  const existing = await getOwnedLesson(input.conversationId);
  if (!existing.document) throw new ClearError("not_found", "That lesson is not available.", { status: 404 });
  const ownKey = await savedKey(existing.activeProvider);
  const result = await reviewTeachBack(input.explanation, existing.document, {
    model: existing.activeModel,
    adapterId: ownKey?.provider,
    credential: ownKey?.credential,
  });
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
  ownerLearnerId: string;
  now: string;
  title: string;
  provider: string;
  model: string;
  level: LearnerLevel;
  depth: Depth;
  question: string;
  assistant: string;
  document: ExplanationDocument;
  attachments?: LessonAttachment[];
}): ConversationRecord {
  return {
    id: input.id,
    ownerLearnerId: input.ownerLearnerId,
    title: input.title,
    createdAt: input.now,
    updatedAt: input.now,
    activeProvider: input.provider,
    activeModel: input.model,
    level: input.level,
    depth: input.depth,
    document: input.document,
    attachments: input.attachments,
    messages: [
      { id: randomUUID(), role: "user", content: input.question, createdAt: input.now },
      { id: randomUUID(), role: "assistant", content: input.assistant, createdAt: input.now },
    ],
  };
}

async function createComparison(input: {
  question: string;
  id: string;
  ownerLearnerId: string;
  now: string;
  level: LearnerLevel;
  depth: Depth;
  customLevel?: string;
  uploads?: PreparedAttachment[];
  model?: string;
  provider?: string;
  compareProvider?: string;
  compareModel?: string;
}): Promise<ConversationRecord> {
  const rightProvider = input.compareProvider ?? "";
  if (!isRouteProvider(rightProvider)) {
    throw new ClearError("invalid_request", "Choose two providers to compare.", { status: 400 });
  }
  const available = await listApprovedTargets();
  const media = mediaFlags(input.uploads);
  const preferences = await readRoutingPreferences(await currentLearnerId());
  const left = input.provider && input.provider !== "auto" && isRouteProvider(input.provider)
    ? { provider: input.provider, model: input.model ?? "" }
    : chooseRoute({
        question: input.question,
        sourceLength: media.sourceLength,
        hasPdf: media.hasPdf,
        hasImage: media.hasImage,
        preferences,
        available,
        forceAuto: true,
      });
  if (left.provider === rightProvider && (left.model || "") === (input.compareModel || "")) {
    throw new ClearError("invalid_request", "Pick two different models to compare.", { status: 400 });
  }
  const sides = [
    { provider: left.provider, model: left.model },
    { provider: rightProvider, model: input.compareModel ?? "" },
  ];
  const options: CompareOption[] = [];
  for (const side of sides) {
    try {
      const decision = chooseRoute({
        question: input.question,
        sourceLength: media.sourceLength,
        hasPdf: media.hasPdf,
        hasImage: media.hasImage,
        preferences: { auto: false, fallbackAllowed: false, defaultTarget: { provider: "clear-free", model: "" }, tasks: {} },
        available,
        explicit: side,
      });
      const generated = await generateFor(decision, input);
      options.push({
        id: randomUUID(),
        provider: generated.providerId,
        model: generated.model,
        document: generated.document,
        ratings: [],
      });
    } catch (error) {
      options.push({
        id: randomUUID(),
        provider: side.provider,
        model: side.model,
        document: null,
        error: error instanceof ClearError ? error.message : "That model did not answer.",
        ratings: [],
      });
    }
  }
  const winner = options.find((option) => option.document);
  if (!winner?.document) {
    throw new ClearError("provider_error", options.map((option) => option.error).filter(Boolean).join(" "), {
      status: 502,
      retryable: true,
    });
  }
  const record = buildRecord({
    id: input.id,
    ownerLearnerId: input.ownerLearnerId,
    now: input.now,
    title: winner.document.topic,
    provider: winner.provider,
    model: winner.model,
    level: input.level,
    depth: input.depth,
    question: input.question,
    assistant: winner.document.essence,
    document: winner.document,
    attachments: storedAttachments(input.uploads),
  });
  await getConversationStore().save(record);
  await writeLessonMeta(input.id, { comparison: { options } });
  return record;
}

export async function chooseComparison(input: {
  conversationId: string;
  optionId: string;
  rating?: CompareRating;
  use?: boolean;
}): Promise<{ record: ConversationRecord; meta: LessonMeta }> {
  const store = getConversationStore();
  const existing = await getOwnedLesson(input.conversationId);
  const meta = await readLessonMeta(input.conversationId);
  const option = meta.comparison?.options.find((item) => item.id === input.optionId);
  if (!existing?.document || !option) {
    throw new ClearError("not_found", "That comparison is not on this lesson.", { status: 404 });
  }
  if (input.rating && !option.ratings.includes(input.rating)) option.ratings.push(input.rating);
  if (input.use) {
    if (!option.document) {
      throw new ClearError("invalid_request", "That version did not produce an explanation.", { status: 400 });
    }
    meta.comparison!.pickedId = option.id;
    const now = new Date().toISOString();
    const record: ConversationRecord = {
      ...existing,
      title: option.document.topic,
      updatedAt: now,
      activeProvider: option.provider,
      activeModel: option.model,
      document: option.document,
    };
    await store.save(record);
    await writeLessonMeta(input.conversationId, meta);
    return { record, meta };
  }
  await writeLessonMeta(input.conversationId, meta);
  return { record: existing, meta };
}

async function generateFor(
  decision: RouteDecision,
  input: {
    question: string;
    level: LearnerLevel;
    depth: Depth;
    customLevel?: string;
    uploads?: PreparedAttachment[];
  },
) {
  const ownKey = decision.provider === "clear-free" ? undefined : await loadOwnCredential(decision.provider);
  return generateExplanation({
    question: input.question,
    level: input.level,
    depth: input.depth,
    customLevel: input.customLevel,
    sourceNote: sourceNote(input.uploads),
    attachments: inlineAttachments(input.uploads),
    model: decision.model || ownKey?.model,
    adapterId: ownKey?.provider,
    credential: ownKey?.credential,
  });
}

async function followUpTurn(existing: ConversationRecord, provider: string | undefined, model: string | undefined) {
  if (provider && provider !== "same") {
    if (!isRouteProvider(provider)) {
      throw new ClearError("invalid_request", "Choose a connected provider for the next turn.", { status: 400 });
    }
    if (provider === "clear-free") return { model: model || existing.activeModel, ownKey: undefined };
    const ownKey = await loadOwnCredential(provider);
    return { model: model || ownKey.model, ownKey };
  }
  return { model: existing.activeModel, ownKey: await savedKey(existing.activeProvider) };
}

function mediaFlags(uploads?: PreparedAttachment[]) {
  const note = sourceNote(uploads) ?? "";
  return {
    sourceLength: note.length,
    hasPdf: (uploads ?? []).some((item) => item.mimeType === "application/pdf"),
    hasImage: (uploads ?? []).some((item) => item.mimeType.startsWith("image/")),
  };
}

async function savedKey(activeProvider: string) {
  const parsed = parseStoredProvider(activeProvider);
  if (!parsed.usesOwnKey) return undefined;
  if (!isByokProvider(parsed.adapterId)) {
    throw new ClearError("provider_unavailable", "That saved provider is no longer available.", { status: 400 });
  }
  return loadLessonCredential(parsed.adapterId);
}

function storedAttachments(uploads?: PreparedAttachment[]): LessonAttachment[] | undefined {
  if (!uploads?.length) return undefined;
  return uploads.map((item) => ({
    id: item.id,
    filename: item.filename,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    storageName: item.storageName,
    pageCount: item.pageCount,
    extractedText: item.extractedText,
  }));
}

function inlineAttachments(uploads?: PreparedAttachment[]) {
  return (uploads ?? [])
    .filter((item) => item.dataBase64.length > 0)
    .map((item) => ({ mimeType: item.mimeType, dataBase64: item.dataBase64 }));
}

function sourceNote(uploads?: Array<{ filename: string; pageCount?: number; extractedText?: string }>) {
  if (!uploads?.length) return undefined;
  return uploads
    .map((item) => {
      const header = `${item.filename}${item.pageCount ? ` (${item.pageCount} pages)` : ""}`;
      return item.extractedText ? `${header}\n${item.extractedText}` : header;
    })
    .join("\n\n")
    .slice(0, 30000);
}

async function imageAttachments(uploads?: LessonAttachment[]) {
  const images = [];
  for (const item of uploads ?? []) {
    if (!item.mimeType.startsWith("image/") || item.sizeBytes > 4_000_000) continue;
    const bytes = await readStoredUpload(item.storageName);
    if (!bytes) continue;
    images.push({ mimeType: item.mimeType, dataBase64: bytes.toString("base64") });
  }
  return images;
}
