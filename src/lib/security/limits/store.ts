import "server-only";

import path from "node:path";

import { limitsUnavailable } from "@/src/lib/security/limits/config";
import { createFileLimitStore } from "@/src/lib/security/limits/file-store";
import { createSupabaseLimitStore } from "@/src/lib/security/limits/supabase-store";
import type { LimitStore } from "@/src/lib/security/limits/types";

let cached: { signature: string; store: LimitStore } | undefined;

export function getLimitStore(): LimitStore {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (url || secret) {
    if (!url || !secret) throw limitsUnavailable();
    const signature = `${url}:${secret}`;
    if (cached?.signature !== signature) cached = { signature, store: createSupabaseLimitStore(url, secret) };
    return cached.store;
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTIONS_WORKER_RUNTIME) throw limitsUnavailable();
  const directory = process.env.CLEAR_LIMITS_DIRECTORY || path.join(process.env.CLEAR_DATA_DIR || path.join(process.cwd(), ".data"), "limits");
  if (process.env.NODE_ENV === "production" && !process.env.CLEAR_DATA_DIR && !process.env.CLEAR_LIMITS_DIRECTORY) throw limitsUnavailable();
  const resolved = path.resolve(/* turbopackIgnore: true */ directory);
  const signature = `file:${resolved}`;
  if (cached?.signature !== signature) cached = { signature, store: createFileLimitStore(resolved) };
  return cached.store;
}
