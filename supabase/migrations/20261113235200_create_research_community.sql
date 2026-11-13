-- Research community MVP: authenticated feed, comments, reactions and private reports.
create table if not exists public.research_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 80),
  title text not null check (char_length(btrim(title)) between 4 and 140),
  body text not null check (char_length(btrim(body)) between 10 and 6000),
  post_type text not null default 'idea'
    check (post_type in ('idea','paper','question','discovery','progress','resource','collaboration')),
  discipline text not null default 'General',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_posts_created_at_idx
  on public.research_posts (created_at desc);
create index if not exists research_posts_type_created_idx
  on public.research_posts (post_type, created_at desc);

create table if not exists public.research_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.research_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists research_comments_post_created_idx
  on public.research_comments (post_id, created_at asc);

create table if not exists public.research_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.research_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like','insightful','helpful')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists research_reactions_post_idx
  on public.research_reactions (post_id);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment')),
  target_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed'))
);
create index if not exists community_reports_status_created_idx
  on public.community_reports (status, created_at desc);

alter table public.research_posts enable row level security;
alter table public.research_comments enable row level security;
alter table public.research_reactions enable row level security;
alter table public.community_reports enable row level security;

revoke all on public.research_posts, public.research_comments, public.research_reactions, public.community_reports from anon;
grant select, insert, update, delete on public.research_posts to authenticated;
grant select, insert, update, delete on public.research_comments to authenticated;
grant select, insert, update, delete on public.research_reactions to authenticated;
grant select, insert on public.community_reports to authenticated;

drop policy if exists "Authenticated members can read research posts" on public.research_posts;
create policy "Authenticated members can read research posts"
  on public.research_posts for select to authenticated using (true);
drop policy if exists "Students can create their own research posts" on public.research_posts;
create policy "Students can create their own research posts"
  on public.research_posts for insert to authenticated
  with check ((select auth.uid()) = author_id);
drop policy if exists "Students can edit their own research posts" on public.research_posts;
create policy "Students can edit their own research posts"
  on public.research_posts for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
drop policy if exists "Students can delete their own research posts" on public.research_posts;
create policy "Students can delete their own research posts"
  on public.research_posts for delete to authenticated
  using ((select auth.uid()) = author_id);

drop policy if exists "Authenticated members can read research comments" on public.research_comments;
create policy "Authenticated members can read research comments"
  on public.research_comments for select to authenticated using (true);
drop policy if exists "Students can comment as themselves" on public.research_comments;
create policy "Students can comment as themselves"
  on public.research_comments for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (select 1 from public.research_posts p where p.id = post_id)
  );
drop policy if exists "Students can edit their own comments" on public.research_comments;
create policy "Students can edit their own comments"
  on public.research_comments for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
drop policy if exists "Students can delete their own comments" on public.research_comments;
create policy "Students can delete their own comments"
  on public.research_comments for delete to authenticated
  using ((select auth.uid()) = author_id);

drop policy if exists "Authenticated members can read reactions" on public.research_reactions;
create policy "Authenticated members can read reactions"
  on public.research_reactions for select to authenticated using (true);
drop policy if exists "Students can react as themselves" on public.research_reactions;
create policy "Students can react as themselves"
  on public.research_reactions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.research_posts p where p.id = post_id)
  );
drop policy if exists "Students can change their own reaction" on public.research_reactions;
create policy "Students can change their own reaction"
  on public.research_reactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Students can remove their own reaction" on public.research_reactions;
create policy "Students can remove their own reaction"
  on public.research_reactions for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Students can submit reports" on public.community_reports;
create policy "Students can submit reports"
  on public.community_reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id);
drop policy if exists "Students can read their own reports" on public.community_reports;
create policy "Students can read their own reports"
  on public.community_reports for select to authenticated
  using ((select auth.uid()) = reporter_id);
