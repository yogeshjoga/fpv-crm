-- Coordinators count as staff (is_staff()) so they can reach RequireModule-gated
-- admin pages and inherit the same broad read access to registrations,
-- enrollments, exam_attempts, study_time and profiles that instructors already
-- have (every one of those RLS policies is written as `... or is_staff()`), plus
-- write access to whatever modules a super admin sets to 'write'. They never
-- pass is_super_admin(), so the hard super-admin-only pages/writes stay closed.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('instructor', 'coordinator', 'super_admin') from public.profiles where id = auth.uid()),
    false);
$$;

-- Which course groups a coordinator is responsible for. Mirrors
-- course_group_members exactly: many coordinators per group, one coordinator
-- across many groups. Assigning/removing here is the same "bulk convenience
-- layer over enrollments" philosophy as course_group_members and
-- course_group_courses — see the fpv-crm-admin-panel skill.
create table public.course_group_coordinators (
  group_id       uuid not null references public.course_groups(id) on delete cascade,
  coordinator_id uuid not null references public.profiles(id) on delete cascade,
  added_at       timestamptz not null default now(),
  added_by       uuid references public.profiles(id) on delete set null,
  primary key (group_id, coordinator_id)
);
alter table public.course_group_coordinators enable row level security;
create policy course_group_coordinators_staff on public.course_group_coordinators
  for all using (public.is_staff()) with check (public.is_staff());
create policy course_group_coordinators_self_select on public.course_group_coordinators
  for select using (coordinator_id = auth.uid());
create index on public.course_group_coordinators (coordinator_id);

-- New admin module: the combined student-activity view (enrollments, exam
-- attempts, last-active) coordinators and instructors both use.
insert into public.instructor_module_access (module_key, access_level)
values ('student-activity', 'read')
on conflict (module_key) do nothing;
