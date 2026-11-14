-- Public generated study materials and trusted AI usage ledger.
alter table public.ai_usage add column if not exists request_id text, add column if not exists duration_ms integer not null default 0 check(duration_ms>=0);
create unique index if not exists ai_usage_request_id_unique on public.ai_usage(request_id) where request_id is not null;
create index if not exists ai_usage_created_at_idx on public.ai_usage(created_at desc);
drop policy if exists "Users can insert their own AI usage" on public.ai_usage;
drop policy if exists "Admins can read all AI usage" on public.ai_usage;
create policy "Admins can read all AI usage" on public.ai_usage for select to authenticated using((auth.jwt()->'app_metadata'->>'role')='admin');
revoke insert,update,delete on public.ai_usage from anon,authenticated;
grant select on public.ai_usage to authenticated;
grant select,insert,update on public.ai_usage to service_role;
create or replace function public.reserve_ai_request(p_user_id uuid,p_model text,p_request_id text,p_user_daily_limit integer default 120,p_global_daily_limit integer default 6000)
returns table(allowed boolean,reason text,usage_id uuid) language plpgsql security definer set search_path=''
as $$
declare v_user_count integer; v_global_count integer; v_usage_id uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(884421,1);
 select count(*)::integer into v_user_count from public.ai_usage where user_id=p_user_id and created_at>=now()-interval '24 hours';
 if v_user_count>=p_user_daily_limit then return query select false,'user_daily_limit'::text,null::uuid; return; end if;
 select count(*)::integer into v_global_count from public.ai_usage where created_at>=now()-interval '24 hours';
 if v_global_count>=p_global_daily_limit then return query select false,'global_daily_limit'::text,null::uuid; return; end if;
 insert into public.ai_usage(user_id,model,status_code,request_id,created_at) values(p_user_id,p_model,p_request_id,102,now()) returning id into v_usage_id;
 return query select true,'reserved'::text,v_usage_id;
end; $$;
revoke all on function public.reserve_ai_request(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,text,text,integer,integer) to service_role;
create table if not exists public.public_materials(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 author_name text not null check(char_length(btrim(author_name)) between 1 and 80),
 title text not null check(char_length(btrim(title)) between 1 and 200),
 discipline text not null default 'General' check(char_length(btrim(discipline)) between 1 and 100),
 page_count integer not null default 1 check(page_count between 1 and 120),
 tags text[] not null default '{}',summary text not null default '' check(char_length(summary)<=12000),
 content jsonb not null default '{}'::jsonb,is_public boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists public_materials_public_created_idx on public.public_materials(created_at desc) where is_public=true;
create index if not exists public_materials_owner_created_idx on public.public_materials(owner_id,created_at desc);
create index if not exists public_materials_discipline_idx on public.public_materials(discipline,created_at desc) where is_public=true;
alter table public.public_materials enable row level security;
revoke all on public.public_materials from anon,authenticated;
grant select on public.public_materials to anon,authenticated;
grant insert,update,delete on public.public_materials to authenticated;
drop policy if exists "Anyone can discover public study materials" on public.public_materials;
create policy "Anyone can discover public study materials" on public.public_materials for select to anon,authenticated using(is_public=true);
drop policy if exists "Owners can read their private or public materials" on public.public_materials;
create policy "Owners can read their private or public materials" on public.public_materials for select to authenticated using((select auth.uid())=owner_id);
drop policy if exists "Students publish their own study materials" on public.public_materials;
create policy "Students publish their own study materials" on public.public_materials for insert to authenticated with check((select auth.uid())=owner_id);
drop policy if exists "Students manage their own study material visibility" on public.public_materials;
create policy "Students manage their own study material visibility" on public.public_materials for update to authenticated using((select auth.uid())=owner_id) with check((select auth.uid())=owner_id);
drop policy if exists "Students delete their own study materials" on public.public_materials;
create policy "Students delete their own study materials" on public.public_materials for delete to authenticated using((select auth.uid())=owner_id);
