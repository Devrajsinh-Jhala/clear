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
