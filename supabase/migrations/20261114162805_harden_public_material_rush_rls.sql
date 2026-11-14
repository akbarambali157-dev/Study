-- Harden the Rush ledger with owner-scoped RLS and invoker permissions.
create index if not exists saved_public_materials_material_id_idx on public.saved_public_materials(material_id);
create index if not exists public_material_progress_material_id_idx on public.public_material_progress(material_id);
create index if not exists public_material_rush_runs_material_id_idx on public.public_material_rush_runs(material_id);
grant select, insert on public.public_material_rush_runs to authenticated;
drop policy if exists "Students read their own public material Rush runs" on public.public_material_rush_runs;
create policy "Students read their own public material Rush runs" on public.public_material_rush_runs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Students insert their own public material Rush runs" on public.public_material_rush_runs;
create policy "Students insert their own public material Rush runs" on public.public_material_rush_runs for insert to authenticated with check ((select auth.uid()) = user_id);
grant insert, update on public.public_material_progress to authenticated;
drop policy if exists "Students insert their own material progress" on public.public_material_progress;
create policy "Students insert their own material progress" on public.public_material_progress for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Students update their own material progress" on public.public_material_progress;
create policy "Students update their own material progress" on public.public_material_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace function public.record_public_material_rush(
  p_material_id uuid, p_run_id uuid, p_score integer, p_correct integer, p_total integer
) returns boolean
language plpgsql security invoker set search_path = ''
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
