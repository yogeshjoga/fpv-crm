-- Student reviews & feedback. Only active students can write them (staff accounts cannot),
-- one review per student per course (course_id null = general feedback about the program),
-- and a student may edit their own. Staff read everything and can remove abusive entries.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index reviews_one_per_student_course
  on public.reviews (student_id, coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index reviews_course_idx on public.reviews (course_id);

alter table public.reviews enable row level security;

create policy reviews_staff_read on public.reviews for select using (public.is_staff());
create policy reviews_staff_delete on public.reviews for delete using (public.is_staff());

create policy reviews_own_read on public.reviews for select using (student_id = auth.uid());
create policy reviews_student_insert on public.reviews for insert with check (
  student_id = auth.uid()
  and public.is_active_user()
  and not public.is_staff()
  and (course_id is null or public.is_enrolled(course_id))
);
create policy reviews_student_update on public.reviews for update
  using (student_id = auth.uid() and not public.is_staff())
  with check (
    student_id = auth.uid()
    and public.is_active_user()
    and not public.is_staff()
    and (course_id is null or public.is_enrolled(course_id))
  );
create policy reviews_student_delete on public.reviews for delete using (student_id = auth.uid() and not public.is_staff());

create or replace function public.touch_review_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_review_updated_at();
