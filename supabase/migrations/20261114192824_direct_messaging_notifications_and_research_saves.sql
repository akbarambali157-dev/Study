create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
create policy "Users read their own blocks" on public.user_blocks for select to authenticated using ((select auth.uid()) = blocker_id);
create policy "Users create their own blocks" on public.user_blocks for insert to authenticated with check ((select auth.uid()) = blocker_id);
create policy "Users remove their own blocks" on public.user_blocks for delete to authenticated using ((select auth.uid()) = blocker_id);
create index if not exists user_blocks_blocked_id_idx on public.user_blocks(blocked_id);

alter table public.student_profiles add column if not exists message_policy text not null default 'requests'
  check (message_policy in ('everyone','requests','nobody'));

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  check (created_by <> recipient_id)
);
create unique index if not exists conversations_direct_pair_idx
  on public.conversations (least(created_by, recipient_id), greatest(created_by, recipient_id));
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null check (member_role in ('sender','recipient')),
  status text not null default 'pending' check (status in ('pending','accepted')),
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id, status, conversation_id);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at desc);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  notification_type text not null check (notification_type in ('direct_message','post_reply','post_reaction','collaboration_invite','course_update','system')),
  entity_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  body text not null default '' check (char_length(body) <= 240),
  target_path text not null check (char_length(target_path) between 1 and 300),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dedupe_key text
);
create unique index if not exists notifications_dedupe_idx on public.notifications(user_id, dedupe_key) where dedupe_key is not null;
create index if not exists notifications_inbox_idx on public.notifications(user_id, created_at desc) where read_at is null;
create table if not exists public.post_bookmarks (
  post_id uuid not null references public.research_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_bookmarks_user_idx on public.post_bookmarks(user_id, created_at desc);
create table if not exists public.research_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index if not exists research_follows_followed_idx on public.research_follows(followed_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.post_bookmarks enable row level security;
alter table public.research_follows enable row level security;
revoke all on public.conversations, public.conversation_members, public.messages, public.notifications, public.post_bookmarks, public.research_follows from public, anon, authenticated;
grant select, insert on public.conversations to authenticated;
grant select on public.conversation_members to authenticated;
grant update (status, last_read_at) on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;
grant update (body, edited_at, deleted_at) on public.messages to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, delete on public.post_bookmarks to authenticated;
grant select, insert, delete on public.research_follows to authenticated;

create or replace function public.create_conversation_members()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.conversation_members(conversation_id, user_id, member_role, status)
  values (new.id, new.created_by, 'sender', 'accepted'),
         (new.id, new.recipient_id, 'recipient', 'pending');
  return new;
end;
$$;
revoke all on function public.create_conversation_members() from public, anon, authenticated;
drop trigger if exists conversations_create_members on public.conversations;
create trigger conversations_create_members after insert on public.conversations for each row execute function public.create_conversation_members();

create or replace function public.notify_direct_message()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare recipient uuid; sender_name text; enabled boolean;
begin
  select cm.user_id into recipient from public.conversation_members cm
  where cm.conversation_id = new.conversation_id and cm.user_id <> new.sender_id limit 1;
  if recipient is null then return new; end if;
  select coalesce(nullif(sp.display_name, ''), 'A student') into sender_name
  from public.student_profiles sp where sp.user_id = new.sender_id;
  sender_name := coalesce(sender_name, 'A student');
  select coalesce(np.direct_messages, true) and not coalesce(np.pause_all, false) into enabled
  from public.notification_preferences np where np.user_id = recipient;
  if coalesce(enabled, true) then
    insert into public.notifications(user_id, actor_id, notification_type, entity_id, title, body, target_path, dedupe_key)
    values (recipient, new.sender_id, 'direct_message', new.conversation_id, 'New message from ' || sender_name,
      case when new.deleted_at is null then left(new.body, 180) else 'You have a new message.' end,
      '/messages/' || new.conversation_id::text, 'message:' || new.id::text)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
  update public.conversations set last_message_at = new.created_at, updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;
revoke all on function public.notify_direct_message() from public, anon, authenticated;
drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient after insert on public.messages for each row execute function public.notify_direct_message();

create policy "Conversation participants can read conversations" on public.conversations for select to authenticated using (
  exists (select 1 from public.conversation_members cm where cm.conversation_id = id and cm.user_id = (select auth.uid()))
);
create policy "Students start safe direct conversations" on public.conversations for insert to authenticated with check (
  created_by = (select auth.uid())
  and not exists (select 1 from public.user_blocks b where
    (b.blocker_id = created_by and b.blocked_id = recipient_id) or (b.blocker_id = recipient_id and b.blocked_id = created_by))
  and exists (select 1 from public.student_profiles sp where sp.user_id = recipient_id and sp.message_policy <> 'nobody')
);
create policy "Participants read conversation membership" on public.conversation_members for select to authenticated using (
  exists (select 1 from public.conversation_members mine where mine.conversation_id = conversation_id and mine.user_id = (select auth.uid()))
);
create policy "Recipients accept their message requests" on public.conversation_members for update to authenticated
using (user_id = (select auth.uid()) and status = 'pending')
with check (user_id = (select auth.uid()) and status = 'accepted');
create policy "Members read conversation messages" on public.messages for select to authenticated using (
  exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = (select auth.uid()))
);
create policy "Accepted members send messages" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = (select auth.uid()) and cm.status = 'accepted')
  and not exists (select 1 from public.conversation_members other join public.user_blocks b on
    (b.blocker_id = other.user_id and b.blocked_id = (select auth.uid())) or (b.blocker_id = (select auth.uid()) and b.blocked_id = other.user_id)
    where other.conversation_id = conversation_id)
);
create policy "Authors edit their own messages" on public.messages for update to authenticated using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()));
create policy "Students read their own notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "Students mark their own notifications read" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Students manage their own post bookmarks" on public.post_bookmarks for all to authenticated using (user_id = (select auth.uid())) with check (
  user_id = (select auth.uid()) and exists (select 1 from public.research_posts p where p.id = post_id)
);
create policy "Students read research follows" on public.research_follows for select to authenticated using (follower_id = (select auth.uid()) or followed_id = (select auth.uid()));
create policy "Students follow as themselves" on public.research_follows for insert to authenticated with check (
  follower_id = (select auth.uid())
  and exists (select 1 from public.student_profiles sp where sp.user_id = followed_id and sp.discoverable and sp.profile_visibility = 'public')
  and not exists (select 1 from public.user_blocks b where
    (b.blocker_id = follower_id and b.blocked_id = followed_id) or (b.blocker_id = followed_id and b.blocked_id = follower_id))
);
create policy "Students unfollow as themselves" on public.research_follows for delete to authenticated using (follower_id = (select auth.uid()));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;
