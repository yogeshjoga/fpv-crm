-- Public bucket for course cover images (shown in the student course catalog).

insert into storage.buckets (id, name, public)
values ('course-covers', 'course-covers', true)
on conflict (id) do nothing;

create policy "course-covers read" on storage.objects
  for select using (bucket_id = 'course-covers');
create policy "course-covers write" on storage.objects
  for insert with check (bucket_id = 'course-covers' and public.is_staff());
create policy "course-covers update" on storage.objects
  for update using (bucket_id = 'course-covers' and public.is_staff());
create policy "course-covers delete" on storage.objects
  for delete using (bucket_id = 'course-covers' and public.is_staff());
