-- Time-spent analytics: per-student-per-course study time, per-staff admin-panel
-- activity time. Both are day-bucketed counters, written only through a
-- SECURITY DEFINER RPC (never direct table writes) so a client can only ever
-- add time for itself, never edit or forge another user's numbers.

create table public.study_time (
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  day        date not null default current_date,
  seconds    int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, course_id, day)
);
create index on public.study_time (course_id, day);

create table public.staff_activity_time (
  staff_id   uuid not null references public.profiles(id) on delete cascade,
  day        date not null default current_date,
  seconds    int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (staff_id, day)
);
create index on public.staff_activity_time (day);

alter table public.study_time enable row level security;
alter table public.staff_activity_time enable row level security;

-- read-only for clients; all writes go through the RPCs below
create policy study_time_select on public.study_time
  for select using (student_id = auth.uid() or public.is_staff());
create policy staff_activity_select on public.staff_activity_time
  for select using (staff_id = auth.uid() or public.is_super_admin());

create or replace function public.increment_study_time(p_course_id uuid, p_seconds int)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- sanity cap: a single flush can never claim more than an hour, so a
  -- stray/forged call can't inflate the total by much
  if p_seconds is null or p_seconds <= 0 or p_seconds > 3600 or auth.uid() is null then
    return;
  end if;
  insert into public.study_time (student_id, course_id, day, seconds, updated_at)
  values (auth.uid(), p_course_id, current_date, p_seconds, now())
  on conflict (student_id, course_id, day)
  do update set seconds = public.study_time.seconds + excluded.seconds, updated_at = now();
end;
$$;
revoke all on function public.increment_study_time(uuid, int) from public;
grant execute on function public.increment_study_time(uuid, int) to authenticated;

create or replace function public.increment_staff_activity(p_seconds int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_seconds is null or p_seconds <= 0 or p_seconds > 3600 or auth.uid() is null or not public.is_staff() then
    return;
  end if;
  insert into public.staff_activity_time (staff_id, day, seconds, updated_at)
  values (auth.uid(), current_date, p_seconds, now())
  on conflict (staff_id, day)
  do update set seconds = public.staff_activity_time.seconds + excluded.seconds, updated_at = now();
end;
$$;
revoke all on function public.increment_staff_activity(int) from public;
grant execute on function public.increment_staff_activity(int) to authenticated;
