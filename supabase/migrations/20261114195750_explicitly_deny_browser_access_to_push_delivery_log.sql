drop policy if exists "No client access to push delivery log" on public.push_delivery_log;
create policy "No client access to push delivery log" on public.push_delivery_log
for all to anon,authenticated using (false) with check (false);
