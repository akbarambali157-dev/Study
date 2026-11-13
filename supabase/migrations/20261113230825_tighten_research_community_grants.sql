revoke all privileges on table public.research_posts, public.research_comments, public.research_reactions, public.community_reports from public, anon, authenticated;
grant select, insert, update, delete on public.research_posts to authenticated;
grant select, insert, update, delete on public.research_comments to authenticated;
grant select, insert, update, delete on public.research_reactions to authenticated;
grant select, insert on public.community_reports to authenticated;