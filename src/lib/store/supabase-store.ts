import "server-only";

import { createClient } from "@supabase/supabase-js";

import { isUuid } from "@/src/lib/explanation/normalize";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import type { ConversationMessage, ConversationRecord, ConversationStore } from "@/src/lib/store/types";

type ConversationRow = {
  id: string;
  title: string;
  active_provider: string;
  active_model: string;
  level: ConversationRecord["level"];
  depth: ConversationRecord["depth"];
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: { text?: string; kind?: "follow-up" | "teach-back" };
  created_at: string;
};

export function createSupabaseStore(): ConversationStore | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async get(id) {
      if (!isUuid(id)) return null;
      const { data: conversation, error } = await supabase
        .from("conversations")
        .select("id, title, active_provider, active_model, level, depth, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error || !conversation) return null;

      const { data: messages } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      const { data: documents } = await supabase
        .from("explanation_documents")
        .select("document, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .limit(1);

      const row = conversation as ConversationRow;
      return {
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
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
      };
    },
    async save(record) {
      if (!isUuid(record.id)) throw new Error("Refusing to store a conversation with an invalid id.");
      const { error: conversationError } = await supabase.from("conversations").upsert({
        id: record.id,
        user_id: null,
        title: record.title,
        active_provider: record.activeProvider,
        active_model: record.activeModel,
        level: record.level,
        depth: record.depth,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      });
      if (conversationError) throw new Error(conversationError.message);

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
        if (messageError) throw new Error(messageError.message);
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
        if (documentError) throw new Error(documentError.message);
      }
    },
  };
}
