-- Only accept credentials that belong to the two explicitly supported providers.
create or replace function public.store_user_provider_credential(
  p_user_id uuid,
  p_secret text,
  p_base_url text default 'https://api.anthropic.com'
)
returns void
language plpgsql
security definer
set search_path=public,vault,pg_temp
as $$
declare existing_id uuid; secret_id uuid;
begin
  if p_user_id is null or p_secret is null or length(p_secret)<24 or length(p_secret)>500 then
    raise exception 'invalid credential input';
  end if;
  if p_base_url not in ('https://api.anthropic.com','https://brewkeg.dev') then
    raise exception 'unsupported provider endpoint';
  end if;
  if starts_with(p_secret,'sk-ant-') then
    if p_base_url <> 'https://api.anthropic.com' then
      raise exception 'Anthropic keys must use the official Anthropic endpoint';
    end if;
  elsif starts_with(p_secret,'bk_live_') then
    if p_base_url <> 'https://brewkeg.dev' then
      raise exception 'Gateway tokens must use the configured BrewKeg endpoint';
    end if;
  else
    raise exception 'unsupported provider credential format';
  end if;

  select vault_secret_id into existing_id
  from public.user_provider_credentials where user_id=p_user_id for update;

  if existing_id is null then
    secret_id := vault.create_secret(p_secret,'studyhub-byok-'||p_user_id::text,
      'Study Hub user-owned provider credential',null);
    insert into public.user_provider_credentials(user_id,provider,vault_secret_id,base_url)
    values(p_user_id,'anthropic_compatible',secret_id,p_base_url)
    on conflict(user_id) do update
      set provider=excluded.provider,vault_secret_id=excluded.vault_secret_id,
          base_url=excluded.base_url,updated_at=now();
  else
    perform vault.update_secret(existing_id,p_secret,'studyhub-byok-'||p_user_id::text,
      'Study Hub user-owned provider credential',null);
    update public.user_provider_credentials
      set base_url=p_base_url,updated_at=now() where user_id=p_user_id;
  end if;
end;
$$;
revoke all on function public.store_user_provider_credential(uuid,text,text) from public,anon,authenticated;
grant execute on function public.store_user_provider_credential(uuid,text,text) to service_role;
