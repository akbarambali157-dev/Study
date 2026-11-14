create table if not exists public.user_provider_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'anthropic_compatible' check (provider='anthropic_compatible'),
  vault_secret_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_provider_credentials enable row level security;
revoke all on public.user_provider_credentials from public,anon,authenticated;
grant all on public.user_provider_credentials to service_role;

create or replace function public.store_user_provider_credential(p_user_id uuid,p_secret text)
returns void language plpgsql security definer set search_path=public,vault,pg_temp
as $$
declare existing_id uuid; secret_id uuid;
begin
  if p_user_id is null or p_secret is null or length(p_secret)<24 or length(p_secret)>500 then raise exception 'invalid credential input'; end if;
  select vault_secret_id into existing_id from public.user_provider_credentials where user_id=p_user_id for update;
  if existing_id is null then
    secret_id := vault.create_secret(p_secret,'studyhub-byok-'||p_user_id::text,'Study Hub user-owned provider credential',null);
    insert into public.user_provider_credentials(user_id,provider,vault_secret_id) values(p_user_id,'anthropic_compatible',secret_id)
    on conflict(user_id) do update set provider=excluded.provider,vault_secret_id=excluded.vault_secret_id,updated_at=now();
  else
    perform vault.update_secret(existing_id,p_secret,'studyhub-byok-'||p_user_id::text,'Study Hub user-owned provider credential',null);
    update public.user_provider_credentials set updated_at=now() where user_id=p_user_id;
  end if;
end;
$$;
create or replace function public.get_user_provider_credential(p_user_id uuid)
returns text language sql stable security definer set search_path=public,vault,pg_temp
as $$
  select ds.decrypted_secret from public.user_provider_credentials c
  join vault.decrypted_secrets ds on ds.id=c.vault_secret_id
  where c.user_id=p_user_id and c.provider='anthropic_compatible' limit 1;
$$;
create or replace function public.delete_user_provider_credential(p_user_id uuid)
returns void language plpgsql security definer set search_path=public,vault,pg_temp
as $$
declare existing_id uuid;
begin
  select vault_secret_id into existing_id from public.user_provider_credentials where user_id=p_user_id for update;
  if existing_id is not null then delete from vault.secrets where id=existing_id; delete from public.user_provider_credentials where user_id=p_user_id; end if;
end;
$$;
revoke all on function public.store_user_provider_credential(uuid,text) from public,anon,authenticated;
revoke all on function public.get_user_provider_credential(uuid) from public,anon,authenticated;
revoke all on function public.delete_user_provider_credential(uuid) from public,anon,authenticated;
grant execute on function public.store_user_provider_credential(uuid,text) to service_role;
grant execute on function public.get_user_provider_credential(uuid) to service_role;
grant execute on function public.delete_user_provider_credential(uuid) to service_role;
