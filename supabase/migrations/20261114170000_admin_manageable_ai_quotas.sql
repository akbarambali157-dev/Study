-- Admin-managed quota controls and aggregate usage reporting.
drop policy if exists "Admins can read all AI usage" on public.ai_usage;
drop policy if exists "Users can read their own AI usage" on public.ai_usage;
create policy "Users and admins can read permitted AI usage" on public.ai_usage for select to authenticated
using ((select auth.uid())=user_id or ((select auth.jwt())->'app_metadata'->>'role')='admin');
drop policy if exists "Anyone can discover public study materials" on public.public_materials;
drop policy if exists "Owners can read their private or public materials" on public.public_materials;
create policy "Discover public materials or read owned materials" on public.public_materials for select to anon,authenticated
using (is_public=true or (select auth.uid())=owner_id);
create table if not exists public.ai_user_limits(user_id uuid primary key references auth.users(id) on delete cascade,daily_request_limit integer not null default 120 check(daily_request_limit between 0 and 1200),suspended boolean not null default false,reason text not null default '' check(char_length(reason)<=300),updated_at timestamptz not null default now());
alter table public.ai_user_limits enable row level security;
revoke all on public.ai_user_limits from anon,authenticated;
grant select,insert,update,delete on public.ai_user_limits to authenticated;
grant select,insert,update,delete on public.ai_user_limits to service_role;
create policy "Admins manage AI user limits" on public.ai_user_limits for all to authenticated using((select auth.jwt())->'app_metadata'->>'role'='admin') with check((select auth.jwt())->'app_metadata'->>'role'='admin');
create table if not exists public.ai_system_limits(id boolean primary key default true check(id=true),global_daily_limit integer not null default 6000 check(global_daily_limit between 100 and 100000),updated_at timestamptz not null default now());
insert into public.ai_system_limits(id,global_daily_limit) values(true,6000) on conflict(id) do nothing;
alter table public.ai_system_limits enable row level security;
revoke all on public.ai_system_limits from anon,authenticated;
grant select,update on public.ai_system_limits to authenticated;
grant select,update on public.ai_system_limits to service_role;
create policy "Admins manage global AI limits" on public.ai_system_limits for all to authenticated using((select auth.jwt())->'app_metadata'->>'role'='admin') with check((select auth.jwt())->'app_metadata'->>'role'='admin');
create or replace function public.reserve_ai_request(p_user_id uuid,p_model text,p_request_id text,p_user_daily_limit integer default 120,p_global_daily_limit integer default 6000)
returns table(allowed boolean,reason text,usage_id uuid) language plpgsql security definer set search_path=''
as $$
declare v_user_count integer;v_global_count integer;v_usage_id uuid;v_user_limit integer;v_global_limit integer;v_suspended boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(884421,1);
 select daily_request_limit,suspended into v_user_limit,v_suspended from public.ai_user_limits where user_id=p_user_id;
 v_user_limit:=coalesce(v_user_limit,p_user_daily_limit);v_suspended:=coalesce(v_suspended,false);
 if v_suspended then return query select false,'user_suspended'::text,null::uuid;return;end if;
 select global_daily_limit into v_global_limit from public.ai_system_limits where id=true;
 v_global_limit:=coalesce(v_global_limit,p_global_daily_limit);
 select count(*)::integer into v_user_count from public.ai_usage where user_id=p_user_id and created_at>=now()-interval '24 hours';
 if v_user_count>=v_user_limit then return query select false,'user_daily_limit'::text,null::uuid;return;end if;
 select count(*)::integer into v_global_count from public.ai_usage where created_at>=now()-interval '24 hours';
 if v_global_count>=v_global_limit then return query select false,'global_daily_limit'::text,null::uuid;return;end if;
 insert into public.ai_usage(user_id,model,status_code,request_id,created_at) values(p_user_id,p_model,102,p_request_id,now()) returning id into v_usage_id;
 return query select true,'reserved'::text,v_usage_id;
end;$$;
revoke all on function public.reserve_ai_request(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,text,text,integer,integer) to service_role;
create or replace function public.admin_usage_summary()
returns table(user_id uuid,request_count bigint,input_tokens bigint,output_tokens bigint,total_tokens bigint,failed_requests bigint,last_activity timestamptz)
language sql stable security invoker set search_path=''
as $$
 select u.user_id,count(*)::bigint,sum(u.input_tokens)::bigint,sum(u.output_tokens)::bigint,sum(u.input_tokens+u.output_tokens)::bigint,count(*) filter(where u.status_code<200 or u.status_code>=400)::bigint,max(u.created_at)
 from public.ai_usage u where ((select auth.jwt())->'app_metadata'->>'role')='admin' group by u.user_id order by sum(u.input_tokens+u.output_tokens) desc
$$;
revoke all on function public.admin_usage_summary() from public,anon;
grant execute on function public.admin_usage_summary() to authenticated;
