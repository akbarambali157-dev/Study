create table if not exists public.academic_groups (
  id uuid primary key default gen_random_uuid(),
  group_type text not null check (group_type in ('course','research_circle')),
  title text not null check (char_length(btrim(title)) between 4 and 100),
  description text not null default '' check (char_length(description) <= 4000),
  institution text not null default '',
  faculty text not null default '',
  department text not null default '',
  course_code text,
  level text,
  semester text,
  academic_session text,
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists academic_groups_discovery_idx on public.academic_groups(group_type,institution,department,updated_at desc);
create index if not exists academic_groups_owner_idx on public.academic_groups(created_by,created_at desc);

create table if not exists public.academic_group_members (
  group_id uuid not null references public.academic_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','moderator','member')),
  status text not null default 'active' check (status in ('active','pending')),
  joined_at timestamptz not null default now(),
  primary key (group_id,user_id)
);
create index if not exists academic_group_members_user_idx on public.academic_group_members(user_id,status,group_id);

create table if not exists public.academic_group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.academic_groups(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 4 and 140),
  body text not null check (char_length(btrim(body)) between 10 and 6000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists academic_group_posts_feed_idx on public.academic_group_posts(group_id,created_at desc);
create index if not exists academic_group_posts_author_idx on public.academic_group_posts(author_id);

alter table public.academic_groups enable row level security;
alter table public.academic_group_members enable row level security;
alter table public.academic_group_posts enable row level security;
revoke all on public.academic_groups,public.academic_group_members,public.academic_group_posts from public,anon,authenticated;
grant select,insert,update,delete on public.academic_groups to authenticated;
grant select,insert,delete on public.academic_group_members to authenticated;
grant select,insert,update,delete on public.academic_group_posts to authenticated;

create or replace function private.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.academic_group_members m where m.group_id=p_group_id and m.user_id=(select auth.uid()) and m.status='active'); $$;
create or replace function private.is_group_owner(p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.academic_groups g where g.id=p_group_id and g.created_by=(select auth.uid())); $$;
create or replace function private.can_view_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.academic_groups g where g.id=p_group_id and (g.visibility='public' or private.is_group_member(g.id))); $$;
revoke all on function private.is_group_member(uuid) from public,anon;
revoke all on function private.is_group_owner(uuid) from public,anon;
revoke all on function private.can_view_group(uuid) from public,anon;
grant execute on function private.is_group_member(uuid) to authenticated;
grant execute on function private.is_group_owner(uuid) to authenticated;
grant execute on function private.can_view_group(uuid) to authenticated;

create or replace function public.add_academic_group_owner()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  insert into public.academic_group_members(group_id,user_id,member_role,status)
  values(new.id,new.created_by,'owner','active');
  return new;
end;
$$;
revoke all on function public.add_academic_group_owner() from public,anon,authenticated;
drop trigger if exists academic_groups_add_owner on public.academic_groups;
create trigger academic_groups_add_owner after insert on public.academic_groups for each row execute function public.add_academic_group_owner();

create policy "Students view public or joined academic groups" on public.academic_groups for select to authenticated using (visibility='public' or private.is_group_member(id));
create policy "Students create academic groups as themselves" on public.academic_groups for insert to authenticated with check (created_by=(select auth.uid()));
create policy "Group owners update their groups" on public.academic_groups for update to authenticated using (created_by=(select auth.uid())) with check (created_by=(select auth.uid()));
create policy "Group owners delete their groups" on public.academic_groups for delete to authenticated using (created_by=(select auth.uid()));

create policy "Group members are visible to eligible viewers" on public.academic_group_members for select to authenticated using (private.can_view_group(group_id));
create policy "Students join public groups as members" on public.academic_group_members for insert to authenticated with check (
  user_id=(select auth.uid()) and member_role='member' and status='active'
  and exists(select 1 from public.academic_groups g where g.id=group_id and g.visibility='public')
);
create policy "Students leave groups or owners remove members" on public.academic_group_members for delete to authenticated using (
  user_id=(select auth.uid()) or private.is_group_owner(group_id)
);

create policy "Members view posts in visible groups" on public.academic_group_posts for select to authenticated using (private.can_view_group(group_id));
create policy "Active members publish group posts" on public.academic_group_posts for insert to authenticated with check (
  author_id=(select auth.uid()) and private.is_group_member(group_id)
);
create policy "Authors or group owners edit posts" on public.academic_group_posts for update to authenticated using (
  author_id=(select auth.uid()) or private.is_group_owner(group_id)
) with check (author_id=(select auth.uid()) or private.is_group_owner(group_id));
create policy "Authors or group owners delete posts" on public.academic_group_posts for delete to authenticated using (
  author_id=(select auth.uid()) or private.is_group_owner(group_id)
);

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='academic_group_posts') then
    alter publication supabase_realtime add table public.academic_group_posts;
  end if;
end $$;
