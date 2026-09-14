-- Course groups ("workshops"): bundle courses together and grant a batch of
-- students access to every course in the bundle in one action.

create table public.course_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.course_groups enable row level security;
create policy course_groups_staff on public.course_groups
  for all using (public.is_staff()) with check (public.is_staff());

create table public.course_group_courses (
  group_id  uuid not null references public.course_groups(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (group_id, course_id)
);
alter table public.course_group_courses enable row level security;
create policy course_group_courses_staff on public.course_group_courses
  for all using (public.is_staff()) with check (public.is_staff());

create table public.course_group_members (
  group_id   uuid not null references public.course_groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  added_at   timestamptz not null default now(),
  added_by   uuid references public.profiles(id) on delete set null,
  primary key (group_id, student_id)
);
alter table public.course_group_members enable row level security;
create policy course_group_members_staff on public.course_group_members
  for all using (public.is_staff()) with check (public.is_staff());
create policy course_group_members_self_select on public.course_group_members
  for select using (student_id = auth.uid());

create index on public.course_group_courses (course_id);
create index on public.course_group_members (student_id);
