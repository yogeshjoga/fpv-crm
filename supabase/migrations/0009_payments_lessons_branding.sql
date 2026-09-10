-- EgireRobotics LMS — payment gate on registrations, richer lesson content, branding.

-- ---------------------------------------------------------------------------
-- Manual payment gate
-- ---------------------------------------------------------------------------
create type payment_status as enum ('unpaid', 'paid', 'waived');

alter table public.registrations
  add column payment_status payment_status not null default 'unpaid',
  add column payment_amount numeric(12, 2),
  add column payment_ref    text,
  add column payment_method  text,
  add column paid_at         timestamptz,
  add column paid_by         uuid references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Lesson content types
-- ---------------------------------------------------------------------------
create type lesson_kind as enum ('article', 'video', 'embed', 'download');

alter table public.lessons
  add column kind      lesson_kind not null default 'article',
  add column embed_url text;

-- ---------------------------------------------------------------------------
-- Branding
-- ---------------------------------------------------------------------------
alter table public.org_settings
  add column signatory_title text not null default 'Founder, EgireRobotics';

update public.org_settings set
  org_name        = 'EgireRobotics',
  signatory_name  = 'Yogesh Joga',
  signatory_title = 'Founder, EgireRobotics',
  support_email   = 'support@egirerobotics.com'
where id = true;
