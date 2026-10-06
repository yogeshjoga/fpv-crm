-- Careers and recruitment: internships and jobs an admin opens, an application form and terms, an apply
-- window, student applications, and a tracked interview pipeline (screening, online test, interviews, HR, offer).
-- Access follows the section permission 'careers' (admin: write, instructor/coordinator: none by default,
-- super admin always everything), so an HR person can be given Write on Careers without any other rights.

create table public.careers_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,100}$'),
  kind text not null default 'internship' check (kind in ('internship', 'full_time', 'part_time', 'contract')),
  department text not null default '' check (char_length(department) <= 120),
  location text not null default '' check (char_length(location) <= 160),
  work_mode text not null default 'onsite' check (work_mode in ('onsite', 'remote', 'hybrid')),
  openings integer not null default 1 check (openings between 1 and 1000),
  pay text not null default '' check (char_length(pay) <= 120),
  summary text not null default '' check (char_length(summary) <= 400),
  jd text not null default '' check (char_length(jd) <= 20000),
  terms text not null default '' check (char_length(terms) <= 20000),
  -- [{ id, label, type: text|textarea|number|select|yesno|url, required, options: [..] }]
  form_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(form_fields) = 'array' and pg_column_size(form_fields) < 40000),
  ask_resume boolean not null default true,
  apply_starts_at timestamptz,
  apply_ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (apply_ends_at is null or apply_starts_at is null or apply_ends_at > apply_starts_at)
);

create table public.careers_rounds (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.careers_jobs(id) on delete cascade,
  position integer not null default 0,
  name text not null check (char_length(name) between 2 and 120),
  kind text not null default 'interview' check (kind in ('screening', 'online_test', 'interview', 'group_discussion', 'hr', 'final')),
  -- an online test reuses the exam engine: link a course whose questions make up the test
  exam_course_id uuid references public.courses(id) on delete set null,
  pass_score numeric check (pass_score is null or pass_score between 0 and 100),
  description text not null default '' check (char_length(description) <= 2000)
);
create index careers_rounds_job on public.careers_rounds (job_id, position);

create table public.careers_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.careers_jobs(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) < 40000),
  resume_path text,
  accepted_terms_at timestamptz not null,
  status text not null default 'applied'
    check (status in ('applied', 'in_review', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn')),
  current_round_id uuid references public.careers_rounds(id) on delete set null,
  hr_notes text not null default '' check (char_length(hr_notes) <= 5000),
  offer_note text not null default '' check (char_length(offer_note) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, student_id)
);
create index careers_applications_job on public.careers_applications (job_id, status);
create index careers_applications_student on public.careers_applications (student_id);

create table public.careers_application_rounds (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.careers_applications(id) on delete cascade,
  round_id uuid not null references public.careers_rounds(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'completed', 'passed', 'failed', 'no_show')),
  scheduled_at timestamptz,
  interviewer text not null default '' check (char_length(interviewer) <= 160),
  meet_link text not null default '' check (char_length(meet_link) <= 500),
  score numeric,
  feedback text not null default '' check (char_length(feedback) <= 5000),
  updated_at timestamptz not null default now(),
  unique (application_id, round_id)
);

create table public.careers_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.careers_applications(id) on delete cascade,
  actor uuid references public.profiles(id) on delete set null,
  kind text not null,
  note text not null default '',
  visible_to_student boolean not null default true,
  created_at timestamptz not null default now()
);
create index careers_events_app on public.careers_events (application_id, created_at);

alter table public.careers_jobs enable row level security;
alter table public.careers_rounds enable row level security;
alter table public.careers_applications enable row level security;
alter table public.careers_application_rounds enable row level security;
alter table public.careers_events enable row level security;

-- jobs: staff by permission; students see open jobs (and any job they applied to)
create policy careers_jobs_read on public.careers_jobs for select using (
  public.has_module_access('careers', 'read')
  or (public.is_active_user() and status = 'open')
  or exists (select 1 from public.careers_applications a where a.job_id = careers_jobs.id and a.student_id = auth.uid())
);
create policy careers_jobs_write on public.careers_jobs for all
  using (public.has_module_access('careers', 'write')) with check (public.has_module_access('careers', 'write'));

