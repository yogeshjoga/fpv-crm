-- EgireRobotics LMS — core schema
-- Enums, tables, triggers, helper functions, certificate sequence, verification RPC.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role            as enum ('super_admin', 'instructor', 'student');
create type user_status          as enum ('pending', 'active', 'suspended');
create type course_status        as enum ('draft', 'published', 'archived');
create type question_type        as enum ('single', 'multi');
create type form_field_type      as enum ('text','textarea','select','multiselect','number','email','phone','date','file','checkbox');
create type enroll_request_status as enum ('pending', 'approved', 'rejected');
create type enrollment_status    as enum ('active', 'completed', 'revoked');
create type attempt_status       as enum ('in_progress', 'submitted', 'expired');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null,
  phone       text,
  role        user_role   not null default 'student',
  status      user_status not null default 'pending',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role/status helpers. SECURITY DEFINER so RLS policies can call them without
-- recursing into the profiles policies.
create or replace function public.current_user_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_status()
returns user_status
language sql stable security definer set search_path = public as $$
  select status from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('instructor','super_admin') from public.profiles where id = auth.uid()),
    false);
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false);
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select status = 'active' from public.profiles where id = auth.uid()),
    false);
$$;

-- Provision a profile row whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Org settings (singleton)
-- ---------------------------------------------------------------------------
create table public.org_settings (
  id                     boolean primary key default true,
  org_name               text not null default 'EgireRobotics',
  logo_url               text,
  signatory_name         text not null default 'Authorized Signatory',
  signatory_image_url    text,
  cert_id_prefix         text not null default 'EGR',
  default_pass_pct       int  not null default 70,
  default_time_limit_min int  not null default 30,
  default_question_count int  not null default 25,
  default_max_attempts   int  not null default 3,
  default_cooldown_hours  int  not null default 24,
  support_email          text not null default 'support@egirerobotics.com',
  verify_base_url        text not null default 'http://localhost:3000',
  updated_at             timestamptz not null default now(),
  constraint org_settings_singleton check (id)
);
create trigger trg_org_settings_updated before update on public.org_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Courses / content
-- ---------------------------------------------------------------------------
create table public.courses (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  slug                text not null unique,
  course_code         text not null unique,
  summary             text not null default '',
  description         text not null default '',
  cover_image_url     text,
  status              course_status not null default 'draft',
  pass_pct            int  not null default 70,
  exam_time_limit_min int  not null default 30,
  exam_question_count int  not null default 25,
  max_attempts        int  not null default 3,
  cooldown_hours      int  not null default 24,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_courses_updated before update on public.courses
  for each row execute function public.set_updated_at();

create table public.modules (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses(id) on delete cascade,
  title      text not null,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
create index on public.modules (course_id, position);

create table public.lessons (
  id         uuid primary key default gen_random_uuid(),
  module_id  uuid not null references public.modules(id) on delete cascade,
  title      text not null,
  position   int  not null default 0,
  content    text not null default '',
  video_url  text,
  created_at timestamptz not null default now()
);
create index on public.lessons (module_id, position);

create table public.lesson_resources (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  file_path   text not null,
  file_name   text not null,
  mime        text,
  size_bytes  bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on public.lesson_resources (lesson_id);

-- ---------------------------------------------------------------------------
-- Question bank
-- ---------------------------------------------------------------------------
create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  prompt      text not null,
  type        question_type not null default 'single',
  explanation text not null default '',
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.questions (course_id, is_active);
create trigger trg_questions_updated before update on public.questions
  for each row execute function public.set_updated_at();

create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label       text not null,
  is_correct  boolean not null default false,
  position    int not null default 0
);
create index on public.question_options (question_id, position);

-- ---------------------------------------------------------------------------
-- Enrollment form builder
-- ---------------------------------------------------------------------------
create table public.enrollment_forms (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  slug        text not null unique,
  description text not null default '',
  is_open     boolean not null default false,
  opens_at    timestamptz,
  closes_at   timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_enrollment_forms_updated before update on public.enrollment_forms
  for each row execute function public.set_updated_at();

create table public.enrollment_form_fields (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.enrollment_forms(id) on delete cascade,
  label        text not null,
  field_type   form_field_type not null default 'text',
  options_json jsonb not null default '[]'::jsonb,
  required     boolean not null default false,
  help_text    text not null default '',
  position     int not null default 0
);
create index on public.enrollment_form_fields (form_id, position);

create table public.enrollment_requests (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.enrollment_forms(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  status       enroll_request_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text,
  unique (form_id, student_id)
);
create index on public.enrollment_requests (status);
create index on public.enrollment_requests (course_id);

create table public.enrollment_request_answers (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.enrollment_requests(id) on delete cascade,
  field_id   uuid not null references public.enrollment_form_fields(id) on delete cascade,
  value_text text,
  value_json jsonb,
  file_path  text
);
create index on public.enrollment_request_answers (request_id);

create table public.enrollments (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.profiles(id) on delete cascade,
  course_id         uuid not null references public.courses(id) on delete cascade,
  source_request_id uuid references public.enrollment_requests(id) on delete set null,
  status            enrollment_status not null default 'active',
  enrolled_at       timestamptz not null default now(),
  enrolled_by       uuid references public.profiles(id) on delete set null,
  unique (student_id, course_id)
);
create index on public.enrollments (student_id);
create index on public.enrollments (course_id);

-- ---------------------------------------------------------------------------
-- Exams
-- ---------------------------------------------------------------------------
create table public.exam_attempts (
  id                uuid primary key default gen_random_uuid(),
  enrollment_id     uuid not null references public.enrollments(id) on delete cascade,
  student_id        uuid not null references public.profiles(id) on delete cascade,
  course_id         uuid not null references public.courses(id) on delete cascade,
  attempt_no        int not null,
  status            attempt_status not null default 'in_progress',
  started_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  submitted_at      timestamptz,
  score_pct         numeric(5,2),
  passed            boolean,
  question_ids_json jsonb not null default '[]'::jsonb,
  cooldown_until    timestamptz,
  locked            boolean not null default false,
  created_at        timestamptz not null default now()
);
create index on public.exam_attempts (student_id, course_id, attempt_no);

create table public.exam_attempt_answers (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references public.exam_attempts(id) on delete cascade,
  question_id         uuid not null references public.questions(id) on delete cascade,
  selected_option_ids_json jsonb not null default '[]'::jsonb,
  is_correct          boolean not null default false
);
create index on public.exam_attempt_answers (attempt_id);

-- ---------------------------------------------------------------------------
-- Certificates
-- ---------------------------------------------------------------------------
create table public.cert_counters (
  course_code text primary key,
  last_seq    int not null default 0
);

create or replace function public.next_cert_number(p_course_code text)
returns int language plpgsql security definer set search_path = public as $$
declare next_seq int;
begin
  insert into public.cert_counters (course_code, last_seq)
  values (p_course_code, 1)
  on conflict (course_code)
    do update set last_seq = public.cert_counters.last_seq + 1
  returning last_seq into next_seq;
  return next_seq;
end;
$$;

create table public.certificates (
  id             uuid primary key default gen_random_uuid(),
  cert_id_string text not null unique,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  course_id      uuid not null references public.courses(id) on delete cascade,
  attempt_id     uuid references public.exam_attempts(id) on delete set null,
  score_pct      numeric(5,2) not null,
  issued_at      timestamptz not null default now(),
  pdf_path       text,
  qr_url         text,
  revoked        boolean not null default false,
  revoked_reason text
);
create index on public.certificates (student_id);

-- Public verification: returns only safe fields, no PII beyond name + course.
create or replace function public.verify_certificate(p_cert_id text)
returns table (
  valid        boolean,
  student_name text,
  course_title text,
  issued_at    timestamptz,
  score_pct    numeric,
  revoked      boolean
)
language sql stable security definer set search_path = public as $$
  select
    (c.id is not null and not c.revoked)      as valid,
    p.full_name                               as student_name,
    co.title                                  as course_title,
    c.issued_at,
    c.score_pct,
    coalesce(c.revoked, false)                as revoked
  from public.certificates c
  join public.profiles p on p.id = c.student_id
  join public.courses  co on co.id = c.course_id
  where upper(c.cert_id_string) = upper(p_cert_id);
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;
