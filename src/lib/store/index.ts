import "server-only";

import { createFileStore } from "@/src/lib/store/file-store";
import { createSupabaseStore } from "@/src/lib/store/supabase-store";
import type { ConversationStore } from "@/src/lib/store/types";
import { assertLocalPersistence } from "@/src/lib/storage/path";

let cached: ConversationStore | null = null;

export function getConversationStore(): ConversationStore {
  if (cached) return cached;
  cached = createSupabaseStore();
  if (!cached) { assertLocalPersistence(); cached = createFileStore(); }
  return cached;
}