-- rounds: readable wherever the job is readable
create policy careers_rounds_read on public.careers_rounds for select using (
  exists (select 1 from public.careers_jobs j where j.id = careers_rounds.job_id)
);
create policy careers_rounds_write on public.careers_rounds for all
  using (public.has_module_access('careers', 'write')) with check (public.has_module_access('careers', 'write'));

-- applications
create policy careers_applications_staff_read on public.careers_applications for select using (public.has_module_access('careers', 'read'));
create policy careers_applications_own_read on public.careers_applications for select using (student_id = auth.uid());
create policy careers_applications_staff_update on public.careers_applications for update
  using (public.has_module_access('careers', 'write')) with check (public.has_module_access('careers', 'write'));
create policy careers_applications_staff_delete on public.careers_applications for delete using (public.has_module_access('careers', 'write'));
-- a student can apply only to an open job, inside its window, for themselves, having accepted the terms
create policy careers_applications_apply on public.careers_applications for insert with check (
  student_id = auth.uid()
  and public.is_active_user()
  and not public.is_staff()
  and status = 'applied'
  and current_round_id is null
  and hr_notes = '' and offer_note = ''
  and (resume_path is null or resume_path like auth.uid()::text || '/%')
  and exists (
    select 1 from public.careers_jobs j
     where j.id = job_id and j.status = 'open'
       and (j.apply_starts_at is null or j.apply_starts_at <= now())
       and (j.apply_ends_at is null or j.apply_ends_at > now())
  )
);
-- a student may only withdraw (enforced by the guard trigger below)
create policy careers_applications_withdraw on public.careers_applications for update
  using (student_id = auth.uid()) with check (student_id = auth.uid());

create or replace function public.careers_guard_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_module_access('careers', 'write') then
    new.updated_at := now();
    return new;
  end if;
  -- everyone else (the student) can change nothing except withdrawing a live application
  new.job_id := old.job_id;
  new.student_id := old.student_id;
  new.answers := old.answers;
  new.resume_path := old.resume_path;
  new.accepted_terms_at := old.accepted_terms_at;
  new.current_round_id := old.current_round_id;
  new.hr_notes := old.hr_notes;
  new.offer_note := old.offer_note;
  new.created_at := old.created_at;
  if not (new.status = 'withdrawn' and old.status in ('applied', 'in_review', 'shortlisted', 'interviewing')) then
    new.status := old.status;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.careers_guard_application() from public, anon, authenticated;
create trigger careers_applications_guard before update on public.careers_applications
  for each row execute function public.careers_guard_application();

-- application rounds and the timeline
create policy careers_app_rounds_staff on public.careers_application_rounds for all
  using (public.has_module_access('careers', 'write')) with check (public.has_module_access('careers', 'write'));
create policy careers_app_rounds_staff_read on public.careers_application_rounds for select using (public.has_module_access('careers', 'read'));
create policy careers_app_rounds_own on public.careers_application_rounds for select using (
  exists (select 1 from public.careers_applications a where a.id = application_id and a.student_id = auth.uid())
);
create policy careers_events_staff_read on public.careers_events for select using (public.has_module_access('careers', 'read'));
create policy careers_events_own on public.careers_events for select using (
  visible_to_student and exists (select 1 from public.careers_applications a where a.id = application_id and a.student_id = auth.uid())
);
create policy careers_events_staff_write on public.careers_events for insert with check (public.has_module_access('careers', 'write'));

-- ───────── notifications (in the app, not by email) ─────────

create or replace function public.careers_ist(p_at timestamptz) returns text language sql immutable as $$
  select to_char(p_at at time zone 'Asia/Kolkata', 'Dy DD Mon YYYY, HH12:MI AM') || ' IST';
$$;

-- tell every active student when an opening goes live, or its window changes while it is open
create or replace function public.careers_notify_job()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_link text := '/app/careers/' || new.slug;
  v_label text := case new.kind when 'internship' then 'Internship' when 'full_time' then 'Full-time job' when 'part_time' then 'Part-time job' else 'Contract role' end;
  v_body text;
