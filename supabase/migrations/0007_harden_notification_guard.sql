-- Keep the notification-guard trigger function off the public RPC surface.
revoke execute on function public.guard_notification_immutable() from anon, authenticated, public;
