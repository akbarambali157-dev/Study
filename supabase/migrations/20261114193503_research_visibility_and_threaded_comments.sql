alter table public.research_posts add column if not exists visibility text not null default 'public' check (visibility in ('public','private'));
alter table public.research_comments add column if not exists parent_comment_id uuid references public.research_comments(id) on delete cascade;
create index if not exists research_comments_parent_idx on public.research_comments(parent_comment_id) where parent_comment_id is not null;

drop policy if exists "Authenticated members can read research posts" on public.research_posts;
create policy "Students read visible research posts" on public.research_posts for select to authenticated
using (author_id = (select auth.uid()) or visibility = 'public');

drop policy if exists "Authenticated members can read research comments" on public.research_comments;
create policy "Students read comments on visible posts" on public.research_comments for select to authenticated
using (exists (select 1 from public.research_posts p where p.id = post_id));
drop policy if exists "Students can comment as themselves" on public.research_comments;
create policy "Students comment on visible posts" on public.research_comments for insert to authenticated
with check ((select auth.uid()) = author_id and exists (select 1 from public.research_posts p where p.id = post_id)
  and (parent_comment_id is null or exists (select 1 from public.research_comments parent where parent.id = parent_comment_id and parent.post_id = post_id)));

drop policy if exists "Authenticated members can read reactions" on public.research_reactions;
create policy "Students read reactions on visible posts" on public.research_reactions for select to authenticated
using (exists (select 1 from public.research_posts p where p.id = post_id));
