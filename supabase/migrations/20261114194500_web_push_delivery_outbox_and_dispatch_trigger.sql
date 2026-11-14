alter table public.notification_preferences
  add column if not exists time_zone text not null default 'UTC';

create table if not exists public.push_delivery_log (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null check (status in ('sent','expired','failed','skipped')),
  attempted_at timestamptz not null default now(),
  error_code text,
  primary key (notification_id,subscription_id)
);
alter table public.push_delivery_log enable row level security;
revoke all on public.push_delivery_log from public,anon,authenticated;
grant select,insert,update,delete on public.push_delivery_log to service_role;

create or replace function public.get_push_dispatch_config()
returns jsonb language sql stable security definer set search_path=public,vault,pg_temp
as $$
  select jsonb_build_object(
    'vapid_jwks',(select decrypted_secret::jsonb from vault.decrypted_secrets where name='studyhub-vapid-jwks' limit 1),
    'dispatch_token',(select decrypted_secret from vault.decrypted_secrets where name='studyhub-push-dispatch-token' limit 1)
  );
$$;
revoke all on function public.get_push_dispatch_config() from public,anon,authenticated;
grant execute on function public.get_push_dispatch_config() to service_role;

create or replace function private.get_push_dispatch_token()
returns text language sql stable security definer set search_path=public,vault,pg_temp
as $$
  select decrypted_secret from vault.decrypted_secrets where name='studyhub-push-dispatch-token' limit 1;
$$;
revoke all on function private.get_push_dispatch_token() from public,anon,authenticated;

create or replace function private.dispatch_notification_push()
returns trigger language plpgsql security definer set search_path=public,private,net,pg_temp
as $$
declare dispatch_token text;
begin
  dispatch_token := private.get_push_dispatch_token();
  if dispatch_token is null or length(dispatch_token)<32 then return new; end if;
  perform net.http_post(
    url := 'https://ewqogapdsvivpgpwaxfh.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object('Authorization','Bearer '||dispatch_token,'Content-Type','application/json'),
    body := jsonb_build_object('notification_id',new.id),
    timeout_milliseconds := 1000
  );
  return new;
end;
$$;
revoke all on function private.dispatch_notification_push() from public,anon,authenticated;
drop trigger if exists notifications_dispatch_web_push on public.notifications;
create trigger notifications_dispatch_web_push after insert on public.notifications
for each row execute function private.dispatch_notification_push();
