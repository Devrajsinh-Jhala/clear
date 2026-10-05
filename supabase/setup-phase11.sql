-- CLEAR Phase 11: run once in the Supabase Dashboard SQL Editor as project owner.
-- Prerequisites already applied:
--   migrations/20261004120000_init.sql
--   migrations/20261004160000_private_guests_and_shares.sql
-- These five 20261005 migrations must not have been applied individually.
-- Paste and run this entire file, including BEGIN and COMMIT, in one operation.
-- Success returns: CLEAR Phase 11 schema setup complete.
-- On an error, the changes roll back together. If your editor keeps an aborted
-- transaction open, run ROLLBACK; before fixing the error and retrying the full file.
-- Repeating a completed setup intentionally fails; do not run isolated sections.

BEGIN;

-- BEGIN MIGRATION: 20261005090000_durable_state_and_uploads.sql
-- Server-only state for guest/account credentials, preferences, memory and comparison notes.
-- Provider secrets are encrypted before insertion. No browser role can read this table.
create table public.clear_private_state (
  namespace text not null check (namespace in ('credentials', 'learning', 'routing', 'lesson-meta')),
  record_key text not null check (record_key ~ '^(account/[a-fA-F0-9-]{36}/)?[a-fA-F0-9-]{36}(/[a-z-]{1,20})?$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (namespace, record_key)
);
alter table public.clear_private_state enable row level security;
revoke all on public.clear_private_state from anon, authenticated;
grant all on public.clear_private_state to service_role;

-- Original media never has a public URL. Only the server can read/write this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clear-uploads', 'clear-uploads', false, 10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- END MIGRATION: 20261005090000_durable_state_and_uploads.sql

-- BEGIN MIGRATION: 20261005100000_usage_limits.sql
-- Server-only admissions shared by every application instance. No raw IP address,
-- guest identity, question, provider key or attachment enters these tables.
create table if not exists public.clear_limit_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  occurred_at timestamptz not null default now()
);
create index if not exists clear_limit_events_bucket_time_idx on public.clear_limit_events (bucket, occurred_at);
create index if not exists clear_limit_events_time_idx on public.clear_limit_events (occurred_at);

create table if not exists public.clear_limit_leases (
  bucket text not null,
  token uuid not null,
  expires_at timestamptz not null,
  primary key (bucket, token)
);
create index if not exists clear_limit_leases_expiry_idx on public.clear_limit_leases (expires_at);

alter table public.clear_limit_events enable row level security;
alter table public.clear_limit_leases enable row level security;
revoke all on public.clear_limit_events, public.clear_limit_leases from anon, authenticated;
grant all on public.clear_limit_events, public.clear_limit_leases to service_role;
grant usage, select on sequence public.clear_limit_events_id_seq to service_role;

