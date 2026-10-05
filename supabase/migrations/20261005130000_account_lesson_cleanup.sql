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
