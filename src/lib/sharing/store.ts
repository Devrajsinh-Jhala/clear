import "server-only";

import { createFileShareStore } from "@/src/lib/sharing/file-store";
import { createSupabaseShareStore } from "@/src/lib/sharing/supabase-store";
import type { ShareStore } from "@/src/lib/sharing/types";
import { assertLocalPersistence } from "@/src/lib/storage/path";

let cached: ShareStore | null = null;

export function getShareStore(): ShareStore {
  if (!cached) {
    cached = createSupabaseShareStore();
    if (!cached) { assertLocalPersistence(); cached = createFileShareStore(); }
  }
  return cached;
}
