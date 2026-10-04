-- While a student has a scheduled exam window open (or an exam attempt still running), they cannot
-- open course lessons or study material: only the exam itself. Enforced in the database so it can't
-- be bypassed from the browser. Staff are never locked. Returns when the lock ends, or null when
-- there is no lock.
create or replace function public.exam_lock_until()
returns timestamptz
language sql stable security definer set search_path = public as $$
  select max(t) from (
    select c.exam_closes_at as t
      from public.enrollments e
      join public.courses c on c.id = e.course_id
     where e.student_id = auth.uid()
       and e.status = 'active'
       and c.exam_access = 'scheduled'
       and c.exam_opens_at <= now()
       and c.exam_closes_at > now()
    union all
    select a.expires_at
      from public.exam_attempts a
     where a.student_id = auth.uid()
       and a.status = 'in_progress'
       and a.expires_at > now()
  ) x
  where auth.uid() is not null and not public.is_staff();
$$;

revoke all on function public.exam_lock_until() from public, anon;
grant execute on function public.exam_lock_until() to authenticated;

alter policy modules_select on public.modules using (
  is_staff() or (
    public.exam_lock_until() is null
    and exists (select 1 from courses c
                 where c.id = modules.course_id and c.status = 'published' and is_active_user() and is_enrolled(c.id))
  )
);

alter policy lessons_select on public.lessons using (
  is_staff() or (
    public.exam_lock_until() is null
    and exists (select 1 from modules m join courses c on c.id = m.course_id
                 where m.id = lessons.module_id and c.status = 'published' and is_active_user() and is_enrolled(c.id))
  )
);

alter policy lesson_resources_select on public.lesson_resources using (
  is_staff() or (
    public.exam_lock_until() is null
    and exists (select 1 from lessons l join modules m on m.id = l.module_id join courses c on c.id = m.course_id
                 where l.id = lesson_resources.lesson_id and c.status = 'published' and is_active_user() and is_enrolled(c.id))
  )
);

alter policy resources_read on public.resources using (
  is_active_user() and public.exam_lock_until() is null and (
    group_id is null
    or exists (select 1 from course_group_members m where m.group_id = resources.group_id and m.student_id = auth.uid())
  )
);

alter policy "course-resources enrolled read" on storage.objects using (
  bucket_id = 'course-resources' and (
    is_staff() or (
      public.exam_lock_until() is null
      and exists (select 1 from enrollments e
                   where e.student_id = auth.uid() and e.status = 'active'
                     and e.course_id::text = (storage.foldername(objects.name))[1])
    )
  )
);

alter policy "library active read" on storage.objects using (
  bucket_id = 'library' and is_active_user() and (is_staff() or public.exam_lock_until() is null)
);
