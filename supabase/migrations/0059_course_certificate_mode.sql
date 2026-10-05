-- When is a certificate sent? 'manual' (the default): never automatically after the online exam; an admin
-- issues it from Exams -> Attempts when they decide the student has earned it. 'auto': sent the moment a
-- student passes the online exam (the old behaviour). 100-mark assessments are always manual.
alter table public.courses
  add column if not exists certificate_mode text not null default 'manual'
  check (certificate_mode in ('manual', 'auto'));
