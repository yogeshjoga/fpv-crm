-- EgireRobotics LMS — advisor hardening.
-- - lock set_updated_at search_path
-- - keep internal-only SECURITY DEFINER functions off the public RPC surface
--   (the is_*/current_user_* helpers stay executable: RLS policies reference them)

alter function public.set_updated_at() set search_path = public;

revoke execute on function public.next_cert_number(text)              from anon, authenticated, public;
revoke execute on function public.handle_new_user()                   from anon, authenticated, public;
revoke execute on function public.guard_profile_privileged_columns()  from anon, authenticated, public;

comment on table public.cert_counters is
  'Service-role only. RLS enabled with no policies is intentional — never client-accessible.';
