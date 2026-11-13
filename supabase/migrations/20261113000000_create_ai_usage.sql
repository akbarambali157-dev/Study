create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null check (length(model) between 1 and 100),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  status_code integer not null default 200 check (status_code between 100 and 599),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_created_at_idx
  on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "Users can insert their own AI usage" on public.ai_usage;
create policy "Users can insert their own AI usage"
  on public.ai_usage
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own AI usage" on public.ai_usage;
create policy "Users can read their own AI usage"
  on public.ai_usage
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.ai_usage from anon;
grant select, insert on table public.ai_usage to authenticated;
