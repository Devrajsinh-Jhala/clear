-- Apply after the initial schema. Existing guest records intentionally remain ownerless/read-only.
alter table public.conversations add column guest_owner_id uuid;
create index conversations_guest_owner_idx on public.conversations (guest_owner_id) where guest_owner_id is not null;

-- One current snapshot per lesson makes replacement atomic and invalidates the old slug.
-- The service role performs every access after the server's browser-ownership check.
create table public.lesson_share_snapshots (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  slug text not null unique check (slug ~ '^[A-Za-z0-9_-]{32}$'),
  document jsonb not null,
  show_provider boolean not null default false,
  shared_at timestamptz not null,
  source_updated_at timestamptz not null
);
alter table public.lesson_share_snapshots enable row level security;
-- No anonymous/authenticated policy: public links are projected by the application server.
revoke all on public.lesson_share_snapshots from anon, authenticated;
grant all on public.lesson_share_snapshots to service_role;
