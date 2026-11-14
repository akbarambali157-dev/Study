create table if not exists public.academic_group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.academic_groups(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(group_id,invitee_id),
  check(inviter_id <> invitee_id)
);
create index if not exists academic_group_invites_inbox_idx on public.academic_group_invites(invitee_id,status,created_at desc);
create index if not exists academic_group_invites_group_idx on public.academic_group_invites(group_id,status);
alter table public.academic_group_invites enable row level security;
revoke all on public.academic_group_invites from public,anon,authenticated;
grant select,insert,update,delete on public.academic_group_invites to authenticated;
create or replace function private.can_invite_to_group(p_group_id uuid,p_inviter uuid,p_invitee uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$
  select p_inviter=(select auth.uid()) and p_inviter<>p_invitee
    and exists(select 1 from public.academic_group_members m where m.group_id=p_group_id and m.user_id=p_inviter and m.status='active' and m.member_role in ('owner','moderator'))
    and exists(select 1 from public.student_profiles sp where sp.user_id=p_invitee and sp.discoverable=true and sp.profile_visibility='public')
    and not private.users_blocked(p_inviter,p_invitee);
$$;
revoke all on function private.can_invite_to_group(uuid,uuid,uuid) from public,anon;
grant execute on function private.can_invite_to_group(uuid,uuid,uuid) to authenticated;
create or replace function private.can_view_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$
  select exists(select 1 from public.academic_groups g where g.id=p_group_id and (
    g.visibility='public' or private.is_group_member(g.id)
    or exists(select 1 from public.academic_group_invites i where i.group_id=g.id and i.invitee_id=(select auth.uid()) and i.status='pending')
  ));
$$;
revoke all on function private.can_view_group(uuid) from public,anon;
grant execute on function private.can_view_group(uuid) to authenticated;
create policy "Participants read group invitations" on public.academic_group_invites for select to authenticated using (
  invitee_id=(select auth.uid()) or inviter_id=(select auth.uid()) or private.is_group_owner(group_id));
create policy "Group owners invite opted-in students" on public.academic_group_invites for insert to authenticated with check (
  private.can_invite_to_group(group_id,inviter_id,invitee_id));
create policy "Invitees accept or decline invitations" on public.academic_group_invites for update to authenticated
using (invitee_id=(select auth.uid()) and status='pending')
with check (invitee_id=(select auth.uid()) and status in ('accepted','declined'));
create or replace function public.accept_academic_group_invite()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if new.status='accepted' and old.status='pending' then
    insert into public.academic_group_members(group_id,user_id,member_role,status)
    values(new.group_id,new.invitee_id,'member','active') on conflict(group_id,user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.accept_academic_group_invite() from public,anon,authenticated;
drop trigger if exists academic_group_invite_accepted on public.academic_group_invites;
create trigger academic_group_invite_accepted after update of status on public.academic_group_invites
for each row execute function public.accept_academic_group_invite();
create or replace function public.notify_academic_group_invite()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare group_title text; enabled boolean;
begin
  select title into group_title from public.academic_groups where id=new.group_id;
  select coalesce(collaboration_invites,true) and not coalesce(pause_all,false) into enabled
  from public.notification_preferences where user_id=new.invitee_id;
  if coalesce(enabled,true) then
    insert into public.notifications(user_id,actor_id,notification_type,entity_id,title,body,target_path,dedupe_key)
    values(new.invitee_id,new.inviter_id,'collaboration_invite',new.group_id,'Invitation to '||coalesce(group_title,'an academic space'),
      'You have been invited to join an academic group.','/groups/'||new.group_id::text,'group-invite:'||new.id::text)
    on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.notify_academic_group_invite() from public,anon,authenticated;
drop trigger if exists academic_group_invite_notification on public.academic_group_invites;
create trigger academic_group_invite_notification after insert on public.academic_group_invites
for each row execute function public.notify_academic_group_invite();
