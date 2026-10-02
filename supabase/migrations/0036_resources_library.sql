-- Standalone resource library (study guides, PDFs, documents) shown under its own
-- "Resources" nav item for students, independent of any course.
-- A resource is either an uploaded file in the private `library` bucket (file_path)
-- or an already-hosted file (external_url, e.g. a static file shipped with the app).

insert into storage.buckets (id, name, public) values ('library', 'library', false)
on conflict (id) do nothing;

create policy "library staff write" on storage.objects
  for all using (bucket_id = 'library' and public.is_staff())
  with check (bucket_id = 'library' and public.is_staff());
create policy "library active read" on storage.objects
  for select using (bucket_id = 'library' and public.is_active_user());

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  file_path text,
  external_url text,
  file_name text not null,
  mime text not null default '',
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint resources_has_file check (file_path is not null or external_url is not null)
);

alter table public.resources enable row level security;
create policy resources_staff on public.resources for all
  using (public.is_staff()) with check (public.is_staff());
create policy resources_read on public.resources for select
  using (public.is_active_user());

insert into public.resources (title, description, external_url, file_name, mime) values
  ('FPV Final Exam Study Guide (PDF)',
   'All 420 final exam questions with the correct answers and a short explanation and example for each. Read it online or download it, then attempt the exam.',
   '/study-guides/FPV-Final-Exam-Study-Guide.pdf', 'FPV-Final-Exam-Study-Guide.pdf', 'application/pdf'),
  ('FPV Final Exam Study Guide (Word)',
   'The same study guide as an editable Word document you can download and annotate.',
   '/study-guides/FPV-Final-Exam-Study-Guide.docx', 'FPV-Final-Exam-Study-Guide.docx',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
