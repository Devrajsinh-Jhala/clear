import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { defaultClearFreeModel } from "@/src/lib/ai/models";
import { ClearError } from "@/src/lib/api/errors";
import { currentAccount } from "@/src/lib/auth/session";
import { projectExplanation } from "@/src/lib/export/document";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import { ensureLearnerId } from "@/src/lib/learning/session";
import { getOwnedLesson, getReadableLesson } from "@/src/lib/sharing/ownership";
import { getShareStore } from "@/src/lib/sharing/store";
import { validShareSlug, type ShareSnapshot, type ShareStatus } from "@/src/lib/sharing/types";
import { getConversationStore } from "@/src/lib/store";
import type { ConversationRecord } from "@/src/lib/store/types";

export { getOwnedLesson } from "@/src/lib/sharing/ownership";
export type { ShareStatus } from "@/src/lib/sharing/types";

export async function readPublicShare(shareId: string): Promise<{ document: ExplanationDocument; sharedAt: string } | null> {
  if (!validShareSlug(shareId)) return null;
  const snapshot = await getShareStore().getBySlug(shareId);
  if (!snapshot) return null;
  // This allowlist is the public contract. No lesson identifiers or operational settings.
  return { document: snapshot.document, sharedAt: snapshot.sharedAt };
}

export async function getShareStatus(id: string): Promise<ShareStatus> {
  const record = await getOwnedLesson(id);
  return statusFor(await getShareStore().getForLesson(id), record.updatedAt);
}

export async function publishShare(id: string, options: { showProvider: boolean }): Promise<ShareStatus> {
  const record = await getOwnedLesson(id);
  if (!record.document) throw new ClearError("not_found", "That lesson is not available.", { status: 404 });
  const now = new Date().toISOString();
  const snapshot: ShareSnapshot = {
    conversationId: id,
    slug: randomBytes(24).toString("base64url"),
    document: projectExplanation(record.document, { includeProvider: options.showProvider, exportedAt: now }),
    showProvider: options.showProvider,
    sharedAt: now,
    sourceUpdatedAt: record.updatedAt,
  };
  await getShareStore().replace(snapshot);
  return statusFor(snapshot, record.updatedAt);
}

export async function revokeShare(id: string): Promise<ShareStatus> {
  await getOwnedLesson(id);
  await getShareStore().revoke(id);
  return { active: false, stale: false };
}

/** Copy only a legacy teaching document; it never confers ownership of its old record. */
export async function copyLegacyLesson(id: string): Promise<ConversationRecord> {
  const access = await getReadableLesson(id);
  if (!access.legacy || !access.record.document) {
    throw new ClearError("invalid_request", "Only an older read-only lesson needs a private copy.", { status: 400 });
  }
  const ownerLearnerId = await ensureLearnerId();
  const now = new Date().toISOString();
  const copyId = randomUUID();
  const document = projectExplanation(access.record.document, { includeProvider: false, exportedAt: now });
  document.id = copyId;
  document.metadata = { provider: "clear-copy", model: "not-selected", promptVersion: "clear-copy", generatedAt: now };
  const record: ConversationRecord = {
    id: copyId,
    ownerLearnerId,
    ownerUserId: (await currentAccount())?.id,
    title: document.topic,
    createdAt: now,
    updatedAt: now,
    activeProvider: "clear-free",
    activeModel: defaultClearFreeModel(),
    level: document.audience.level,
    depth: document.audience.desiredDepth,
    messages: [],
    document,
  };
  await getConversationStore().save(record);
  return record;
}

function statusFor(snapshot: ShareSnapshot | null, currentUpdatedAt: string): ShareStatus {
  if (!snapshot) return { active: false, stale: false };
  return {
    active: true,
    stale: new Date(snapshot.sourceUpdatedAt).getTime() !== new Date(currentUpdatedAt).getTime(),
    path: `/shared/${snapshot.slug}`,
    showProvider: snapshot.showProvider,
    sharedAt: snapshot.sharedAt,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
  };
}
