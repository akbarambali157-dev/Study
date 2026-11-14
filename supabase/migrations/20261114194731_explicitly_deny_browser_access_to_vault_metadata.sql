drop policy if exists "No client access to provider credentials" on public.user_provider_credentials;
create policy "No client access to provider credentials" on public.user_provider_credentials
for all to anon,authenticated using (false) with check (false);
