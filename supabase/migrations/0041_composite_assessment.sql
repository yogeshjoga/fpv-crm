-- Composite assessment: a course's final result is the sum of an online exam plus marks that
-- instructors enter student-by-student for the viva, simulation and real piloting rounds.
-- The certificate type (Merit / Participation) is decided by the total, not by the online exam.
alter table public.courses
  add column scoring_mode text not null default 'exam_only' check (scoring_mode in ('exam_only', 'composite')),
  add column marks_online numeric(6,2) not null default 15 check (marks_online >= 0),
  add column marks_viva numeric(6,2) not null default 15 check (marks_viva >= 0),
  add column marks_simulation numeric(6,2) not null default 30 check (marks_simulation >= 0),
  add column marks_piloting numeric(6,2) not null default 40 check (marks_piloting >= 0),
  add column merit_min_marks numeric(6,2) not null default 75 check (merit_min_marks >= 0);

-- A certificate can now carry its own type ("Merit" / "Participation"); null falls back to the course's.
alter table public.certificates add column cert_type text;

drop function if exists public.verify_certificate(text);
create function public.verify_certificate(p_cert_id text)
returns table (
  valid               boolean,
  student_name        text,
  course_title        text,
  cert_type           text,
  issued_at           timestamptz,
  score_pct           numeric,
  revoked             boolean,
  cert_id_string      text,
  org_name            text,
  verify_base_url     text,
  cert_background_url text
)
language sql stable security definer set search_path = public as $$
  select
    (c.id is not null and not c.revoked)      as valid,
    p.full_name                               as student_name,
    co.title                                  as course_title,
    coalesce(c.cert_type, co.cert_type)       as cert_type,
    c.issued_at,
    c.score_pct,
    coalesce(c.revoked, false)                as revoked,
    c.cert_id_string,
    (select o.org_name from public.org_settings o limit 1),
    (select o.verify_base_url from public.org_settings o limit 1),
    (select o.cert_background_url from public.org_settings o limit 1)
  from public.certificates c
  join public.profiles p on p.id = c.student_id
  join public.courses  co on co.id = c.course_id
  where upper(c.cert_id_string) = upper(p_cert_id);
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- Instructor-entered marks for the rounds that are not the online exam.
create table public.assessment_marks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  component text not null check (component in ('viva', 'simulation', 'piloting')),
  marks numeric(6,2) not null check (marks >= 0),
  entered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, student_id, component)
);
create index assessment_marks_course_idx on public.assessment_marks (course_id);

alter table public.assessment_marks enable row level security;
create policy assessment_marks_staff on public.assessment_marks for all
  using (public.is_staff()) with check (public.is_staff());
create policy assessment_marks_own_read on public.assessment_marks for select
  using (student_id = auth.uid());

-- Marks can never exceed what the course allots to that component.
create or replace function public.check_assessment_mark() returns trigger
language plpgsql as $$
declare cap numeric;
begin
  select case new.component
           when 'viva' then marks_viva
           when 'simulation' then marks_simulation
           when 'piloting' then marks_piloting
         end
    into cap from public.courses where id = new.course_id;
  if new.marks > cap then
    raise exception 'Marks for % cannot be more than %', new.component, cap;
  end if;
  new.updated_at = now();
  if auth.uid() is not null then new.entered_by = auth.uid(); end if;
  return new;
end;
$$;
create trigger assessment_marks_check before insert or update on public.assessment_marks
  for each row execute function public.check_assessment_mark();

-- Instructors can enter marks out of the box; a super admin can still change this per module.
insert into public.instructor_module_access (module_key, access_level) values ('exams', 'write')
on conflict (module_key) do nothing;

-- Sivani final: one attempt, scored out of 100 (online 15 + viva 15 + simulation 30 + piloting 40).
update public.courses
   set max_attempts = 1, scoring_mode = 'composite'
 where id = '7eacd2fe-6078-4851-bd52-ab3f6c3cd723';
