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
