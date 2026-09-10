-- EgireRobotics LMS — form-driven registration intake.
-- Every new student comes through a form (ours or Google) into one queue;
-- an admin accepts, picks courses, and the account + credentials are created.

create type registration_source as enum ('registration_form', 'google_form', 'csv');
create type registration_status as enum ('pending', 'accepted', 'rejected');

create table public.registrations (
  id                 uuid primary key default gen_random_uuid(),
  source             registration_source not null default 'registration_form',
  form_id            uuid references public.enrollment_forms(id) on delete set null,
  full_name          text not null default '',
  email              text not null,
  phone              text,
  answers            jsonb not null default '{}'::jsonb,
  requested_course_id uuid references public.courses(id) on delete set null,
  status             registration_status not null default 'pending',
  reviewed_by        uuid references public.profiles(id) on delete set null,
  reviewed_at        timestamptz,
  review_note        text,
  created_profile_id uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index on public.registrations (status, created_at desc);
-- at most one pending registration per email
create unique index registrations_one_pending_email
  on public.registrations (lower(email)) where status = 'pending';

alter table public.registrations enable row level security;
-- all inserts go through edge functions (service role); staff read + review
create policy registrations_select_staff on public.registrations
  for select using (public.is_staff());
create policy registrations_update_staff on public.registrations
  for update using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Public registration forms (reuse enrollment_forms with a public flag)
-- ---------------------------------------------------------------------------
alter table public.enrollment_forms add column is_public boolean not null default false;

-- anon may read an open public form + its fields to render /register-form/:slug
create policy enrollment_forms_public_read on public.enrollment_forms
  for select using (is_public = true and is_open = true);
create policy enrollment_form_fields_public_read on public.enrollment_form_fields
  for select using (
    exists (
      select 1 from public.enrollment_forms f
      where f.id = enrollment_form_fields.form_id
        and f.is_public = true and f.is_open = true
    )
  );
grant select on public.enrollment_forms, public.enrollment_form_fields to anon;

-- ---------------------------------------------------------------------------
-- Forced password reset on admin-created accounts
-- ---------------------------------------------------------------------------
alter table public.profiles add column must_change_password boolean not null default false;

-- ---------------------------------------------------------------------------
-- Google Form webhook secret
-- ---------------------------------------------------------------------------
alter table public.org_settings
  add column google_form_secret text not null default encode(gen_random_bytes(18), 'hex');
