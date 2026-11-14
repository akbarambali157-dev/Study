-- Permit the explicit user-initiated push self-test event.
alter table public.notifications
  drop constraint if exists notifications_notification_type_check;
alter table public.notifications
  add constraint notifications_notification_type_check
  check (notification_type in (
    'direct_message','post_reply','post_reaction','collaboration_invite',
    'course_update','system','push_test'
  ));
