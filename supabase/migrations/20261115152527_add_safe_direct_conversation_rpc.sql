create or replace function public.start_direct_conversation(p_recipient_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_sender_id uuid := auth.uid();
  v_recipient_policy text;
  v_conversation_id uuid;
begin
  if v_sender_id is null then
    raise exception 'Sign in before starting a conversation.'
      using errcode = '28000';
  end if;

  if p_recipient_id is null or p_recipient_id = v_sender_id then
    raise exception 'Choose another student to start a conversation.'
      using errcode = '22023';
  end if;

  select sp.message_policy
    into v_recipient_policy
  from public.student_profiles sp
  where sp.user_id = p_recipient_id
    and sp.discoverable = true
    and sp.profile_visibility = 'public';

  if not found or v_recipient_policy is null or v_recipient_policy = 'nobody'
     or v_recipient_policy not in ('everyone', 'requests') then
    raise exception 'This student is not accepting new message requests.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = v_sender_id and b.blocked_id = p_recipient_id)
       or (b.blocker_id = p_recipient_id and b.blocked_id = v_sender_id)
  ) then
    raise exception 'A safety restriction prevents this conversation.'
      using errcode = '42501';
  end if;

  select c.id
    into v_conversation_id
  from public.conversations c
  where (c.created_by = v_sender_id and c.recipient_id = p_recipient_id)
     or (c.created_by = p_recipient_id and c.recipient_id = v_sender_id)
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (created_by, recipient_id)
  values (v_sender_id, p_recipient_id)
  returning id into v_conversation_id;

  return v_conversation_id;
exception
  when unique_violation then
    select c.id
      into v_conversation_id
    from public.conversations c
    where (c.created_by = v_sender_id and c.recipient_id = p_recipient_id)
       or (c.created_by = p_recipient_id and c.recipient_id = v_sender_id)
    limit 1;

    if v_conversation_id is not null then
      return v_conversation_id;
    end if;
    raise;
end;
$function$;

revoke all on function public.start_direct_conversation(uuid) from public, anon, authenticated;
grant execute on function public.start_direct_conversation(uuid) to authenticated;
