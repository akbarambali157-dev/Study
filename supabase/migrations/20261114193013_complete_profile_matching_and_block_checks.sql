alter table public.student_profiles
  add column if not exists project_goals text[] not null default '{}',
  add column if not exists collaboration_available boolean not null default false;
create or replace function private.can_start_conversation(p_sender uuid, p_recipient uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select p_sender = (select auth.uid()) and p_sender <> p_recipient
    and exists (select 1 from public.student_profiles sp where sp.user_id = p_recipient
      and sp.message_policy <> 'nobody' and sp.discoverable = true and sp.profile_visibility = 'public')
    and not private.users_blocked(p_sender, p_recipient);
$$;
revoke all on function private.can_start_conversation(uuid,uuid) from public, anon;
grant execute on function private.can_start_conversation(uuid,uuid) to authenticated;
create or replace function private.is_conversation_blocked(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id <> (select auth.uid())
      and private.users_blocked((select auth.uid()), cm.user_id));
$$;
revoke all on function private.is_conversation_blocked(uuid) from public, anon;
grant execute on function private.is_conversation_blocked(uuid) to authenticated;
drop policy if exists "Accepted members send messages" on public.messages;
create policy "Accepted members send messages" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and private.is_accepted_conversation_member(conversation_id)
  and not private.is_conversation_blocked(conversation_id));
