-- Per-course toggle: after submitting, show the student every question they got
-- wrong with the correct answer and its explanation. Defaults to false so
-- existing courses keep today's score-only result screen.
alter table public.courses add column if not exists show_review boolean not null default false;
