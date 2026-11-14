create or replace function private.is_conversation_peer(p_conversation_id uuid, p_target_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.conversation_members cm where cm.conversation_id = p_conversation_id
    and cm.user_id = p_target_user_id and cm.user_id <> (select auth.uid()))
    and private.is_conversation_member(p_conversation_id);
$$;
revoke all on function private.is_conversation_peer(uuid,uuid) from public, anon;
grant execute on function private.is_conversation_peer(uuid,uuid) to authenticated;
drop policy if exists "Students submit reports about other accounts" on public.user_reports;
create policy "Students submit reports about other accounts" on public.user_reports for insert to authenticated
with check (reporter_id = (select auth.uid()) and private.is_conversation_peer(conversation_id, target_user_id));
