alter table public.conversation_members add column if not exists display_name text not null default 'Student';
create or replace function public.create_conversation_members()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare recipient_status text := 'pending'; sender_name text := 'Student'; recipient_name text := 'Student';
begin
  select coalesce(nullif(display_name, ''), 'Student') into sender_name from public.student_profiles where user_id = new.created_by;
  select coalesce(nullif(display_name, ''), 'Student'),
    case when message_policy = 'everyone' then 'accepted' else 'pending' end
    into recipient_name, recipient_status from public.student_profiles where user_id = new.recipient_id;
  insert into public.conversation_members(conversation_id, user_id, member_role, status, display_name)
  values (new.id, new.created_by, 'sender', 'accepted', coalesce(sender_name, 'Student')),
         (new.id, new.recipient_id, 'recipient', coalesce(recipient_status, 'pending'), coalesce(recipient_name, 'Student'));
  return new;
end;
$$;
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  check (reporter_id <> target_user_id)
);
alter table public.user_reports enable row level security;
revoke all on public.user_reports from public, anon, authenticated;
grant select, insert on public.user_reports to authenticated;
create policy "Students submit reports about other accounts" on public.user_reports for insert to authenticated
with check (reporter_id = (select auth.uid()) and private.is_conversation_member(conversation_id));
create policy "Students read their own account reports" on public.user_reports for select to authenticated using (reporter_id = (select auth.uid()));
create index if not exists user_reports_status_created_idx on public.user_reports(status, created_at desc);
create or replace function public.notify_post_comment()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare recipient uuid; enabled boolean;
begin
  select author_id into recipient from public.research_posts where id = new.post_id;
  if recipient is null or recipient = new.author_id then return new; end if;
  select coalesce(replies, true) and not coalesce(pause_all, false) into enabled from public.notification_preferences where user_id = recipient;
  if coalesce(enabled, true) then
    insert into public.notifications(user_id, actor_id, notification_type, entity_id, title, body, target_path, dedupe_key)
    values (recipient, new.author_id, 'post_reply', new.post_id, 'New reply to your research post', left(new.body, 180), '/community', 'reply:' || new.id::text)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.notify_post_comment() from public, anon, authenticated;
drop trigger if exists research_comments_notify_author on public.research_comments;
create trigger research_comments_notify_author after insert on public.research_comments for each row execute function public.notify_post_comment();
create or replace function public.notify_post_reaction()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare recipient uuid; enabled boolean; bucket text := to_char(date_trunc('hour', now()), 'YYYYMMDDHH24');
begin
  select author_id into recipient from public.research_posts where id = new.post_id;
  if recipient is null or recipient = new.user_id then return new; end if;
  select coalesce(reactions, true) and not coalesce(pause_all, false) into enabled from public.notification_preferences where user_id = recipient;
  if coalesce(enabled, true) then
    insert into public.notifications(user_id, actor_id, notification_type, entity_id, title, body, target_path, dedupe_key)
    values (recipient, new.user_id, 'post_reaction', new.post_id, 'A student reacted to your research post',
      'Your contribution received a ' || new.reaction || ' reaction.', '/community', 'reaction:' || new.post_id::text || ':' || bucket)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do update set body = 'Several students reacted to your research post.';
  end if;
  return new;
end;
$$;
revoke all on function public.notify_post_reaction() from public, anon, authenticated;
drop trigger if exists research_reactions_notify_author on public.research_reactions;
create trigger research_reactions_notify_author after insert on public.research_reactions for each row execute function public.notify_post_reaction();
