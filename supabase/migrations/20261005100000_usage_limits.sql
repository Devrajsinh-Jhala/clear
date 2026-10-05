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
