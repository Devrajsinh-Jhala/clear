import "server-only";

import { createClient } from "@supabase/supabase-js";

import { ClearError } from "@/src/lib/api/errors";
import { isUuid } from "@/src/lib/explanation/normalize";
import { accountLearnerId } from "@/src/lib/learning/identity";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import type { ConversationMessage, ConversationRecord, ConversationStore } from "@/src/lib/store/types";

type ConversationRow = {
  id: string;
  guest_owner_id: string | null;
  user_id: string | null;
  title: string;
  active_provider: string;
  active_model: string;
  level: ConversationRecord["level"];
  depth: ConversationRecord["depth"];
  created_at: string;
  updated_at: string;
};

type AttachmentRow = {
  id: string;
  mime_type: string;
  storage_path: string;
  size_bytes: number;
  metadata: { filename?: string; pageCount?: number; extractedText?: string } | null;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: { text?: string; kind?: "follow-up" | "teach-back" };
  created_at: string;
};

export function createSupabaseStore(): ConversationStore | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null;

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async get(id) {
      if (!isUuid(id)) return null;
      const { data: conversation, error } = await supabase
        .from("conversations")
        .select("id, guest_owner_id, user_id, title, active_provider, active_model, level, depth, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw databaseError(error.message);
      if (!conversation) return null;

      const { data: messages, error: messageError } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });
      if (messageError) throw databaseError(messageError.message);

      const { data: documents, error: documentError } = await supabase
        .from("explanation_documents")
        .select("document, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (documentError) throw databaseError(documentError.message);

      const { data: attachments, error: attachmentError } = await supabase
        .from("attachments")
        .select("id, mime_type, storage_path, size_bytes, metadata")
        .eq("conversation_id", id);
      if (attachmentError) throw databaseError(attachmentError.message);

      const row = conversation as ConversationRow;
      return {
        id: row.id,
        ownerLearnerId: row.user_id ? accountLearnerId(row.user_id) : row.guest_owner_id ?? undefined,
        ownerUserId: row.user_id ?? undefined,
        title: row.title,
        createdAt: new Date(row.created_at).toISOString(),
        // Preserve PostgreSQL microseconds: this is also the optimistic revision.
        updatedAt: row.updated_at,
        activeProvider: row.active_provider,
        activeModel: row.active_model,
        level: row.level,
        depth: row.depth,
        messages: ((messages ?? []) as MessageRow[])
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({
            id: message.id,
            role: message.role as ConversationMessage["role"],
            content: message.content?.text ?? "",
            createdAt: message.created_at,
            kind: message.content?.kind,
          })),
        document: (documents?.[0]?.document as ExplanationDocument | undefined) ?? null,
        attachments: ((attachments ?? []) as AttachmentRow[]).map((item) => ({
          id: item.id,
          filename: typeof item.metadata?.filename === "string" ? item.metadata.filename : "upload",
          mimeType: item.mime_type,
          sizeBytes: item.size_bytes,
          storageName: item.storage_path,
          pageCount: typeof item.metadata?.pageCount === "number" ? item.metadata.pageCount : undefined,
          extractedText: typeof item.metadata?.extractedText === "string" ? item.metadata.extractedText : undefined,
        })),
      };
    },
    async save(record, expectedUpdatedAt) {
      if (!isUuid(record.id)) throw new Error("Refusing to store a conversation with an invalid id.");
      const { data, error } = await supabase.rpc("clear_save_lesson", {
        p_record: record,
        p_expected_updated_at: expectedUpdatedAt ?? null,
      });
      if (error?.code === "40001") {
        throw new ClearError("lesson_changed", "This lesson changed in another tab. Reload it before trying again.", { status: 409 });
      }
      if (error) throw databaseError(error.message);
      if (typeof data !== "string") throw databaseError("Missing saved lesson revision.");
      record.updatedAt = data;
    },
  };
}

function databaseError(message: string): ClearError {
  if (/schema cache|does not exist|PGRST205/i.test(message)) {
    return new ClearError("database_not_ready", "Supabase is connected, but the CLEAR schema is not ready. Apply the migrations in supabase/migrations, then try again.", { status: 503 });
  }
  return new ClearError("storage_unavailable", "Your saved lesson could not be reached. Please try again.", { status: 503, retryable: true });
}