create or replace function public.clear_consume_limits(p_charges jsonb, p_lease jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_charge jsonb;
  v_key text;
  v_start timestamptz;
  v_expiry timestamptz;
  v_count bigint;
  v_limit integer;
  v_amount integer;
  v_window integer;
  v_mode text;
  v_kind text;
begin
  if jsonb_typeof(p_charges) <> 'array' or jsonb_array_length(p_charges) > 16 then
    raise exception 'Invalid limit admission';
  end if;
  for v_charge in select value from jsonb_array_elements(p_charges) loop
    v_key := v_charge ->> 'key';
    v_limit := (v_charge ->> 'limit')::integer;
    v_amount := (v_charge ->> 'amount')::integer;
    v_window := (v_charge ->> 'windowMs')::integer;
    v_mode := v_charge ->> 'mode';
    v_kind := v_charge ->> 'kind';
    if v_key is null or v_key !~ '^[a-zA-Z0-9:_-]{1,200}$'
      or v_limit is null or v_limit < 0 or v_limit > 1000000
      or v_amount is null or v_amount < 1 or v_amount > 10
      or v_window is null or v_window < 1000 or v_window > 86400000
      or v_mode is null or v_mode not in ('rolling', 'utc-day')
      or v_kind is null or v_kind not in ('rate', 'guest-quota', 'ip-quota', 'global-quota') then
      raise exception 'Invalid limit admission';
    end if;
  end loop;
  if p_lease is not null and p_lease <> 'null'::jsonb then
    if (p_lease ->> 'key') is null or (p_lease ->> 'key') !~ '^[a-zA-Z0-9:_-]{1,200}$'
      or (p_lease ->> 'token') is null
      or (p_lease ->> 'limit') is null or (p_lease ->> 'limit')::integer < 0 or (p_lease ->> 'limit')::integer > 1000000
      or (p_lease ->> 'ttlMs') is null or (p_lease ->> 'ttlMs')::integer < 1000 or (p_lease ->> 'ttlMs')::integer > 120000 then
      raise exception 'Invalid provider lease';
    end if;
    perform (p_lease ->> 'token')::uuid;
  end if;

  -- Always lock in the same order, including absent buckets. Transaction-scoped
  -- advisory locks prevent concurrent requests from exceeding a daily budget.
  for v_key in
    select distinct bucket from (
      select value ->> 'key' as bucket from jsonb_array_elements(p_charges)
      union all select p_lease ->> 'key' where p_lease is not null and p_lease <> 'null'::jsonb
    ) keys order by bucket
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_key, 713011));
  end loop;
  delete from public.clear_limit_events where occurred_at < v_now - interval '24 hours';
  delete from public.clear_limit_leases where expires_at <= v_now;

  for v_charge in select value from jsonb_array_elements(p_charges) loop
    v_key := v_charge ->> 'key';
    v_limit := (v_charge ->> 'limit')::integer;
    v_amount := (v_charge ->> 'amount')::integer;
    v_window := (v_charge ->> 'windowMs')::integer;
    v_mode := v_charge ->> 'mode';
    v_start := case when v_mode = 'utc-day'
      then date_trunc('day', timezone('UTC', v_now)) at time zone 'UTC'
      else v_now - make_interval(secs => v_window / 1000.0) end;
    select count(*) into v_count from public.clear_limit_events
      where bucket = v_key and (occurred_at > v_start or (v_mode = 'utc-day' and occurred_at = v_start));
    if v_count + v_amount > v_limit then
      if v_mode = 'utc-day' then
        v_expiry := v_start + interval '24 hours';
      else
        select occurred_at + make_interval(secs => v_window / 1000.0) into v_expiry
          from public.clear_limit_events where bucket = v_key and occurred_at > v_start
          order by occurred_at offset greatest(0, v_count + v_amount - v_limit - 1) limit 1;
        v_expiry := coalesce(v_expiry, v_now + make_interval(secs => v_window / 1000.0));
      end if;
      return jsonb_build_object('allowed', false, 'kind', v_charge ->> 'kind',
        'retryAfterSeconds', greatest(1, ceil(extract(epoch from (v_expiry - v_now)))::integer));
    end if;
  end loop;
  if p_lease is not null and p_lease <> 'null'::jsonb then
    select count(*), min(expires_at) into v_count, v_expiry from public.clear_limit_leases where bucket = p_lease ->> 'key';
    if v_count >= (p_lease ->> 'limit')::integer then
      return jsonb_build_object('allowed', false, 'kind', 'concurrency',
        'retryAfterSeconds', greatest(1, ceil(extract(epoch from (coalesce(v_expiry, v_now + interval '120 seconds') - v_now)))::integer));
    end if;
  end if;
  for v_charge in select value from jsonb_array_elements(p_charges) loop
    insert into public.clear_limit_events (bucket, occurred_at)
      select v_charge ->> 'key', v_now from generate_series(1, (v_charge ->> 'amount')::integer);
  end loop;
  if p_lease is not null and p_lease <> 'null'::jsonb then
    insert into public.clear_limit_leases (bucket, token, expires_at)
      values (p_lease ->> 'key', (p_lease ->> 'token')::uuid,
        v_now + make_interval(secs => (p_lease ->> 'ttlMs')::integer / 1000.0));
  end if;
  return jsonb_build_object('allowed', true);
end;
$$;

create or replace function public.clear_release_limit_lease(p_key text, p_token uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_key, 713011));
  delete from public.clear_limit_leases where bucket = p_key and token = p_token;
end;
$$;

