-- 'admin' (co-founder-level staff) counts as staff exactly like instructor and
-- coordinator — same is_staff()-gated read access, same instructor_module_access
-- system for what they can additionally write to. It never passes
-- is_super_admin(), so Users/Settings/Employees/Analytics stay closed to it.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('instructor', 'coordinator', 'admin', 'super_admin') from public.profiles where id = auth.uid()),
    false);
$$;
