import "server-only";

import { createClient } from "@supabase/supabase-js";

import { ClearError } from "@/src/lib/api/errors";
import { isUuid } from "@/src/lib/explanation/normalize";
import { shareSnapshotSchema, validShareSlug, type ShareSnapshot, type ShareStore } from "@/src/lib/sharing/types";

export function createSupabaseShareStore(): ShareStore | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  async function read(column: "conversation_id" | "slug", value: string) {
    const { data, error } = await supabase.from("lesson_share_snapshots").select("*").eq(column, value).maybeSingle();
    if (error) throw storeError();
    if (!data) return null;
    const parsed = shareSnapshotSchema.safeParse({
      conversationId: data.conversation_id,
      slug: data.slug,
      document: data.document,
      showProvider: data.show_provider,
      sharedAt: new Date(data.shared_at).toISOString(),
      sourceUpdatedAt: new Date(data.source_updated_at).toISOString(),
    });
    return parsed.success ? parsed.data : null;
  }

  return {
    async getForLesson(id) { return isUuid(id) ? read("conversation_id", id) : null; },
    async getBySlug(slug) { return validShareSlug(slug) ? read("slug", slug) : null; },
    async replace(snapshot: ShareSnapshot) {
      const parsed = shareSnapshotSchema.parse(snapshot);
      const { error } = await supabase.from("lesson_share_snapshots").upsert({
        conversation_id: parsed.conversationId,
        slug: parsed.slug,
        document: parsed.document,
        show_provider: parsed.showProvider,
        shared_at: parsed.sharedAt,
        source_updated_at: parsed.sourceUpdatedAt,
      }, { onConflict: "conversation_id" });
      if (error) throw storeError();
    },
    async revoke(id) {
      if (!isUuid(id)) throw new Error("Invalid lesson id.");
      const { error } = await supabase.from("lesson_share_snapshots").delete().eq("conversation_id", id);
      if (error) throw storeError();
    },
  };
}

function storeError() {
  return new ClearError("share_storage_unavailable", "Sharing is unavailable. Check the database migrations and try again.", { status: 503, retryable: true });
}
