-- Admin-controlled exam availability. 'open' keeps today's behavior (always available),
-- 'closed' blocks starting the exam, 'scheduled' only allows it between
-- exam_opens_at and exam_closes_at (either end may be left empty).
alter table public.courses
  add column if not exists exam_access text not null default 'open'
    check (exam_access in ('open', 'closed', 'scheduled')),
  add column if not exists exam_opens_at timestamptz,
  add column if not exists exam_closes_at timestamptz;
