-- Initial CLEAR schema. Apply with the Supabase CLI or SQL editor.
-- Guest lessons can stay on the application server until auth is connected.
-- Saved provider keys are ciphertext only. The service role bypasses RLS;
-- browser clients never receive ciphertext or plaintext secrets.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  default_level text not null default 'student',
  default_depth text not null default 'balanced',
  learning_memory_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete cascade,
  title text not null,
  active_provider text not null,
  active_model text not null,
  level text not null default 'student',
  depth text not null default 'balanced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.messages (
  id uuid primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content jsonb not null,
  provider text,
  model text,
  created_at timestamptz not null default now()
);

create table public.explanation_documents (
  id uuid primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid references public.messages (id) on delete set null,
  schema_version text not null,
  document jsonb not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key,
  conversation_id uuid references public.conversations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  type text not null,
  mime_type text not null,
  storage_path text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  encrypted_secret text not null,
  nonce text not null,
  auth_tag text not null,
  masked_suffix text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.provider_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  model text not null,
  is_default boolean not null default false,
  routing_category text,
  fallback_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.concept_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  concept_key text not null,
  concept_name text not null,
  domain text,
  state text not null check (state in ('new', 'introduced', 'practicing', 'understood', 'needs_review')),
  confidence text,
  evidence jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, concept_key)
);

create table public.misconceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  concept_key text not null,
  statement text not null,
  correction text not null,
  status text not null default 'open',
  last_seen_at timestamptz not null default now()
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  quiz_item_id text not null,
  concept_ids jsonb not null default '[]'::jsonb,
  answer jsonb not null,
  correct boolean,
  score numeric,
  feedback jsonb,
  created_at timestamptz not null default now()
);

create table public.saved_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, conversation_id)
);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  anonymous_id text,
  provider text not null,
  model text not null,
  operation text not null,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric,
  latency_ms integer,
  success boolean not null,
  error_code text,
  created_at timestamptz not null default now()
);

create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index explanation_documents_conversation_idx on public.explanation_documents (conversation_id, created_at desc);
create index usage_events_created_idx on public.usage_events (created_at desc);

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger conversations_updated_at before update on public.conversations
for each row execute function public.set_updated_at();
create trigger provider_credentials_updated_at before update on public.provider_credentials
for each row execute function public.set_updated_at();
create trigger provider_preferences_updated_at before update on public.provider_preferences
for each row execute function public.set_updated_at();
create trigger concept_mastery_updated_at before update on public.concept_mastery
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.explanation_documents enable row level security;
alter table public.attachments enable row level security;
alter table public.provider_credentials enable row level security;
alter table public.provider_preferences enable row level security;
alter table public.concept_mastery enable row level security;
alter table public.misconceptions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.saved_lessons enable row level security;
alter table public.shares enable row level security;
alter table public.usage_events enable row level security;

create policy "profiles are private" on public.profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own conversations" on public.conversations
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own messages" on public.messages
for all using (
  exists (
    select 1 from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
);

create policy "own explanations" on public.explanation_documents
for all using (
  exists (
    select 1 from public.conversations
    where conversations.id = explanation_documents.conversation_id
      and conversations.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.conversations
    where conversations.id = explanation_documents.conversation_id
      and conversations.user_id = auth.uid()
  )
);

create policy "own attachments" on public.attachments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own credentials" on public.provider_credentials
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own provider preferences" on public.provider_preferences
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own mastery" on public.concept_mastery
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own misconceptions" on public.misconceptions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own quiz attempts" on public.quiz_attempts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own saved lessons" on public.saved_lessons
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own shares" on public.shares
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own usage" on public.usage_events
for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
