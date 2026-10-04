-- Per-role section permissions. The old instructor_module_access table was one shared list for every
-- non-super-admin staff role. Now each role has its own access level for each section, set by a super
-- admin in Company Settings:
--   instructor / coordinator / admin : none (hidden) | read | write
--   student                          : none (hidden) | read (visible)
-- Super admins always have everything. A missing row means "read" for staff roles and "visible" for
-- students, which matches the previous behaviour.
create table public.role_module_access (
  role text not null check (role in ('instructor', 'coordinator', 'admin', 'student')),
  module_key text not null,
  access_level text not null check (access_level in ('none', 'read', 'write')),
  updated_at timestamptz not null default now(),
  primary key (role, module_key)
);

alter table public.role_module_access enable row level security;

-- Staff read the whole matrix (the app loads its own role's rows; super admins edit it all);
-- a student reads only the student rows. Only a super admin changes anything.
create policy role_module_access_read on public.role_module_access for select using (
  public.is_staff()
  or role = (select p.role::text from public.profiles p where p.id = auth.uid())
);
create policy role_module_access_write on public.role_module_access for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Carry the current shared configuration over to each staff role so nothing changes until a
-- super admin edits it.
insert into public.role_module_access (role, module_key, access_level)
select r.role, m.module_key, m.access_level
  from public.instructor_module_access m
 cross join (values ('instructor'), ('coordinator'), ('admin')) as r(role)
on conflict (role, module_key) do nothing;
