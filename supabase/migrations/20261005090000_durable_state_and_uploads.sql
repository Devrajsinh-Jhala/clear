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
