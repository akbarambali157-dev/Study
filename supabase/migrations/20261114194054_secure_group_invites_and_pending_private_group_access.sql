create index if not exists academic_group_invites_inviter_idx
  on public.academic_group_invites(inviter_id,status,created_at desc);

revoke update on public.academic_group_invites from authenticated;
grant update (status,responded_at) on public.academic_group_invites to authenticated;

drop policy if exists "Students view public or joined academic groups" on public.academic_groups;
create policy "Students view public joined or invited academic groups"
on public.academic_groups for select to authenticated
using (private.can_view_group(id));
