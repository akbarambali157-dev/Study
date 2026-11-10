-- Track AI usage per logged-in user so the site-provided model can be
-- rate-limited and attributed. Every table is behind row-level security.

create table if not exists public.ai_usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  model text not null,
  input_tokens integer default 0 not null,
  output_tokens integer default 0 not null,
  status_code integer not null,
  created_at timestamptz default now() not null
);

-- Index for per-user lookups
create index if not exists ai_usage_user_id_idx on public.ai_usage(user_id);
create index if not exists ai_usage_created_at_idx on public.ai_usage(created_at desc);

-- Row-level security: users can only read their own usage.
alter table public.ai_usage enable row level security;

create policy "Users can read their own AI usage"
  on public.ai_usage
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Service role can insert AI usage"
  on public.ai_usage
  for insert
  to authenticated, service_role
  with check (auth.uid() = user_id);
