alter function public.audit_log_immutable() set search_path = public;
-- is_staff() and is_super_admin() are SECURITY DEFINER and call it as their owner, so clients do not need to
revoke execute on function public.mfa_ok() from authenticated;
