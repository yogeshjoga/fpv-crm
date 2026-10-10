-- Instructors are notified of new website enquiries (see the site-enquiry function), so they need to open
-- and work them: read the lead, update its status and notes. Coordinators stay without access. A super admin can
-- change either role in Company Settings -> module access.

insert into public.role_module_access (role, module_key, access_level) values
  ('instructor', 'enquiries', 'write')
on conflict (role, module_key) do update set access_level = excluded.access_level, updated_at = now();