begin
  if new.status <> 'open' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'open'
     and new.apply_starts_at is not distinct from old.apply_starts_at
     and new.apply_ends_at is not distinct from old.apply_ends_at then
    return new;
  end if;

  v_body := case when new.apply_starts_at is not null and new.apply_starts_at > now()
                 then 'Applications open ' || public.careers_ist(new.apply_starts_at)
                 else 'Applications are open' end
         || case when new.apply_ends_at is not null then ' · close ' || public.careers_ist(new.apply_ends_at) else '' end
         || '. Open Careers to read the details and apply.';

  delete from public.notifications where kind = 'careers_job' and link = v_link and read_at is null;
  insert into public.notifications (recipient_id, title, body, kind, link)
  select p.id, v_label || ': ' || new.title, v_body, 'careers_job', v_link
    from public.profiles p
   where p.role = 'student' and p.status = 'active' and p.archived_at is null;
  return new;
end;
$$;
revoke all on function public.careers_notify_job() from public, anon, authenticated;
create trigger careers_jobs_notify after insert or update on public.careers_jobs
  for each row execute function public.careers_notify_job();

create or replace function public.careers_touch_job()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger careers_jobs_touch before update on public.careers_jobs
  for each row execute function public.careers_touch_job();

-- timeline + student notification when an application is submitted or moves
create or replace function public.careers_application_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_label text;
begin
  select title into v_title from public.careers_jobs where id = new.job_id;
  if tg_op = 'INSERT' then
    insert into public.careers_events (application_id, actor, kind, note) values (new.id, new.student_id, 'applied', 'Application submitted');
    insert into public.notifications (recipient_id, title, body, kind, link)
    values (new.student_id, 'Application received: ' || v_title, 'We have your application. You will be notified here as it moves forward.', 'careers_update', '/app/careers');
    return new;
  end if;
  if new.status is distinct from old.status then
    v_label := case new.status
      when 'in_review' then 'is being reviewed'
      when 'shortlisted' then 'has been shortlisted'
      when 'interviewing' then 'moved to the interview stage'
      when 'offered' then 'has an offer for you'
      when 'hired' then 'is confirmed. Welcome aboard'
      when 'rejected' then 'was not taken forward this time'
      when 'withdrawn' then 'was withdrawn'
      else 'was updated' end;
    insert into public.careers_events (application_id, actor, kind, note, visible_to_student)
    values (new.id, auth.uid(), 'status', new.status, true);
    if new.status <> 'withdrawn' then
      insert into public.notifications (recipient_id, title, body, kind, link)
      values (new.student_id, 'Your application for ' || v_title, 'Your application ' || v_label || '.', 'careers_update', '/app/careers');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.careers_application_changed() from public, anon, authenticated;
create trigger careers_applications_changed after insert or update on public.careers_applications
  for each row execute function public.careers_application_changed();

create or replace function public.careers_round_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_student uuid;
  v_title text;
  v_round text;
  v_body text;
begin
  select a.student_id, j.title into v_student, v_title
    from public.careers_applications a join public.careers_jobs j on j.id = a.job_id where a.id = new.application_id;
  select name into v_round from public.careers_rounds where id = new.round_id;
  new.updated_at := now();

  if tg_op = 'INSERT'
     or new.scheduled_at is distinct from old.scheduled_at
     or new.status is distinct from old.status then
    v_body := case
      when new.status = 'scheduled' and new.scheduled_at is not null then v_round || ' is scheduled for ' || public.careers_ist(new.scheduled_at)
                   || case when new.meet_link <> '' then ' (link in your application)' else '' end || '.'
      when new.status = 'scheduled' then v_round || ' is the next step. Details will follow.'
      when new.status = 'passed' then 'You cleared ' || v_round || '.'
      when new.status = 'failed' then v_round || ' did not go through this time.'
      when new.status = 'no_show' then 'You missed ' || v_round || '. Please contact us if this was a mistake.'
      when new.status = 'pending' then v_round || ' is the next step. Details will follow.'
      else null end;
    if v_body is not null then
      insert into public.careers_events (application_id, actor, kind, note) values (new.application_id, auth.uid(), 'round', v_round || ': ' || new.status);
      insert into public.notifications (recipient_id, title, body, kind, link)
      values (v_student, 'Interview update: ' || v_title, v_body, 'careers_update', '/app/careers');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.careers_round_changed() from public, anon, authenticated;
create trigger careers_app_rounds_changed before insert or update on public.careers_application_rounds
  for each row execute function public.careers_round_changed();

