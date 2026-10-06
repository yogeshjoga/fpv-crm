-- Recruiter notes, interview scores and interviewer feedback are internal. A candidate can read their own
-- application row, so those must not live on it: HR notes move to a staff-only table, and a candidate sees the
-- interview rounds only through a function that leaves out the score and feedback.

create table public.careers_application_notes (
  application_id uuid primary key references public.careers_applications(id) on delete cascade,
  notes text not null default '' check (char_length(notes) <= 5000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.careers_application_notes enable row level security;
create policy careers_notes_staff_read on public.careers_application_notes for select using (public.has_module_access('careers', 'read'));
create policy careers_notes_staff_write on public.careers_application_notes for all
  using (public.has_module_access('careers', 'write')) with check (public.has_module_access('careers', 'write'));

-- the apply policy and the student guard no longer mention hr_notes
drop policy careers_applications_apply on public.careers_applications;
create policy careers_applications_apply on public.careers_applications for insert with check (
  student_id = auth.uid()
  and public.is_active_user()
  and not public.is_staff()
  and status = 'applied'
  and current_round_id is null
  and offer_note = ''
  and (resume_path is null or resume_path like auth.uid()::text || '/%')
  and exists (
    select 1 from public.careers_jobs j
     where j.id = job_id and j.status = 'open'
       and (j.apply_starts_at is null or j.apply_starts_at <= now())
       and (j.apply_ends_at is null or j.apply_ends_at > now())
  )
);

create or replace function public.careers_guard_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_module_access('careers', 'write') then
    new.updated_at := now();
    return new;
  end if;
  new.job_id := old.job_id;
  new.student_id := old.student_id;
  new.answers := old.answers;
  new.resume_path := old.resume_path;
  new.accepted_terms_at := old.accepted_terms_at;
  new.current_round_id := old.current_round_id;
  new.offer_note := old.offer_note;
  new.created_at := old.created_at;
  if not (new.status = 'withdrawn' and old.status in ('applied', 'in_review', 'shortlisted', 'interviewing')) then
    new.status := old.status;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

alter table public.careers_applications drop column hr_notes;

-- a candidate no longer reads round rows directly (they carry score and feedback)
drop policy careers_app_rounds_own on public.careers_application_rounds;

create or replace function public.careers_my_rounds()
returns table (
  application_id uuid,
  round_id uuid,
  round_position integer,
  name text,
  kind text,
  description text,
  status text,
  scheduled_at timestamptz,
  interviewer text,
  meet_link text,
  exam_slug text
)
language sql stable security definer set search_path = public as $$
  select ar.application_id, ar.round_id, cr.position, cr.name, cr.kind, cr.description, ar.status,
         ar.scheduled_at, ar.interviewer, ar.meet_link,
         (select c.slug from public.courses c where c.id = cr.exam_course_id and c.status = 'published')
    from public.careers_application_rounds ar
    join public.careers_applications a on a.id = ar.application_id
    join public.careers_rounds cr on cr.id = ar.round_id
   where a.student_id = auth.uid()
   order by cr.position;
$$;
revoke all on function public.careers_my_rounds() from public, anon;
grant execute on function public.careers_my_rounds() to authenticated;
