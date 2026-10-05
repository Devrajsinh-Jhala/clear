import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const account = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const guest = "33333333-3333-4333-8333-333333333333";
const lesson = "44444444-4444-4444-8444-444444444444";
const date = "2026-10-05T12:00:00Z";
let db: PGlite;
let revision: string;
const record = {
  id: lesson, ownerUserId: account, ownerLearnerId: guest, title: "Private lesson", activeProvider: "sample", activeModel: "fixture",
  level: "student", depth: "balanced", createdAt: date, updatedAt: date,
  messages: [{ id: "55555555-5555-4555-8555-555555555555", role: "user", content: "Private question", createdAt: date }],
  attachments: [], document: { schemaVersion: "1", metadata: { provider: "sample", model: "fixture", promptVersion: "test" }, essence: "Private explanation" },
};

beforeAll(async () => {
  db = new PGlite();
  // Reproduce Supabase's browser roles, auth.uid and default grants. Storage APIs
  // and JWT verification need integration checks on the actual Supabase project.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    insert into auth.users values ('${account}'), ('${other}');
  `);
  const directory = path.join(process.cwd(), "supabase", "migrations");
  for (const filename of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = (await readFile(path.join(directory, filename), "utf8")).replace(/create extension if not exists pgcrypto;/i, "-- PGlite includes PostgreSQL gen_random_uuid natively.");
    await db.exec(sql);
  }
}, 60_000);
afterAll(async () => { await db?.close(); });

async function role(name: "anon" | "authenticated" | "service_role", subject = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [subject]);
  await db.exec(`set role ${name}`);
}
async function save(value: unknown, expected: string | null = null) {
  return (await db.query<{ revision: string }>("select public.clear_save_lesson($1::jsonb,$2::timestamptz)::text as revision", [JSON.stringify(value), expected])).rows[0].revision;
}
async function count(table: string) { return (await db.query<{ count: number }>(`select count(*)::int as count from public.${table}`)).rows[0].count; }

describe("PostgreSQL migrations and account isolation", () => {
  it("atomically saves every part of an account lesson as the server role", async () => {
    await role("service_role");
    revision = await save(record);
    expect(await count("conversations")).toBe(1);
    expect(await count("messages")).toBe(1);
    expect(await count("explanation_documents")).toBe(1);
    expect((await db.query<{ guest_owner_id: string | null }>("select guest_owner_id from public.conversations where id=$1", [lesson])).rows[0].guest_owner_id).toBeNull();
  });
  it("anonymous readers cannot see private lessons or children", async () => {
    await role("anon");
    for (const table of ["conversations", "messages", "explanation_documents", "attachments"]) expect(await count(table)).toBe(0);
  });
  it("another signed-in account cannot read, update or remove the owner lesson", async () => {
    await role("authenticated", other);
    for (const table of ["conversations", "messages", "explanation_documents", "attachments"]) expect(await count(table)).toBe(0);
    expect((await db.query("update public.conversations set title='Attack' returning id")).rows).toHaveLength(0);
    await expect(db.query("delete from public.conversations returning id")).rejects.toThrow();
    await expect(db.query("insert into public.conversations(id,user_id,title,active_provider,active_model) values ($1,$2,'Attack','mock','fixture')", [guest, account])).rejects.toThrow();
  });
  it("the owner can read its own lesson, but cannot remove the account ownership", async () => {
    await role("authenticated", account);
    expect(await count("conversations")).toBe(1);
    expect(await count("messages")).toBe(1);
    expect(await count("explanation_documents")).toBe(1);
    await expect(db.query("update public.conversations set user_id=null where id=$1", [lesson])).rejects.toThrow();
  });
  it.each(["anon", "authenticated"] as const)("%s cannot access secrets, snapshots, quotas or privileged save functions", async (name) => {
    await role(name, account);
    for (const table of ["clear_private_state", "lesson_share_snapshots", "clear_limit_events", "clear_limit_leases"]) await expect(count(table)).rejects.toThrow();
    await expect(save(record, revision)).rejects.toThrow();
    await expect(db.query("select public.clear_consume_limits('[]'::jsonb, null)")).rejects.toThrow();
  });
  it("rejects stale revisions and rolls back every child on a failed save", async () => {
    await role("service_role");
    await expect(save({ ...record, title: "Stale" }, "2020-01-01T00:00:00Z")).rejects.toThrow("Lesson revision changed");
    await expect(save({ ...record, title: "Partial", messages: [{ ...record.messages[0], role: "invalid" }] }, revision)).rejects.toThrow();
    expect((await db.query<{ title: string }>("select title from public.conversations where id=$1", [lesson])).rows[0].title).toBe("Private lesson");
    expect(await count("messages")).toBe(1);
    expect(await count("explanation_documents")).toBe(1);
  });
  it("forbids ownership changes even in privileged updates", async () => {
    await role("service_role");
    await expect(save({ ...record, ownerUserId: other }, revision)).rejects.toThrow("ownership cannot change");
  });
  it("keeps uploads private and enables RLS on every public product table", async () => {
    await db.exec("reset role");
    const bucket = await db.query<{ public: boolean }>("select public from storage.buckets where id='clear-uploads'");
    expect(bucket.rows[0].public).toBe(false);
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'");
    expect(tables.rows.length).toBeGreaterThan(15);
    expect(tables.rows.every((table) => table.relrowsecurity)).toBe(true);
  });
});

const deletionLesson = "66666666-6666-4666-8666-666666666666";
const media = "88888888-8888-4888-8888-888888888888.pdf";
const deletionRecord = {
  ...record,
  id: deletionLesson,
  messages: [{ ...record.messages[0], id: "77777777-7777-4777-8777-777777777777" }],
  attachments: [{ id: "88888888-8888-4888-8888-888888888888", filename: "Private upload name.pdf", mimeType: "application/pdf", sizeBytes: 12, storageName: media }],
};
async function deleteLesson(owner = account) {
  return (await db.query<{ deleted: boolean }>("select public.clear_delete_account_lesson($1,$2) as deleted", [deletionLesson, owner])).rows[0].deleted;
}
async function lessonCount(table: string) {
  const column = table === "conversations" ? "id" : "conversation_id";
  return (await db.query<{ count: number }>(`select count(*)::int as count from public.${table} where ${column}=$1`, [deletionLesson])).rows[0].count;
}

describe("transactional account deletion and private cleanup outbox", () => {
  let deletionRevision: string;
  beforeEach(async () => {
    await role("service_role");
    await db.query("delete from public.conversations where id=$1", [deletionLesson]);
    await db.query("delete from public.clear_lesson_cleanup_jobs where conversation_id=$1", [deletionLesson]);
    await db.query("delete from public.clear_private_state where namespace='lesson-meta' and record_key=$1", [deletionLesson]);
    deletionRevision = await save(deletionRecord);
    await db.query("insert into public.clear_private_state(namespace,record_key,value) values ('lesson-meta',$1,$2::jsonb)", [deletionLesson, JSON.stringify({ comparison: "Private comparison content" })]);
  });
  it.each(["anon", "authenticated"] as const)("%s cannot read/change jobs, execute deletion RPC, or bypass it with direct DELETE", async (name) => {
    await role(name, account);
    await expect(db.query("select * from public.clear_lesson_cleanup_jobs")).rejects.toThrow();
    await expect(db.query("insert into public.clear_lesson_cleanup_jobs(conversation_id,owner_user_id,storage_names) values ($1,$2,'{}')", [deletionLesson, account])).rejects.toThrow();
    await expect(db.query("delete from public.clear_lesson_cleanup_jobs")).rejects.toThrow();
    await expect(deleteLesson()).rejects.toThrow();
    await expect(db.query("delete from public.conversations where id=$1", [deletionLesson])).rejects.toThrow();
  });
  it("refuses foreign-account and guest deletion without removing original references or metadata", async () => {
    expect(await deleteLesson(other)).toBe(false);
    expect(await lessonCount("conversations")).toBe(1);
    expect(await lessonCount("attachments")).toBe(1);
    expect(await lessonCount("clear_lesson_cleanup_jobs")).toBe(0);
    expect((await db.query<{ value: unknown }>("select value from public.clear_private_state where namespace='lesson-meta' and record_key=$1", [deletionLesson])).rows[0].value).toEqual({ comparison: "Private comparison content" });
    await db.query("update public.conversations set user_id=null,guest_owner_id=$2 where id=$1", [deletionLesson, guest]);
    expect(await deleteLesson(account)).toBe(false);
    expect(await lessonCount("conversations")).toBe(1);
  });
  it("commits owner deletion/cascades and only server-derived paths in one transaction", async () => {
    await db.query("insert into public.saved_lessons(user_id,conversation_id) values ($1,$2)", [account, deletionLesson]);
    await db.query("insert into public.lesson_share_snapshots(conversation_id,slug,document,shared_at,source_updated_at) values ($1,$2,'{}',$3,$3)", [deletionLesson, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", date]);
    expect(await deleteLesson()).toBe(true);
    for (const table of ["conversations", "messages", "explanation_documents", "attachments", "saved_lessons", "lesson_share_snapshots"]) expect(await lessonCount(table)).toBe(0);
    const jobs = await db.query<{ owner_user_id: string; storage_names: string[] }>("select owner_user_id,storage_names from public.clear_lesson_cleanup_jobs where conversation_id=$1", [deletionLesson]);
    expect(jobs.rows).toEqual([{ owner_user_id: account, storage_names: [media] }]);
    // Lesson-meta is cleaned only after committed deletion, not before it.
    expect((await db.query("select value from public.clear_private_state where namespace='lesson-meta' and record_key=$1", [deletionLesson])).rows).toHaveLength(1);
    expect(await deleteLesson()).toBe(true);
    expect(await deleteLesson(other)).toBe(false);
    expect(await lessonCount("clear_lesson_cleanup_jobs")).toBe(1);
  });
  it("rolls back the outbox and every cascade if deleting the parent fails", async () => {
    await db.exec("reset role");
    await db.exec(`
      create function public.clear_test_reject_delete() returns trigger language plpgsql as $$ begin raise exception 'Synthetic delete failure'; end; $$;
      create trigger clear_test_reject_delete before delete on public.conversations for each row when (old.id='${deletionLesson}') execute function public.clear_test_reject_delete();
    `);
    await role("service_role");
    try {
      await expect(deleteLesson()).rejects.toThrow("Synthetic delete failure");
      for (const table of ["conversations", "messages", "explanation_documents", "attachments"]) expect(await lessonCount(table)).toBe(1);
      expect(await lessonCount("clear_lesson_cleanup_jobs")).toBe(0);
      expect((await db.query<{ storage_path: string }>("select storage_path from public.attachments where conversation_id=$1", [deletionLesson])).rows[0].storage_path).toBe(media);
      expect((await db.query<{ value: unknown }>("select value from public.clear_private_state where namespace='lesson-meta' and record_key=$1", [deletionLesson])).rows[0].value).toEqual({ comparison: "Private comparison content" });
    } finally {
      await db.exec("reset role");
      await db.exec("drop trigger clear_test_reject_delete on public.conversations; drop function public.clear_test_reject_delete();");
      await role("service_role");
    }
  });
  it("rejects malformed storage paths before deleting the lesson", async () => {
    await db.query("update public.attachments set storage_path='../foreign/private.pdf' where conversation_id=$1", [deletionLesson]);
    await expect(deleteLesson()).rejects.toThrow("Invalid cleanup paths");
    expect(await lessonCount("conversations")).toBe(1);
    expect(await lessonCount("attachments")).toBe(1);
    expect(await lessonCount("clear_lesson_cleanup_jobs")).toBe(0);
  });
  it("captures the latest committed attachments and rejects a stale turn after deletion", async () => {
    const currentMedia = "99999999-9999-4999-8999-999999999999.png";
    const currentRecord = { ...deletionRecord, attachments: [{ ...deletionRecord.attachments[0], storageName: currentMedia, mimeType: "image/png" }] };
    const currentRevision = await save(currentRecord, deletionRevision);
    expect(await deleteLesson()).toBe(true);
    expect((await db.query<{ storage_names: string[] }>("select storage_names from public.clear_lesson_cleanup_jobs where conversation_id=$1", [deletionLesson])).rows[0].storage_names).toEqual([currentMedia]);
    await expect(save(currentRecord, currentRevision)).rejects.toThrow("Lesson revision changed");
    expect(await lessonCount("conversations")).toBe(0);
    expect(await lessonCount("clear_lesson_cleanup_jobs")).toBe(1);
  });
});
