create index if not exists user_reports_reporter_id_idx on public.user_reports(reporter_id);
create index if not exists user_reports_target_user_id_idx on public.user_reports(target_user_id);
create index if not exists user_reports_conversation_id_idx on public.user_reports(conversation_id);
