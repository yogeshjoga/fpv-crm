-- Security hardening, second pass.

-- 1. A student could edit more of their own profile than the app lets them: the guard trigger only
--    pinned role and status. Pin email (certificates and notices are emailed to it, so it must not be
--    redirectable), and archived_at / archived_by (so an archived account cannot un-archive itself).
--    Super admins and the service role are unaffected.
create or replace function public.guard_profile_privileged_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;
  new.role := old.role;
  new.status := old.status;
  new.email := old.email;
  new.archived_at := old.archived_at;
  new.archived_by := old.archived_by;
  return new;
end;
$$;

-- 2. A student could insert an enrolment request already marked approved, or with a fake reviewer
--    and note. New requests must start as plain pending requests.
drop policy enrollment_requests_insert_self on public.enrollment_requests;
create policy enrollment_requests_insert_self on public.enrollment_requests for insert with check (
  student_id = auth.uid()
  and public.is_active_user()
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and review_note is null
);

-- 3. Instructor-entered marks stay private until results are finalised: a student can read their own
--    marks only once a certificate (and with it their report card) exists.
drop policy assessment_marks_own_read on public.assessment_marks;
create policy assessment_marks_own_read_after_results on public.assessment_marks for select using (
  student_id = auth.uid()
  and exists (
    select 1 from public.certificates c
     where c.student_id = assessment_marks.student_id
       and c.course_id = assessment_marks.course_id
       and not c.revoked
  )
);

-- 4. Upload limits. Buckets had no size or type limits, so any signed-in student could store files of
--    any kind and size (including HTML in the public avatars bucket).
update storage.buckets set file_size_limit = 2 * 1024 * 1024, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'] where id = 'avatars';
update storage.buckets set file_size_limit = 5 * 1024 * 1024, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id in ('branding', 'course-covers');
update storage.buckets set file_size_limit = 15 * 1024 * 1024,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heif', 'image/heic'] where id = 'enrollment-uploads';
update storage.buckets set file_size_limit = 50 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'] where id = 'showcase';
update storage.buckets set file_size_limit = 50 * 1024 * 1024 where id in ('library', 'course-resources');
update storage.buckets set file_size_limit = 10 * 1024 * 1024, allowed_mime_types = array['application/pdf'] where id in ('certificates', 'id-cards');

-- 5. Study time could be inflated without limit and logged against courses the student is not in.
--    Now it needs a real enrolment and is capped at 12 hours per course per day.
create or replace function public.increment_study_time(p_course_id uuid, p_seconds integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_seconds is null or p_seconds <= 0 or p_seconds > 3600 or auth.uid() is null then
    return;
  end if;
  if not exists (
    select 1 from public.enrollments e
     where e.student_id = auth.uid() and e.course_id = p_course_id and e.status in ('active', 'completed')
  ) then
    return;
  end if;
  insert into public.study_time (student_id, course_id, day, seconds, updated_at)
  values (auth.uid(), p_course_id, current_date, p_seconds, now())
  on conflict (student_id, course_id, day)
  do update set seconds = least(public.study_time.seconds + excluded.seconds, 43200), updated_at = now();
end;
$$;

-- 6. Helpers nothing calls and that mean nothing to a signed-out visitor.
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.current_user_status() from public, anon;
