-- Per-course toggle for whether a student can revisit/jump back to an earlier
-- exam question. Defaults to true so every existing course's exam behavior is
-- unchanged; set to false only on exams that need a forward-only lockdown.
alter table public.courses add column if not exists allow_backtrack boolean not null default true;
