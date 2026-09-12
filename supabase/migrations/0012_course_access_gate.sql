-- Hard-lock course *content* (modules, lessons, resources) behind an active
-- enrollment. Before this, any active user could read every published course's
-- lessons; enrollment only gated the exam. Now a student sees a course's content
-- only after an admin enrolls them (see admin Users -> Courses).
--
-- `courses` select is deliberately left untouched so the catalog can still list
-- published courses for students to request / be granted enrollment into.

create or replace function public.is_enrolled(course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    where e.course_id = course
      and e.student_id = auth.uid()
      and e.status = 'active'
  );
$$;

-- modules --------------------------------------------------------------------
drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.courses c
      where c.id = modules.course_id
        and c.status = 'published'
        and public.is_active_user()
        and public.is_enrolled(c.id)
    )
  );

-- lessons -------------------------------------------------------------------
drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = lessons.module_id
        and c.status = 'published'
        and public.is_active_user()
        and public.is_enrolled(c.id)
    )
  );

-- lesson_resources -------------------------------------------------------
drop policy if exists lesson_resources_select on public.lesson_resources;
create policy lesson_resources_select on public.lesson_resources
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = lesson_resources.lesson_id
        and c.status = 'published'
        and public.is_active_user()
        and public.is_enrolled(c.id)
    )
  );
