-- Lets a super admin control which admin modules an instructor account can
-- see and open. A handful of modules (Analytics, Employees, Users, Company
-- Settings) stay hard-restricted to super_admin at the route level and are
-- intentionally never rows in this table.

create table public.instructor_module_access (
  module_key text primary key,
  visible    boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.instructor_module_access enable row level security;

create policy instructor_module_access_read on public.instructor_module_access
  for select using (public.is_staff());
create policy instructor_module_access_write on public.instructor_module_access
  for all using (public.is_super_admin()) with check (public.is_super_admin());

insert into public.instructor_module_access (module_key, visible) values
  ('registrations', true),
  ('enrollments', true),
  ('approvals', true),
  ('courses', true),
  ('course-groups', true),
  ('forms', true),
  ('calendar', true),
  ('notifications', true),
  ('certificates', true),
  ('ask', true),
  ('help', true)
on conflict (module_key) do nothing;
