import "server-only";

import { createClient } from "@supabase/supabase-js";

import { ClearError } from "@/src/lib/api/errors";
import { isUuid } from "@/src/lib/explanation/normalize";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import type { ConversationMessage, ConversationRecord, ConversationStore } from "@/src/lib/store/types";

type ConversationRow = {
  id: string;
  guest_owner_id: string | null;
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
        .select("id, guest_owner_id, title, active_provider, active_model, level, depth, created_at, updated_at")
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
        ownerLearnerId: row.guest_owner_id ?? undefined,
        title: row.title,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
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
    async save(record) {
      if (!isUuid(record.id)) throw new Error("Refusing to store a conversation with an invalid id.");
      const { error: conversationError } = await supabase.from("conversations").upsert({
        id: record.id,
        guest_owner_id: record.ownerLearnerId ?? null,
        user_id: null,
        title: record.title,
        active_provider: record.activeProvider,
        active_model: record.activeModel,
        level: record.level,
        depth: record.depth,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      });
      if (conversationError) throw databaseError(conversationError.message);

      await supabase.from("messages").delete().eq("conversation_id", record.id);
      if (record.messages.length > 0) {
        const { error: messageError } = await supabase.from("messages").insert(
          record.messages.map((message) => ({
            id: message.id,
            conversation_id: record.id,
            role: message.role,
            content: { text: message.content, kind: message.kind },
            provider: record.activeProvider,
            model: record.activeModel,
            created_at: message.createdAt,
          })),
        );
        if (messageError) throw databaseError(messageError.message);
      }

      if (record.document) {
        const { error: documentError } = await supabase.from("explanation_documents").insert({
          id: crypto.randomUUID(),
          conversation_id: record.id,
          schema_version: record.document.schemaVersion,
          document: record.document,
          provider: record.document.metadata.provider,
          model: record.document.metadata.model,
          prompt_version: record.document.metadata.promptVersion,
          created_at: record.updatedAt,
        });
        if (documentError) throw databaseError(documentError.message);
      }

      await supabase.from("attachments").delete().eq("conversation_id", record.id);
      if (record.attachments && record.attachments.length > 0) {
        const { error: attachmentError } = await supabase.from("attachments").insert(
          record.attachments.map((attachment) => ({
            id: attachment.id,
            conversation_id: record.id,
            type: attachment.mimeType === "application/pdf" ? "pdf" : "image",
            mime_type: attachment.mimeType,
            storage_path: attachment.storageName,
            size_bytes: attachment.sizeBytes,
            metadata: {
              filename: attachment.filename,
              pageCount: attachment.pageCount,
              extractedText: attachment.extractedText,
            },
          })),
        );
        if (attachmentError) throw databaseError(attachmentError.message);
      }
    },
  };
}

function databaseError(message: string): Error {
  if (/schema cache|does not exist|PGRST205/i.test(message)) {
    return new ClearError(
      "database_not_ready",
      "Supabase is connected, but the CLEAR schema is not ready. Apply the migrations in supabase/migrations, then try again.",
      { status: 503 },
    );
  }
  return new Error(message);
}
