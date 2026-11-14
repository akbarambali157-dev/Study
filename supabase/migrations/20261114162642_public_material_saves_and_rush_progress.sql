-- Saved community materials and idempotent Rush progress tracking.
create table if not exists public.saved_public_materials (
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.public_materials(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, material_id)
);
alter table public.saved_public_materials enable row level security;
grant select, insert, delete on public.saved_public_materials to authenticated;
drop policy if exists "Students read their saved materials" on public.saved_public_materials;
create policy "Students read their saved materials" on public.saved_public_materials for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Students save materials to their library" on public.saved_public_materials;
create policy "Students save materials to their library" on public.saved_public_materials for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Students remove their saved materials" on public.saved_public_materials;
create policy "Students remove their saved materials" on public.saved_public_materials for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.public_material_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.public_materials(id) on delete cascade,
  rush_count integer not null default 0 check (rush_count >= 0),
  best_score integer not null default 0 check (best_score >= 0),
  best_accuracy numeric(5,2) not null default 0 check (best_accuracy between 0 and 100),
  last_rush_at timestamptz,
  primary key (user_id, material_id)
);
alter table public.public_material_progress enable row level security;
grant select on public.public_material_progress to authenticated;
drop policy if exists "Students read their own material progress" on public.public_material_progress;
create policy "Students read their own material progress" on public.public_material_progress for select to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.public_material_rush_runs (
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.public_materials(id) on delete cascade,
  run_id uuid not null,
  score integer not null check (score >= 0),
  correct integer not null check (correct >= 0),
  total integer not null check (total >= correct),
  created_at timestamptz not null default now(),
  primary key (user_id, material_id, run_id)
);
alter table public.public_material_rush_runs enable row level security;
revoke all on public.public_material_rush_runs from anon, authenticated;

create or replace function public.record_public_material_rush(
  p_material_id uuid, p_run_id uuid, p_score integer, p_correct integer, p_total integer
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted integer;
  v_accuracy numeric(5,2);
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_score < 0 or p_correct < 0 or p_total < p_correct or p_total > 1000 then raise exception 'Invalid Rush result'; end if;
  if not exists (select 1 from public.public_materials m where m.id = p_material_id and m.is_public = true) then raise exception 'Public material not found'; end if;
  v_accuracy := case when p_total = 0 then 0 else round((p_correct::numeric / p_total) * 100, 2) end;
  insert into public.public_material_rush_runs(user_id, material_id, run_id, score, correct, total)
  values (v_user_id, p_material_id, p_run_id, p_score, p_correct, p_total) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;
  insert into public.public_material_progress(user_id, material_id, rush_count, best_score, best_accuracy, last_rush_at)
  values (v_user_id, p_material_id, 1, p_score, v_accuracy, now())
  on conflict (user_id, material_id) do update set
    rush_count = public.public_material_progress.rush_count + 1,
    best_score = greatest(public.public_material_progress.best_score, excluded.best_score),
    best_accuracy = greatest(public.public_material_progress.best_accuracy, excluded.best_accuracy),
    last_rush_at = excluded.last_rush_at;
  return true;
end;
$$;
revoke all on function public.record_public_material_rush(uuid, uuid, integer, integer, integer) from public, anon;
grant execute on function public.record_public_material_rush(uuid, uuid, integer, integer, integer) to authenticated;
