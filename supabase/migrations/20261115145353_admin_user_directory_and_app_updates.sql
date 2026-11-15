-- Admin control room: real Supabase account directory and moderated in-app release notes.
create table if not exists public.app_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 140),
  category text not null default 'feature' check (category in ('feature','improvement','fix','documentation','security','announcement')),
  summary text not null default '' check (char_length(summary) <= 280),
  body text not null default '' check (char_length(body) <= 12000),
  version_label text not null default '' check (char_length(version_label) <= 60),
  docs_path text not null default '' check (char_length(docs_path) <= 500),
  status text not null default 'draft' check (status in ('draft','published')),
  publish_mode text not null default 'manual' check (publish_mode in ('manual','automatic')),
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists app_updates_published_idx on public.app_updates(published_at desc) where status='published';
create index if not exists app_updates_category_status_idx on public.app_updates(category,status,updated_at desc);
alter table public.app_updates enable row level security;
revoke all on public.app_updates from anon, authenticated;
grant select on public.app_updates to anon, authenticated;
grant insert, update, delete on public.app_updates to authenticated;
drop policy if exists "Anyone can read published app updates" on public.app_updates;
create policy "Anyone can read published app updates" on public.app_updates for select to anon,authenticated using(status='published');
drop policy if exists "Admins can read all app updates" on public.app_updates;
create policy "Admins can read all app updates" on public.app_updates for select to authenticated using((select auth.jwt())->'app_metadata'->>'role'='admin');
drop policy if exists "Admins manage app updates" on public.app_updates;
create policy "Admins manage app updates" on public.app_updates for all to authenticated using((select auth.jwt())->'app_metadata'->>'role'='admin') with check((select auth.jwt())->'app_metadata'->>'role'='admin');

create table if not exists public.app_update_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  update_id uuid not null references public.app_updates(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key(user_id,update_id)
);
alter table public.app_update_dismissals enable row level security;
revoke all on public.app_update_dismissals from anon, authenticated;
grant select,insert,delete on public.app_update_dismissals to authenticated;
drop policy if exists "Users manage own update dismissals" on public.app_update_dismissals;
create policy "Users manage own update dismissals" on public.app_update_dismissals for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);

create or replace function public.set_app_update_publish_state()
returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at := now();
  if new.publish_mode='automatic' then new.status := 'published'; end if;
  if new.status='published' then new.published_at := coalesce(new.published_at, now());
  else new.published_at := null; end if;
  return new;
end;
$$;
drop trigger if exists app_updates_publish_state on public.app_updates;
create trigger app_updates_publish_state before insert or update on public.app_updates
for each row execute function public.set_app_update_publish_state();

create or replace function public.admin_user_directory()
returns table(
  user_id uuid, email text, display_name text, institution text, faculty text,
  department text, level text, account_created_at timestamptz,
  last_sign_in_at timestamptz, last_activity_at timestamptz,
  ai_requests bigint, total_tokens bigint, published_materials bigint, is_anonymous boolean
)
language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or (select auth.jwt())->'app_metadata'->>'role' <> 'admin' then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  return query
  select u.id, u.email::text,
    coalesce(nullif(sp.display_name,''), nullif(u.raw_user_meta_data->>'display_name',''),
      nullif(u.raw_user_meta_data->>'full_name',''), split_part(coalesce(u.email,''),'@',1))::text,
    coalesce(sp.institution,'')::text, coalesce(sp.faculty,'')::text,
    coalesce(sp.department,'')::text, coalesce(sp.level,'')::text,
    u.created_at, u.last_sign_in_at,
    greatest(u.last_sign_in_at, au.last_ai_at, pm.last_publish_at),
    coalesce(au.ai_requests,0)::bigint, coalesce(au.total_tokens,0)::bigint,
    coalesce(pm.published_materials,0)::bigint, coalesce(u.is_anonymous,false)
  from auth.users u
  left join public.student_profiles sp on sp.user_id=u.id
  left join lateral (
    select count(*)::bigint as ai_requests,
      coalesce(sum(input_tokens+output_tokens),0)::bigint as total_tokens,
      max(created_at) as last_ai_at
    from public.ai_usage where user_id=u.id
  ) au on true
  left join lateral (
    select count(*)::bigint as published_materials, max(created_at) as last_publish_at
    from public.public_materials where owner_id=u.id and is_public=true
  ) pm on true
  where u.deleted_at is null
  order by coalesce(u.last_sign_in_at,u.created_at) desc;
end;
$$;
revoke all on function public.admin_user_directory() from public, anon;
grant execute on function public.admin_user_directory() to authenticated;
