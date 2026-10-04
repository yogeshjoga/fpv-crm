-- Security hardening from the full audit.

-- 1. Students only see courses they are enrolled in (or hold a certificate for).
--    Previously every active user could read every published course. Staff still see all.
create or replace function public.can_view_course(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from public.enrollments e
            where e.course_id = p_course and e.student_id = auth.uid() and e.status in ('active', 'completed')
         )
      or exists (
           select 1 from public.certificates c
            where c.course_id = p_course and c.student_id = auth.uid() and not c.revoked
         );
$$;

drop policy courses_select_published_or_staff on public.courses;
create policy courses_select_enrolled_or_staff on public.courses for select using (
  public.is_staff() or (status = 'published' and public.is_active_user() and public.can_view_course(id))
);

-- The enrolment form page needs just the course title/slug for the form being filled in,
-- without exposing the whole course list.
create or replace function public.enrollment_form_course(p_form_id uuid)
returns table (title text, slug text)
language sql stable security definer set search_path = public as $$
  select c.title, c.slug
    from public.enrollment_forms f
    join public.courses c on c.id = f.course_id
   where f.id = p_form_id and public.is_active_user();
$$;
revoke execute on function public.enrollment_form_course(uuid) from public, anon;
grant execute on function public.enrollment_form_course(uuid) to authenticated;

-- 2. The Google Forms webhook secret lived in org_settings, which every signed-in user can
--    read. Move it to a table only super admins (and the service role) can reach.
create table public.org_secrets (
  id boolean primary key default true check (id),
  google_form_secret text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.org_secrets (id, google_form_secret)
  select true, coalesce(google_form_secret, '') from public.org_settings limit 1
  on conflict (id) do nothing;
alter table public.org_secrets enable row level security;
create policy org_secrets_super_admin on public.org_secrets for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- 3. Library resources can be limited to a course group (e.g. a college batch's study guide).
alter table public.resources add column group_id uuid references public.course_groups(id) on delete cascade;
drop policy resources_read on public.resources;
create policy resources_read on public.resources for select using (
  public.is_active_user() and (
    group_id is null
    or exists (select 1 from public.course_group_members m where m.group_id = resources.group_id and m.student_id = auth.uid())
  )
);
update public.resources set group_id = 'c42608e8-e821-44dd-b5bd-afc993e3e145'
 where external_url like '/study-guides/%';

-- 4. Public buckets keep working through their public URLs, but anonymous visitors must not be
--    able to list their contents (the avatars bucket is named by user id).
drop policy "avatars read" on storage.objects;
create policy "avatars read" on storage.objects for select to authenticated using (bucket_id = 'avatars');
drop policy "branding read" on storage.objects;
create policy "branding read" on storage.objects for select to authenticated using (bucket_id = 'branding');
drop policy "course-covers read" on storage.objects;
create policy "course-covers read" on storage.objects for select to authenticated using (bucket_id = 'course-covers');

-- 5. Functions: signed-out callers have no business running these; pin search_path on the rest.
revoke execute on function public.increment_study_time(uuid, integer) from public, anon;
revoke execute on function public.increment_staff_activity(integer) from public, anon;
grant execute on function public.increment_study_time(uuid, integer) to authenticated;
grant execute on function public.increment_staff_activity(integer) to authenticated;
revoke execute on function public.touch_support_thread() from public, anon, authenticated;
alter function public.touch_review_updated_at() set search_path = public;
alter function public.check_assessment_mark() set search_path = public;
