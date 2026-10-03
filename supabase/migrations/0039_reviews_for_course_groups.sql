-- Reviews can now target a course group (e.g. a college batch) as well as a single course
-- or the program overall. A review targets at most one of group / course.
alter table public.reviews
  add column group_id uuid references public.course_groups(id) on delete cascade,
  add constraint reviews_one_target check (group_id is null or course_id is null);

drop index public.reviews_one_per_student_course;
create unique index reviews_one_per_student_target on public.reviews (
  student_id,
  coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
create index reviews_group_idx on public.reviews (group_id);

-- Students can see the groups they belong to (name only matters; membership rows were already readable).
create policy course_groups_member_select on public.course_groups for select using (
  exists (select 1 from public.course_group_members m where m.group_id = course_groups.id and m.student_id = auth.uid())
);

drop policy reviews_student_insert on public.reviews;
drop policy reviews_student_update on public.reviews;

create policy reviews_student_insert on public.reviews for insert with check (
  student_id = auth.uid()
  and public.is_active_user()
  and not public.is_staff()
  and (course_id is null or public.is_enrolled(course_id))
  and (group_id is null or exists (select 1 from public.course_group_members m where m.group_id = reviews.group_id and m.student_id = auth.uid()))
);
create policy reviews_student_update on public.reviews for update
  using (student_id = auth.uid() and not public.is_staff())
  with check (
    student_id = auth.uid()
    and public.is_active_user()
    and not public.is_staff()
    and (course_id is null or public.is_enrolled(course_id))
    and (group_id is null or exists (select 1 from public.course_group_members m where m.group_id = reviews.group_id and m.student_id = auth.uid()))
  );
