-- Only allow saving community materials that are currently public.
drop policy if exists "Students save materials to their library" on public.saved_public_materials;
create policy "Students save materials to their library" on public.saved_public_materials
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.public_materials m
    where m.id = material_id and m.is_public = true
  )
);
