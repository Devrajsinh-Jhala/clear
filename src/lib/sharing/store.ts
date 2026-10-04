import "server-only";

import { createFileShareStore } from "@/src/lib/sharing/file-store";
import { createSupabaseShareStore } from "@/src/lib/sharing/supabase-store";
import type { ShareStore } from "@/src/lib/sharing/types";

let cached: ShareStore | null = null;

export function getShareStore(): ShareStore {
  cached ??= createSupabaseShareStore() ?? createFileShareStore();
  return cached;
}
