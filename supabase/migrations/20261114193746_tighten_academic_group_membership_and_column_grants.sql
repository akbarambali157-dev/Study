revoke update on public.academic_groups from authenticated;
grant update (title,description,institution,faculty,department,course_code,level,semester,academic_session,visibility,updated_at)
on public.academic_groups to authenticated;
revoke update on public.academic_group_posts from authenticated;
grant update (title,body,updated_at) on public.academic_group_posts to authenticated;
drop policy if exists "Students leave groups or owners remove members" on public.academic_group_members;
create policy "Students leave or owners remove non-owner members" on public.academic_group_members
for delete to authenticated using (
  (user_id=(select auth.uid()) and member_role <> 'owner')
  or (private.is_group_owner(group_id) and user_id <> (select auth.uid()))
);
