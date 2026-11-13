create index if not exists research_posts_author_id_idx on public.research_posts (author_id);
create index if not exists research_comments_author_id_idx on public.research_comments (author_id);
create index if not exists research_reactions_user_id_idx on public.research_reactions (user_id);
create index if not exists community_reports_reporter_id_idx on public.community_reports (reporter_id);