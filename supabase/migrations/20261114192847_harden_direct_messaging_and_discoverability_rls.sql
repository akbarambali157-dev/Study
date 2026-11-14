create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.conversation_members cm where cm.conversation_id = p_conversation_id and cm.user_id = (select auth.uid())); $$;
create or replace function private.is_accepted_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.conversation_members cm where cm.conversation_id = p_conversation_id and cm.user_id = (select auth.uid()) and cm.status = 'accepted'); $$;
create or replace function private.can_start_conversation(p_sender uuid, p_recipient uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select p_sender = (select auth.uid()) and p_sender <> p_recipient
    and exists (select 1 from public.student_profiles sp where sp.user_id = p_recipient and sp.message_policy <> 'nobody')
    and not exists (select 1 from public.user_blocks b where
      (b.blocker_id = p_sender and b.blocked_id = p_recipient) or (b.blocker_id = p_recipient and b.blocked_id = p_sender));
$$;
create or replace function private.is_discoverable_profile(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.student_profiles sp where sp.user_id = p_user_id and sp.discoverable = true and sp.profile_visibility = 'public'); $$;
revoke all on function private.is_conversation_member(uuid) from public, anon;
revoke all on function private.is_accepted_conversation_member(uuid) from public, anon;
revoke all on function private.can_start_conversation(uuid,uuid) from public, anon;
revoke all on function private.is_discoverable_profile(uuid) from public, anon;
grant execute on function private.is_conversation_member(uuid) to authenticated;
grant execute on function private.is_accepted_conversation_member(uuid) to authenticated;
grant execute on function private.can_start_conversation(uuid,uuid) to authenticated;
grant execute on function private.is_discoverable_profile(uuid) to authenticated;
drop policy if exists "Conversation participants can read conversations" on public.conversations;
create policy "Conversation participants can read conversations" on public.conversations for select to authenticated using (private.is_conversation_member(id));
drop policy if exists "Students start safe direct conversations" on public.conversations;
create policy "Students start safe direct conversations" on public.conversations for insert to authenticated with check (private.can_start_conversation(created_by, recipient_id));
drop policy if exists "Participants read conversation membership" on public.conversation_members;
create policy "Participants read conversation membership" on public.conversation_members for select to authenticated using (private.is_conversation_member(conversation_id));
drop policy if exists "Recipients accept their message requests" on public.conversation_members;
create policy "Recipients accept their message requests" on public.conversation_members for update to authenticated
using (user_id = (select auth.uid()) and status in ('pending','accepted'))
with check (user_id = (select auth.uid()) and status = 'accepted');
drop policy if exists "Members read conversation messages" on public.messages;
create policy "Members read conversation messages" on public.messages for select to authenticated using (private.is_conversation_member(conversation_id));
drop policy if exists "Accepted members send messages" on public.messages;
create policy "Accepted members send messages" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and private.is_accepted_conversation_member(conversation_id)
  and not exists (select 1 from public.conversation_members other join public.user_blocks b on
    (b.blocker_id = other.user_id and b.blocked_id = (select auth.uid())) or (b.blocker_id = (select auth.uid()) and b.blocked_id = other.user_id)
    where other.conversation_id = conversation_id and other.user_id <> (select auth.uid()))
);
drop policy if exists "Students mark their own notifications read" on public.notifications;
create policy "Students mark their own notifications read" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
drop policy if exists "Students follow as themselves" on public.research_follows;
create policy "Students follow as themselves" on public.research_follows for insert to authenticated with check (
  follower_id = (select auth.uid()) and private.is_discoverable_profile(followed_id)
  and not exists (select 1 from public.user_blocks b where
    (b.blocker_id = follower_id and b.blocked_id = followed_id) or (b.blocker_id = followed_id and b.blocked_id = follower_id))
);
drop policy if exists "Students can discover opted-in public profiles" on public.student_profiles;
create policy "Students can discover opted-in public profiles" on public.student_profiles for select to authenticated using (discoverable = true and profile_visibility = 'public');
