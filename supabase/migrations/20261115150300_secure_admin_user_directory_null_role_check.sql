-- Fail closed when the authenticated JWT has no app_metadata.role claim.
create or replace function public.admin_user_directory()
returns table(
  user_id uuid, email text, display_name text, institution text, faculty text,
  department text, level text, account_created_at timestamptz,
  last_sign_in_at timestamptz, last_activity_at timestamptz,
  ai_requests bigint, total_tokens bigint, published_materials bigint, is_anonymous boolean
)
language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt())->'app_metadata'->>'role','') <> 'admin' then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  return query
  select u.id, u.email::text,
    coalesce(nullif(sp.display_name,''), nullif(u.raw_user_meta_data->>'display_name',''),
      nullif(u.raw_user_meta_data->>'full_name',''), split_part(coalesce(u.email,''),'@',1))::text,
    coalesce(sp.institution,'')::text, coalesce(sp.faculty,'')::text,
    coalesce(sp.department,'')::text, coalesce(sp.level,'')::text,
    u.created_at, u.last_sign_in_at,
    greatest(u.last_sign_in_at, au.last_ai_at, pm.last_publish_at),
    coalesce(au.ai_requests,0)::bigint, coalesce(au.total_tokens,0)::bigint,
    coalesce(pm.published_materials,0)::bigint, coalesce(u.is_anonymous,false)
  from auth.users u
  left join public.student_profiles sp on sp.user_id=u.id
  left join lateral (
    select count(*)::bigint as ai_requests,
      coalesce(sum(input_tokens+output_tokens),0)::bigint as total_tokens,
      max(created_at) as last_ai_at
    from public.ai_usage where user_id=u.id
  ) au on true
  left join lateral (
    select count(*)::bigint as published_materials, max(created_at) as last_publish_at
    from public.public_materials where owner_id=u.id and is_public=true
  ) pm on true
  where u.deleted_at is null
  order by coalesce(u.last_sign_in_at,u.created_at) desc;
end;
$$;
revoke all on function public.admin_user_directory() from public, anon;
grant execute on function public.admin_user_directory() to authenticated;
