create or replace function private.can_read_group_posts(p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$
  select exists(select 1 from public.academic_groups g where g.id=p_group_id and
    (g.visibility='public' or private.is_group_member(g.id)));
$$;
revoke all on function private.can_read_group_posts(uuid) from public,anon;
grant execute on function private.can_read_group_posts(uuid) to authenticated;
drop policy if exists "Members view posts in visible groups" on public.academic_group_posts;
create policy "Active members view group posts" on public.academic_group_posts for select to authenticated
using (private.can_read_group_posts(group_id));
drop policy if exists "Group members are visible to eligible viewers" on public.academic_group_members;
create policy "Active group members can view membership" on public.academic_group_members for select to authenticated
using (private.is_group_member(group_id) or private.is_group_owner(group_id));
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
