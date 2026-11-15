-- Add covering indexes for update foreign keys and avoid overlapping permissive SELECT policies.
create index if not exists app_update_dismissals_update_id_idx on public.app_update_dismissals(update_id);
create index if not exists app_updates_created_by_idx on public.app_updates(created_by);
drop policy if exists "Anyone can read published app updates" on public.app_updates;
drop policy if exists "Admins can read all app updates" on public.app_updates;
drop policy if exists "Admins manage app updates" on public.app_updates;
create policy "Published updates or admin reads" on public.app_updates for select to anon,authenticated
using(status='published' or (select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins insert app updates" on public.app_updates for insert to authenticated
with check((select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins update app updates" on public.app_updates for update to authenticated
using((select auth.jwt())->'app_metadata'->>'role'='admin')
with check((select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins delete app updates" on public.app_updates for delete to authenticated
using((select auth.jwt())->'app_metadata'->>'role'='admin');
