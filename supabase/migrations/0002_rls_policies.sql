-- EgireRobotics LMS — Row Level Security
-- Students read only what they own or what is published; all content authoring
-- and all exam/certificate writes are staff- or service-role-only.

-- Prevent a non-super-admin from escalating their own role/status.
create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_super_admin() then
    return new;
  end if;
  new.role   := old.role;
  new.status := old.status;
  return new;
end;
$$;
create trigger trg_profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

alter table public.profiles                  enable row level security;
alter table public.org_settings              enable row level security;
alter table public.courses                   enable row level security;
alter table public.modules                   enable row level security;
alter table public.lessons                   enable row level security;
alter table public.lesson_resources          enable row level security;
alter table public.questions                 enable row level security;
alter table public.question_options          enable row level security;
alter table public.enrollment_forms          enable row level security;
alter table public.enrollment_form_fields    enable row level security;
alter table public.enrollment_requests       enable row level security;
alter table public.enrollment_request_answers enable row level security;
alter table public.enrollments               enable row level security;
alter table public.exam_attempts             enable row level security;
alter table public.exam_attempt_answers      enable row level security;
alter table public.certificates              enable row level security;
alter table public.cert_counters             enable row level security;

-- profiles ------------------------------------------------------------------
create policy profiles_select_self_or_staff on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_super on public.profiles
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- org_settings ------------------------------------------------------------------
create policy org_settings_select_authed on public.org_settings
  for select using (auth.uid() is not null);
create policy org_settings_write_super on public.org_settings
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- courses ------------------------------------------------------------------
create policy courses_select_published_or_staff on public.courses
  for select using (
    public.is_staff()
    or (status = 'published' and public.is_active_user())
  );
create policy courses_write_staff on public.courses
  for all using (public.is_staff()) with check (public.is_staff());

-- modules / lessons / lesson_resources -----------------------------------------
create policy modules_select on public.modules
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.courses c
      where c.id = modules.course_id and c.status = 'published' and public.is_active_user()
    )
  );
create policy modules_write_staff on public.modules
  for all using (public.is_staff()) with check (public.is_staff());

create policy lessons_select on public.lessons
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = lessons.module_id and c.status = 'published' and public.is_active_user()
    )
  );
create policy lessons_write_staff on public.lessons
  for all using (public.is_staff()) with check (public.is_staff());

create policy lesson_resources_select on public.lesson_resources
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = lesson_resources.lesson_id and c.status = 'published' and public.is_active_user()
    )
  );
create policy lesson_resources_write_staff on public.lesson_resources
  for all using (public.is_staff()) with check (public.is_staff());

-- question bank (staff only; students receive sanitized questions from the edge fn)
create policy questions_staff_only on public.questions
  for all using (public.is_staff()) with check (public.is_staff());
create policy question_options_staff_only on public.question_options
  for all using (public.is_staff()) with check (public.is_staff());

-- enrollment forms -----------------------------------------------------------
create policy enrollment_forms_select on public.enrollment_forms
  for select using (public.is_staff() or public.is_active_user());
create policy enrollment_forms_write_staff on public.enrollment_forms
  for all using (public.is_staff()) with check (public.is_staff());

create policy enrollment_form_fields_select on public.enrollment_form_fields
  for select using (public.is_staff() or public.is_active_user());
create policy enrollment_form_fields_write_staff on public.enrollment_form_fields
  for all using (public.is_staff()) with check (public.is_staff());

-- enrollment requests ------------------------------------------------------------
create policy enrollment_requests_select on public.enrollment_requests
  for select using (student_id = auth.uid() or public.is_staff());
create policy enrollment_requests_insert_self on public.enrollment_requests
  for insert with check (student_id = auth.uid() and public.is_active_user());
create policy enrollment_requests_update_staff on public.enrollment_requests
  for update using (public.is_staff()) with check (public.is_staff());

create policy enrollment_request_answers_select on public.enrollment_request_answers
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.enrollment_requests r
      where r.id = enrollment_request_answers.request_id and r.student_id = auth.uid()
    )
  );
create policy enrollment_request_answers_insert_self on public.enrollment_request_answers
  for insert with check (
    exists (
      select 1 from public.enrollment_requests r
      where r.id = enrollment_request_answers.request_id
        and r.student_id = auth.uid()
        and r.status = 'pending'
    )
  );

-- enrollments ------------------------------------------------------------------
create policy enrollments_select on public.enrollments
  for select using (student_id = auth.uid() or public.is_staff());
create policy enrollments_write_staff on public.enrollments
  for all using (public.is_staff()) with check (public.is_staff());

-- exam attempts (writes are service-role only) --------------------------------
create policy exam_attempts_select on public.exam_attempts
  for select using (student_id = auth.uid() or public.is_staff());
create policy exam_attempts_update_staff on public.exam_attempts
  for update using (public.is_staff()) with check (public.is_staff());

create policy exam_attempt_answers_select on public.exam_attempt_answers
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.exam_attempts a
      where a.id = exam_attempt_answers.attempt_id and a.student_id = auth.uid()
    )
  );

-- certificates (issued by service role; revoked by staff) --------------------
create policy certificates_select on public.certificates
  for select using (student_id = auth.uid() or public.is_staff());
create policy certificates_update_staff on public.certificates
  for update using (public.is_staff()) with check (public.is_staff());

-- cert_counters: no policies -> service role only
