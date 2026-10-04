-- Every module of a composite assessment must be cleared on its own: scoring well in one cannot
-- make up for failing another. Pass marks are in marks (not %) so there is no rounding argument:
--   online exam 75% of 15 = 11.25, viva 8 of 15, simulation 80% of 30 = 24, free flight 80% of 40 = 32.
alter table public.courses
  add column pass_marks_online numeric(6,2) not null default 11.25 check (pass_marks_online >= 0),
  add column pass_marks_viva numeric(6,2) not null default 8 check (pass_marks_viva >= 0),
  add column pass_marks_simulation numeric(6,2) not null default 24 check (pass_marks_simulation >= 0),
  add column pass_marks_piloting numeric(6,2) not null default 32 check (pass_marks_piloting >= 0),
  add constraint courses_pass_marks_within_max check (
    pass_marks_online <= marks_online
    and pass_marks_viva <= marks_viva
    and pass_marks_simulation <= marks_simulation
    and pass_marks_piloting <= marks_piloting
  );

-- The report card a student sees is a snapshot taken when the certificate is issued (marks, pass
-- marks and which modules were cleared at that moment), so later setting changes cannot rewrite it.
alter table public.certificates add column report jsonb;
