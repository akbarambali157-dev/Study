create table if not exists public.student_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  institution text not null default 'Olabisi Onabanjo University',
  faculty text not null default '', department text not null default '', level text not null default '',
  programme text not null default '', academic_session text not null default '',
  research_interests text[] not null default '{}', skills text[] not null default '{}',
  profile_visibility text not null default 'private' check (profile_visibility in ('private','public')),
  discoverable boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.student_profiles enable row level security;
revoke all on public.student_profiles from anon;
grant select, insert, update, delete on public.student_profiles to authenticated;
create policy "Students read own academic profile" on public.student_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Students create own academic profile" on public.student_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Students update own academic profile" on public.student_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Students delete own academic profile" on public.student_profiles for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists student_profiles_discoverable_idx on public.student_profiles (institution, department, level) where discoverable = true and profile_visibility = 'public';

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  direct_messages boolean not null default true, replies boolean not null default true, mentions boolean not null default true,
  reactions boolean not null default true, collaboration_invites boolean not null default true, course_discussions boolean not null default false,
  suggested_connections boolean not null default false, product_announcements boolean not null default false,
  quiet_hours_enabled boolean not null default false, quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00', pause_all boolean not null default false, updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon;
grant select, insert, update, delete on public.notification_preferences to authenticated;
create policy "Students manage own notification preferences" on public.notification_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null, p256dh text not null, auth_secret text not null, expiration_time timestamptz, user_agent text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
create policy "Students manage own push subscriptions" on public.push_subscriptions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