revoke all on function public.clear_consume_limits(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.clear_release_limit_lease(text, uuid) from public, anon, authenticated;
grant execute on function public.clear_consume_limits(jsonb, jsonb) to service_role;
grant execute on function public.clear_release_limit_lease(text, uuid) to service_role;

-- END MIGRATION: 20261005100000_usage_limits.sql

-- BEGIN MIGRATION: 20261005110000_atomic_lesson_save.sql
-- Only the server, after ownership/verified-auth checks, may save complete lessons.
-- Failed child writes roll back the parent and every child in this transaction.
update public.conversations set guest_owner_id = null where user_id is not null;
create or replace function public.clear_save_lesson(p_record jsonb, p_expected_updated_at timestamptz default null)
returns timestamptz
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  lesson_id uuid := (p_record->>'id')::uuid;
  previous public.conversations%rowtype;
  revision timestamptz;
  item jsonb;
  doc jsonb := p_record->'document';
begin
  perform pg_advisory_xact_lock(hashtextextended(lesson_id::text, 1));
  select * into previous from public.conversations where id = lesson_id for update;
  if found then
    if p_expected_updated_at is null or previous.updated_at <> p_expected_updated_at then
      raise exception 'Lesson revision changed' using errcode = '40001';
    end if;
    if previous.guest_owner_id is distinct from (case when p_record->>'ownerUserId' is null then (p_record->>'ownerLearnerId')::uuid else null end)
       or previous.user_id is distinct from (p_record->>'ownerUserId')::uuid then
      raise exception 'Lesson ownership cannot change' using errcode = '42501';
    end if;
  elsif p_expected_updated_at is not null then
    raise exception 'Lesson revision changed' using errcode = '40001';
  end if;
  insert into public.conversations (id, user_id, guest_owner_id, title, active_provider, active_model, level, depth, created_at, updated_at)
  values (lesson_id, (p_record->>'ownerUserId')::uuid, case when p_record->>'ownerUserId' is null then (p_record->>'ownerLearnerId')::uuid else null end,
    p_record->>'title', p_record->>'activeProvider', p_record->>'activeModel',
    p_record->>'level', p_record->>'depth', (p_record->>'createdAt')::timestamptz, (p_record->>'updatedAt')::timestamptz)
  on conflict (id) do update set title = excluded.title, active_provider = excluded.active_provider,
    active_model = excluded.active_model, level = excluded.level, depth = excluded.depth, updated_at = excluded.updated_at
  returning updated_at into revision;
  delete from public.messages where conversation_id = lesson_id;
  for item in select value from jsonb_array_elements(coalesce(p_record->'messages', '[]'::jsonb)) loop
    insert into public.messages (id, conversation_id, role, content, provider, model, created_at)
    values ((item->>'id')::uuid, lesson_id, item->>'role', jsonb_build_object('text', item->>'content', 'kind', item->'kind'),
      p_record->>'activeProvider', p_record->>'activeModel', (item->>'createdAt')::timestamptz);
  end loop;
  if doc is not null and doc <> 'null'::jsonb then
    insert into public.explanation_documents (id, conversation_id, schema_version, document, provider, model, prompt_version, created_at)
    values (gen_random_uuid(), lesson_id, doc->>'schemaVersion', doc,
      doc->'metadata'->>'provider', doc->'metadata'->>'model', doc->'metadata'->>'promptVersion', revision);
  end if;
  delete from public.attachments where conversation_id = lesson_id;
  for item in select value from jsonb_array_elements(coalesce(p_record->'attachments', '[]'::jsonb)) loop
    insert into public.attachments (id, conversation_id, user_id, type, mime_type, storage_path, size_bytes, metadata)
    values ((item->>'id')::uuid, lesson_id, (p_record->>'ownerUserId')::uuid,
      case when item->>'mimeType' = 'application/pdf' then 'pdf' else 'image' end,
      item->>'mimeType', item->>'storageName', (item->>'sizeBytes')::bigint,
      jsonb_build_object('filename', item->>'filename', 'pageCount', item->'pageCount', 'extractedText', item->'extractedText'));
  end loop;
  return revision;
end;
$$;
revoke all on function public.clear_save_lesson(jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.clear_save_lesson(jsonb, timestamptz) to service_role;

-- END MIGRATION: 20261005110000_atomic_lesson_save.sql

-- BEGIN MIGRATION: 20261005120000_account_library.sql
-- Keep attachment references server-authored so a library deletion cannot be
-- tricked into deleting a different lesson's object via a forged storage_path.
revoke insert, update, delete on public.attachments from anon, authenticated;
grant select on public.attachments to authenticated;
grant all on public.attachments to service_role;

-- Canonical lesson content is validated and written through server routes.
-- The account library can change only its title/archive fields under owner RLS.
revoke insert, update on public.conversations from anon, authenticated;
grant select, delete on public.conversations to authenticated;
grant update (title, archived_at) on public.conversations to authenticated;
grant all on public.conversations to service_role;
revoke insert, update, delete on public.messages, public.explanation_documents from anon, authenticated;
grant select on public.messages, public.explanation_documents to authenticated;
grant all on public.messages, public.explanation_documents to service_role;
grant select, insert, update, delete on public.saved_lessons to authenticated;

drop policy if exists "own saved lessons" on public.saved_lessons;
create policy "own saved lessons" on public.saved_lessons
for all to authenticated
using (
  auth.uid() = user_id and exists (
    select 1 from public.conversations c
    where c.id = saved_lessons.conversation_id and c.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id and exists (
    select 1 from public.conversations c
    where c.id = saved_lessons.conversation_id and c.user_id = auth.uid()
  )
);

-- END MIGRATION: 20261005120000_account_library.sql

-- BEGIN MIGRATION: 20261005130000_account_lesson_cleanup.sql
-- Keep deletion atomic while media storage is unavailable. Jobs deliberately
-- have no conversation FK: they must survive the parent deletion/cascades.
create table public.clear_lesson_cleanup_jobs (
  conversation_id uuid primary key,
  owner_user_id uuid not null,
  storage_names text[] not null check (cardinality(storage_names) <= 100),
  created_at timestamptz not null default now()
);
create index clear_lesson_cleanup_jobs_owner_created_idx on public.clear_lesson_cleanup_jobs (owner_user_id, created_at);
alter table public.clear_lesson_cleanup_jobs enable row level security;
revoke all on public.clear_lesson_cleanup_jobs from public, anon, authenticated;
grant all on public.clear_lesson_cleanup_jobs to service_role;

-- Browser DELETE would bypass cleanup jobs. Rename/archive remain owner-RLS
-- operations; deletion is available only through the verified server service.
revoke delete on public.conversations from anon, authenticated;

create or replace function public.clear_delete_account_lesson(p_conversation_id uuid, p_owner_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  previous public.conversations%rowtype;
  names text[];
  pending_owner uuid;
begin
  if p_conversation_id is null or p_owner_user_id is null then
    return false;
  end if;
  -- Match clear_save_lesson's lock so a concurrent turn cannot write attachments
  -- between deriving the cleanup paths and committing the parent deletion.
  perform pg_advisory_xact_lock(hashtextextended(p_conversation_id::text, 1));
  select * into previous from public.conversations where id = p_conversation_id for update;
  if not found then
    select owner_user_id into pending_owner from public.clear_lesson_cleanup_jobs where conversation_id = p_conversation_id;
    return coalesce(pending_owner = p_owner_user_id, false);
  end if;
  if previous.user_id is distinct from p_owner_user_id then
    return false;
  end if;
  select coalesce(array_agg(distinct storage_path), array[]::text[]) into names
    from public.attachments where conversation_id = p_conversation_id;
  if cardinality(names) > 100 or exists (
    select 1 from unnest(names) as path where path is null or path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp|gif|pdf)$'
  ) then
    raise exception 'Invalid cleanup paths';
  end if;
  insert into public.clear_lesson_cleanup_jobs (conversation_id, owner_user_id, storage_names)
    values (p_conversation_id, p_owner_user_id, names);
  -- A failed delete rolls back the job too. Original media and lesson-meta are
  -- untouched until the application observes this committed transaction.
  delete from public.conversations where id = p_conversation_id and user_id = p_owner_user_id;
  if not found then
    raise exception 'Lesson deletion changed';
  end if;
  return true;
end;
$$;
revoke all on function public.clear_delete_account_lesson(uuid, uuid) from public, anon, authenticated;
grant execute on function public.clear_delete_account_lesson(uuid, uuid) to service_role;

-- END MIGRATION: 20261005130000_account_lesson_cleanup.sql

COMMIT;

SELECT 'CLEAR Phase 11 schema setup complete' AS status;
