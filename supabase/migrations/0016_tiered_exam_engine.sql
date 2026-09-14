-- Extends the exam engine to support a second, opt-in grading mode ("tiered")
-- alongside the existing pass/fail one. Every new column defaults to values
-- that make existing courses behave exactly as before.

alter table public.questions add column if not exists difficulty text not null default 'medium';
alter table public.questions add constraint questions_difficulty_check
  check (difficulty in ('easy', 'medium', 'hard'));
alter table public.questions add column if not exists points int not null default 1;

alter table public.courses add column if not exists grading_mode text not null default 'pass_fail';
alter table public.courses add constraint courses_grading_mode_check
  check (grading_mode in ('pass_fail', 'tiered'));
-- only meaningful when grading_mode = 'tiered'; null for every existing course
alter table public.courses add column if not exists mix_hard int;
alter table public.courses add column if not exists mix_medium int;
alter table public.courses add column if not exists mix_easy int;

-- populated only for grading_mode = 'tiered' attempts; null (and unused) otherwise
alter table public.exam_attempts add column if not exists grade_label text;

-- lets one course's exam draw its question pool from several other courses'
-- question banks (used by the "Comprehensive" certification)
create table public.exam_pool_sources (
  course_id uuid not null references public.courses(id) on delete cascade,
  source_course_id uuid not null references public.courses(id) on delete cascade,
  primary key (course_id, source_course_id)
);
alter table public.exam_pool_sources enable row level security;
create policy exam_pool_sources_staff on public.exam_pool_sources
  for all using (public.is_staff()) with check (public.is_staff());
