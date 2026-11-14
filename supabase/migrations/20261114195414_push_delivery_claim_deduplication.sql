-- Claim each notification/device delivery atomically before sending.
-- This prevents concurrent dispatch invocations from delivering duplicates.
alter table public.push_delivery_log
  drop constraint if exists push_delivery_log_status_check;

alter table public.push_delivery_log
  add constraint push_delivery_log_status_check
  check (status in ('processing','sent','expired','failed','skipped'));

create or replace function public.claim_push_delivery(
  p_notification_id uuid,
  p_subscription_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare claimed boolean;
begin
  insert into public.push_delivery_log(notification_id,subscription_id,status,attempted_at,error_code)
  values(p_notification_id,p_subscription_id,'processing',now(),null)
  on conflict(notification_id,subscription_id) do update
    set status='processing', attempted_at=now(), error_code=null
    where public.push_delivery_log.status='failed'
       or (public.push_delivery_log.status='processing'
           and public.push_delivery_log.attempted_at < now() - interval '5 minutes')
  returning true into claimed;
  return coalesce(claimed,false);
end;
$$;

revoke all on function public.claim_push_delivery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_push_delivery(uuid,uuid) to service_role;
