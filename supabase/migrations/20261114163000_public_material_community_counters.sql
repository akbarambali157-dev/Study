-- Public aggregate counters without exposing who saved or practised a material.
alter table public.public_materials
  add column if not exists saves_count integer not null default 0 check (saves_count >= 0),
  add column if not exists rush_count integer not null default 0 check (rush_count >= 0);

update public.public_materials m
set saves_count = (select count(*)::integer from public.saved_public_materials s where s.material_id = m.id),
    rush_count = (select count(*)::integer from public.public_material_rush_runs r where r.material_id = m.id);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.sync_public_material_saves()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.public_materials set saves_count = saves_count + 1 where id = new.material_id;
    return new;
  end if;
  update public.public_materials set saves_count = greatest(saves_count - 1, 0) where id = old.material_id;
  return old;
end;
$$;
revoke all on function private.sync_public_material_saves() from public, anon, authenticated;

create or replace function private.bump_public_material_rush_count()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.public_materials set rush_count = rush_count + 1 where id = new.material_id;
  return new;
end;
$$;
revoke all on function private.bump_public_material_rush_count() from public, anon, authenticated;

drop trigger if exists sync_public_material_saves on public.saved_public_materials;
create trigger sync_public_material_saves after insert or delete on public.saved_public_materials
for each row execute function private.sync_public_material_saves();

drop trigger if exists bump_public_material_rush_count on public.public_material_rush_runs;
create trigger bump_public_material_rush_count after insert on public.public_material_rush_runs
for each row execute function private.bump_public_material_rush_count();