-- ───────── recruiter actions ─────────

-- Move a candidate into the next round. For an online test the candidate is enrolled in the linked exam
-- (it appears under their courses and on their dashboard, and the exam engine runs it).
create or replace function public.careers_start_round(p_application_id uuid, p_round_id uuid, p_scheduled_at timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_app record;
  v_round record;
  v_course record;
  v_exam text := null;
begin
  if not public.has_module_access('careers', 'write') then
    raise exception 'You need Write access to Careers.' using errcode = '42501';
  end if;
  select id, job_id, student_id, status into v_app from public.careers_applications where id = p_application_id;
  if not found then raise exception 'Application not found.' using errcode = '22023'; end if;
  if v_app.status in ('rejected', 'withdrawn', 'hired') then
    raise exception 'This application is already closed.' using errcode = '22023';
  end if;
  select * into v_round from public.careers_rounds where id = p_round_id and job_id = v_app.job_id;
  if not found then raise exception 'That round does not belong to this job.' using errcode = '22023'; end if;

  if v_round.exam_course_id is not null then
    select id, status, title into v_course from public.courses where id = v_round.exam_course_id;
    if found then
      insert into public.enrollments (student_id, course_id, status, enrolled_by)
      values (v_app.student_id, v_course.id, 'active', auth.uid())
      on conflict (student_id, course_id) do update set status = 'active';
      if v_course.status <> 'published' then v_exam := 'The linked test course is not published, so the candidate cannot see it yet.'; end if;
    end if;
  end if;

  insert into public.careers_application_rounds (application_id, round_id, status, scheduled_at)
  values (p_application_id, p_round_id, case when p_scheduled_at is not null or v_round.exam_course_id is not null then 'scheduled' else 'pending' end, p_scheduled_at)
  on conflict (application_id, round_id) do update set status = 'scheduled', scheduled_at = coalesce(excluded.scheduled_at, careers_application_rounds.scheduled_at);

  update public.careers_applications
     set current_round_id = p_round_id,
         status = case when status in ('applied', 'in_review', 'shortlisted') then 'interviewing' else status end
   where id = p_application_id;

  return jsonb_build_object('ok', true, 'warning', v_exam);
end;
$$;
revoke all on function public.careers_start_round(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.careers_start_round(uuid, uuid, timestamptz) to authenticated;

-- Pull the online test results for a job's test rounds from the exam engine (best attempt, as a percentage)
-- and mark each candidate passed or failed against the round's pass score.
create or replace function public.careers_sync_test_scores(p_job_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_n integer := 0;
  r record;
  v_best numeric;
begin
  if not public.has_module_access('careers', 'write') then
    raise exception 'You need Write access to Careers.' using errcode = '42501';
  end if;
  for r in
    select ar.id, a.student_id, cr.exam_course_id, cr.pass_score
      from public.careers_application_rounds ar
      join public.careers_applications a on a.id = ar.application_id
      join public.careers_rounds cr on cr.id = ar.round_id
     where a.job_id = p_job_id and cr.exam_course_id is not null and ar.status in ('pending', 'scheduled', 'completed')
  loop
    select max(score_pct) into v_best from public.exam_attempts
     where student_id = r.student_id and course_id = r.exam_course_id and status <> 'in_progress';
    if v_best is not null then
      update public.careers_application_rounds
         set score = v_best,
             status = case when r.pass_score is null then 'completed' when v_best >= r.pass_score then 'passed' else 'failed' end
       where id = r.id;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.careers_sync_test_scores(uuid) from public, anon;
grant execute on function public.careers_sync_test_scores(uuid) to authenticated;

-- ───────── resumes ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('careers', 'careers', false, 5242880, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy "careers resume upload" on storage.objects for insert with check (
  bucket_id = 'careers' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user()
);
create policy "careers resume read" on storage.objects for select using (
  bucket_id = 'careers' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_module_access('careers', 'read'))
);

-- ───────── default permissions: admins manage Careers; instructors and coordinators don't see it ─────────
insert into public.role_module_access (role, module_key, access_level) values
  ('admin', 'careers', 'write'),
  ('instructor', 'careers', 'none'),
  ('coordinator', 'careers', 'none')
on conflict (role, module_key) do nothing;
