import "server-only";

import { createFileStore } from "@/src/lib/store/file-store";
import { createSupabaseStore } from "@/src/lib/store/supabase-store";
import type { ConversationStore } from "@/src/lib/store/types";

let cached: ConversationStore | null = null;

export function getConversationStore(): ConversationStore {
  if (cached) return cached;
  cached = createSupabaseStore() ?? createFileStore();
  return cached;
}
