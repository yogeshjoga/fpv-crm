-- Reviews are only for course groups (e.g. a college batch). A student can review a group
-- they belong to; reviews of individual courses or "overall" are no longer accepted.
drop policy reviews_student_insert on public.reviews;
drop policy reviews_student_update on public.reviews;

create policy reviews_student_insert on public.reviews for insert with check (
  student_id = auth.uid()
  and public.is_active_user()
  and not public.is_staff()
  and course_id is null
  and exists (select 1 from public.course_group_members m where m.group_id = reviews.group_id and m.student_id = auth.uid())
);
create policy reviews_student_update on public.reviews for update
  using (student_id = auth.uid() and not public.is_staff())
  with check (
    student_id = auth.uid()
    and public.is_active_user()
    and not public.is_staff()
    and course_id is null
    and exists (select 1 from public.course_group_members m where m.group_id = reviews.group_id and m.student_id = auth.uid())
  );
