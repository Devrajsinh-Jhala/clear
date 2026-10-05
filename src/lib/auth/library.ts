import "server-only";

import { ClearError } from "@/src/lib/api/errors";
import { createAuthClient } from "@/src/lib/auth/server";
import { requireAccount } from "@/src/lib/auth/session";
import { isUuid } from "@/src/lib/explanation/normalize";
import { flushMonitoring, reportServerError } from "@/src/lib/monitoring/server";
import { storageAdmin } from "@/src/lib/storage/admin";
import { deletePrivateState } from "@/src/lib/storage/state";
import { cleanupPreparedUploads } from "@/src/lib/uploads/prepare";

export type LibraryLesson = {
  id: string;
  title: string;
  provider: string;
  model: string;
  updatedAt: string;
  archived: boolean;
  favorite: boolean;
};

export type LibraryChange = { action: "rename"; title: string } | { action: "favorite"; favorite: boolean } | { action: "archive"; archived: boolean };
export type LibraryDeletion = { deleted: true; cleanupPending: boolean };

type CleanupJob = { conversation_id: string; owner_user_id: string; storage_names: string[] };
type AdminClient = NonNullable<ReturnType<typeof storageAdmin>>;
const CLEANUP_BATCH_SIZE = 5;

async function accountClient() {
  const account = await requireAccount();
  const client = await createAuthClient();
  if (!client) throw unavailable();
  return { client, account };
}

export async function listAccountLessons(): Promise<LibraryLesson[]> {
  const { client, account } = await accountClient();
  const [lessons, saved] = await Promise.all([
    client.from("conversations").select("id,title,active_provider,active_model,updated_at,archived_at").eq("user_id", account.id).order("updated_at", { ascending: false }).limit(100),
    client.from("saved_lessons").select("conversation_id").eq("user_id", account.id),
  ]);
  if (lessons.error || saved.error) throw unavailable();
  // Retrying is bounded and never prevents access to the remaining library.
  // Jobs retain ownership after their conversation has been deleted.
  await retryPendingCleanup(account.id);
  const favorites = new Set((saved.data ?? []).map((row) => row.conversation_id));
  return (lessons.data ?? []).filter((row) => isUuid(row.id)).map((row) => ({
    id: row.id,
    title: row.title,
    provider: row.active_provider,
    model: row.active_model,
    updatedAt: row.updated_at,
    archived: Boolean(row.archived_at),
    favorite: favorites.has(row.id),
  }));
}

async function ownedLesson(id: string) {
  if (!isUuid(id)) throw notFound();
  const { client, account } = await accountClient();
  const { data, error } = await client.from("conversations").select("id").eq("id", id).eq("user_id", account.id).maybeSingle();
  if (error) throw unavailable();
  if (!data) throw notFound();
  return { client, account };
}

export async function updateAccountLesson(id: string, change: LibraryChange): Promise<void> {
  const { client, account } = await ownedLesson(id);
  if (change.action === "favorite") {
    const result = change.favorite
      ? await client.from("saved_lessons").upsert({ user_id: account.id, conversation_id: id }, { onConflict: "user_id,conversation_id" })
      : await client.from("saved_lessons").delete().eq("user_id", account.id).eq("conversation_id", id);
    if (result.error) throw unavailable();
    return;
  }
  const update = change.action === "rename" ? { title: change.title } : { archived_at: change.archived ? new Date().toISOString() : null };
  const { data, error } = await client.from("conversations").update(update).eq("id", id).eq("user_id", account.id).select("id");
  if (error) throw unavailable();
  if (!data?.length) throw notFound();
}

export async function deleteAccountLesson(id: string): Promise<LibraryDeletion> {
  if (!isUuid(id)) throw notFound();
  const account = await requireAccount();
  const admin = storageAdmin();
  if (!admin) throw unavailable();
  // The RPC checks this verified account against the stored owner, serializes with
  // lesson saves, and atomically commits deletion/cascades plus the cleanup job.
  // Request data never supplies the account or storage paths.
  const { data, error } = await admin.rpc("clear_delete_account_lesson", { p_conversation_id: id, p_owner_user_id: account.id });
  if (error) throw unavailable();
  if (data === false) throw notFound();
  if (data !== true) throw unavailable();
  try {
    const result = await admin.from("clear_lesson_cleanup_jobs").select("conversation_id,owner_user_id,storage_names")
      .eq("conversation_id", id).eq("owner_user_id", account.id).maybeSingle();
    if (result.error) throw unavailable();
    // A concurrent retry may already have completed and acknowledged the job.
    if (!result.data) return { deleted: true, cleanupPending: false };
    const completed = await completeCleanup(admin, result.data, account.id);
    if (!completed) await flushMonitoring();
    return { deleted: true, cleanupPending: !completed };
  } catch (error) {
    reportServerError(error, { operation: "storage", code: "storage_unavailable" });
    await flushMonitoring();
    return { deleted: true, cleanupPending: true };
  }
}

async function retryPendingCleanup(ownerId: string): Promise<void> {
  try {
    const admin = storageAdmin();
    if (!admin) return;
    const { data, error } = await admin.from("clear_lesson_cleanup_jobs").select("conversation_id,owner_user_id,storage_names")
      .eq("owner_user_id", ownerId).order("created_at", { ascending: true }).limit(CLEANUP_BATCH_SIZE);
    if (error || !Array.isArray(data)) throw unavailable();
    let failed = false;
    for (const job of data.slice(0, CLEANUP_BATCH_SIZE)) if (!(await completeCleanup(admin, job, ownerId))) failed = true;
    if (failed) await flushMonitoring();
  } catch (error) {
    reportServerError(error, { operation: "storage", code: "storage_unavailable" });
    await flushMonitoring();
  }
}

async function completeCleanup(admin: AdminClient, value: unknown, ownerId: string): Promise<boolean> {
  try {
    if (!validCleanupJob(value, ownerId)) throw unavailable();
    // Both operations are idempotent. Never acknowledge until both succeed, so
    // partial object removal, metadata failure, and acknowledgement failure retry.
    await cleanupPreparedUploads(value.storage_names.map((storageName) => ({ storageName })));
    await deletePrivateState("lesson-meta", value.conversation_id);
    const { error } = await admin.from("clear_lesson_cleanup_jobs").delete()
      .eq("conversation_id", value.conversation_id).eq("owner_user_id", ownerId);
    if (error) throw unavailable();
    return true;
  } catch (error) {
    reportServerError(error, { operation: "storage", code: "storage_unavailable" });
    return false;
  }
}

function validCleanupJob(value: unknown, ownerId: string): value is CleanupJob {
  if (!value || typeof value !== "object" || !("conversation_id" in value) || !("owner_user_id" in value) || !("storage_names" in value)) return false;
  return typeof value.conversation_id === "string" && isUuid(value.conversation_id) && value.owner_user_id === ownerId
    && Array.isArray(value.storage_names) && value.storage_names.length <= 100
    && value.storage_names.every((name: unknown) => typeof name === "string" && /^[0-9a-f-]{36}\.(png|jpg|webp|gif|pdf)$/i.test(name) && isUuid(name.slice(0, 36)));
}

function notFound() { return new ClearError("not_found", "That saved lesson is not available.", { status: 404 }); }
function unavailable() { return new ClearError("storage_unavailable", "Your library could not be reached. Please try again shortly.", { status: 503, retryable: true }); }
