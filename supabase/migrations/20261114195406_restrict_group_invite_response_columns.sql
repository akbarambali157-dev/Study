revoke update on public.academic_group_invites from authenticated;
grant update (status,responded_at) on public.academic_group_invites to authenticated;
