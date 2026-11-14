create or replace function private.users_blocked(p_user_a uuid, p_user_b uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.user_blocks b where
  (b.blocker_id = p_user_a and b.blocked_id = p_user_b) or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)); $$;
revoke all on function private.users_blocked(uuid,uuid) from public, anon;
grant execute on function private.users_blocked(uuid,uuid) to authenticated;
drop policy if exists "Students can discover opted-in public profiles" on public.student_profiles;
drop policy if exists "Students read own academic profile" on public.student_profiles;
create policy "Students read own or discoverable academic profiles" on public.student_profiles for select to authenticated using (
  user_id = (select auth.uid()) or (discoverable = true and profile_visibility = 'public'));
drop policy if exists "Accepted members send messages" on public.messages;
create policy "Accepted members send messages" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and private.is_accepted_conversation_member(conversation_id)
  and not exists (select 1 from public.conversation_members other join public.user_blocks b on
    (b.blocker_id = other.user_id and b.blocked_id = (select auth.uid())) or (b.blocker_id = (select auth.uid()) and b.blocked_id = other.user_id)
    where other.conversation_id = conversation_id and other.user_id <> (select auth.uid())));
drop policy if exists "Students follow as themselves" on public.research_follows;
create policy "Students follow as themselves" on public.research_follows for insert to authenticated with check (
  follower_id = (select auth.uid()) and private.is_discoverable_profile(followed_id)
  and not private.users_blocked(follower_id, followed_id));
create index if not exists conversations_created_by_idx on public.conversations(created_by);
create index if not exists conversations_recipient_id_idx on public.conversations(recipient_id);
create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists notifications_actor_id_idx on public.notifications(actor_id);
