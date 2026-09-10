-- EgireRobotics LMS — storage buckets, storage RLS, and seed data.

insert into storage.buckets (id, name, public)
values
  ('branding',           'branding',           true),
  ('course-resources',   'course-resources',   false),
  ('enrollment-uploads', 'enrollment-uploads', false),
  ('certificates',       'certificates',       false)
on conflict (id) do nothing;

-- branding: public read, super-admin write --------------------------------------
create policy "branding read"  on storage.objects
  for select using (bucket_id = 'branding');
create policy "branding write" on storage.objects
  for insert with check (bucket_id = 'branding' and public.is_super_admin());
create policy "branding update" on storage.objects
  for update using (bucket_id = 'branding' and public.is_super_admin());
create policy "branding delete" on storage.objects
  for delete using (bucket_id = 'branding' and public.is_super_admin());

-- course-resources: staff write; enrolled active students read by course folder --
-- path convention: course-resources/<course_id>/<lesson_id>/<filename>
create policy "course-resources staff write" on storage.objects
  for all using (bucket_id = 'course-resources' and public.is_staff())
  with check (bucket_id = 'course-resources' and public.is_staff());
create policy "course-resources enrolled read" on storage.objects
  for select using (
    bucket_id = 'course-resources'
    and (
      public.is_staff()
      or exists (
        select 1 from public.enrollments e
        where e.student_id = auth.uid()
          and e.status = 'active'
          and e.course_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- enrollment-uploads: owner read/write; staff read ----------------------------
-- path convention: enrollment-uploads/<user_id>/<form_id>/<filename>
create policy "enrollment-uploads owner write" on storage.objects
  for insert with check (
    bucket_id = 'enrollment-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "enrollment-uploads read" on storage.objects
  for select using (
    bucket_id = 'enrollment-uploads'
    and ( public.is_staff() or (storage.foldername(name))[1] = auth.uid()::text )
  );

-- certificates: owner read; writes are service-role only ---------------------
-- path convention: certificates/<user_id>/<cert_id>.pdf
create policy "certificates read" on storage.objects
  for select using (
    bucket_id = 'certificates'
    and ( public.is_staff() or (storage.foldername(name))[1] = auth.uid()::text )
  );

-- seed singleton org settings ----------------------------------------------------
insert into public.org_settings (id) values (true) on conflict (id) do nothing;
