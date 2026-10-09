-- HR after the interview: default interview rounds for every position, then hire -> onboarding -> ID card ->
-- assets -> attendance. All of it is part of the Careers section, so the same permission applies:
-- has_module_access('careers', 'read' | 'write'). Candidates never see any of these tables.

-- ───────── every position starts with three interview rounds ─────────
create or replace function public.careers_default_rounds()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.careers_rounds (job_id, position, name, kind, description) values
    (new.id, 0, 'Technical interview 1', 'interview', 'A first technical conversation about your skills, projects and the role.'),
    (new.id, 1, 'Technical interview 2', 'interview', 'A deeper technical round with the team: problem solving and hands-on questions.'),
    (new.id, 2, 'HR interview', 'hr', 'Your expectations, availability, terms and next steps.');
  return new;
end $$;
revoke all on function public.careers_default_rounds() from public, anon, authenticated;
create trigger careers_jobs_default_rounds after insert on public.careers_jobs
  for each row execute function public.careers_default_rounds();

-- positions that already exist without any round get the same three
insert into public.careers_rounds (job_id, position, name, kind, description)
select j.id, r.position, r.name, r.kind, r.description
  from public.careers_jobs j
  cross join (values
    (0, 'Technical interview 1', 'interview', 'A first technical conversation about your skills, projects and the role.'),
    (1, 'Technical interview 2', 'interview', 'A deeper technical round with the team: problem solving and hands-on questions.'),
    (2, 'HR interview', 'hr', 'Your expectations, availability, terms and next steps.')
  ) as r(position, name, kind, description)
 where not exists (select 1 from public.careers_rounds x where x.job_id = j.id);

-- ───────── employees ─────────
create sequence public.hr_employee_seq;

create table public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique,
  profile_id uuid references public.profiles(id) on delete set null,
  application_id uuid unique references public.careers_applications(id) on delete set null,
  offer_id uuid references public.careers_offers(id) on delete set null,
  full_name text not null check (char_length(full_name) between 2 and 160),
  email text not null default '' check (char_length(email) <= 200),
  phone text not null default '' check (char_length(phone) <= 40),
  designation text not null default '' check (char_length(designation) <= 160),
  department text not null default '' check (char_length(department) <= 120),
  employment_type text not null default 'full_time' check (employment_type in ('internship', 'full_time', 'part_time', 'contract')),
  joined_on date,
  status text not null default 'onboarding' check (status in ('onboarding', 'active', 'exited')),
  exited_on date,
  id_card_issued_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 5000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hr_employees_status on public.hr_employees (status);

create table public.hr_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  position integer not null default 0,
  title text not null check (char_length(title) between 2 and 200),
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references public.profiles(id) on delete set null
);
create index hr_onboarding_tasks_emp on public.hr_onboarding_tasks (employee_id, position);

create table public.hr_assets (
  id uuid primary key default gen_random_uuid(),
  asset_tag text not null unique check (char_length(asset_tag) between 2 and 60),
  name text not null check (char_length(name) between 2 and 160),
  category text not null default '' check (char_length(category) <= 80),
  serial_no text not null default '' check (char_length(serial_no) <= 120),
  status text not null default 'available' check (status in ('available', 'assigned', 'repair', 'retired')),
  purchased_on date,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create table public.hr_asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.hr_assets(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  assigned_on date not null default current_date,
  returned_on date,
  condition_out text not null default '' check (char_length(condition_out) <= 500),
  condition_in text not null default '' check (char_length(condition_in) <= 500),
  assigned_by uuid references public.profiles(id) on delete set null,
  check (returned_on is null or returned_on >= assigned_on)
);
create unique index hr_asset_one_open on public.hr_asset_assignments (asset_id) where returned_on is null;
create index hr_asset_assignments_emp on public.hr_asset_assignments (employee_id);

create table public.hr_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  day date not null,
  status text not null check (status in ('present', 'absent', 'half_day', 'leave', 'wfh')),
  check_in time,
  check_out time,
  note text not null default '' check (char_length(note) <= 300),
  marked_by uuid references public.profiles(id) on delete set null,
  unique (employee_id, day)
);
create index hr_attendance_day on public.hr_attendance (day);

-- ───────── behaviour ─────────
create or replace function public.hr_employee_prepare()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.employee_code is null then
    new.employee_code := 'EGR-EMP-' || lpad(nextval('public.hr_employee_seq')::text, 4, '0');
  end if;
  if tg_op = 'UPDATE' then new.employee_code := old.employee_code; end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.hr_employee_prepare() from public, anon, authenticated;
create trigger hr_employees_prepare before insert or update on public.hr_employees
  for each row execute function public.hr_employee_prepare();

create or replace function public.hr_employee_default_tasks()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.hr_onboarding_tasks (employee_id, position, title)
  select new.id, t.n, t.title from (values
    (0, 'Collect identity and education documents'),
    (1, 'Offer letter signed and returned'),
    (2, 'Confidentiality agreement (NDA) signed'),
    (3, 'Bank and payment details collected'),
    (4, 'Set up work email and system access'),
    (5, 'Issue employee ID card'),
    (6, 'Hand over assets (laptop, kit, tools)'),
    (7, 'Orientation and safety briefing'),
    (8, 'Assign a mentor or reporting manager')
  ) as t(n, title);
  return new;
end $$;
revoke all on function public.hr_employee_default_tasks() from public, anon, authenticated;
create trigger hr_employees_default_tasks after insert on public.hr_employees
  for each row execute function public.hr_employee_default_tasks();

-- an asset is "assigned" while it has an open assignment
create or replace function public.hr_asset_assignment_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.hr_assets set status = 'assigned' where id = new.asset_id and status in ('available', 'assigned');
    if not found then raise exception 'This asset is not available to assign.'; end if;
  elsif new.returned_on is not null and old.returned_on is null then
    update public.hr_assets set status = 'available' where id = new.asset_id and status = 'assigned';
  end if;
  return new;
end $$;
revoke all on function public.hr_asset_assignment_sync() from public, anon, authenticated;
create trigger hr_asset_assignments_sync after insert or update on public.hr_asset_assignments
  for each row execute function public.hr_asset_assignment_sync();

-- hiring someone starts their employee record (once)
create or replace function public.hr_start_onboarding()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job public.careers_jobs;
  v_p public.profiles;
  v_offer public.careers_offers;
begin
  if new.status = 'hired' and old.status is distinct from 'hired' then
    select * into v_job from public.careers_jobs where id = new.job_id;
    select * into v_p from public.profiles where id = new.student_id;
    select * into v_offer from public.careers_offers where application_id = new.id and status in ('issued', 'accepted') order by created_at desc limit 1;
    insert into public.hr_employees (application_id, offer_id, profile_id, full_name, email, phone, designation, department, employment_type, joined_on)
    values (new.id, v_offer.id, new.student_id, coalesce(nullif(v_p.full_name, ''), v_p.email, 'New employee'), coalesce(v_p.email, ''), coalesce(v_p.phone, ''),
            coalesce(v_offer.role_title, v_job.title), coalesce(nullif(v_offer.department, ''), v_job.department, ''),
            coalesce(v_offer.employment_type, case when v_job.kind in ('internship', 'full_time', 'part_time', 'contract') then v_job.kind else 'full_time' end),
            coalesce(v_offer.start_date, current_date))
    on conflict (application_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.hr_start_onboarding() from public, anon, authenticated;
create trigger careers_applications_hr_onboarding after update of status on public.careers_applications
  for each row execute function public.hr_start_onboarding();

-- ───────── access ─────────
alter table public.hr_employees enable row level security;
alter table public.hr_onboarding_tasks enable row level security;
alter table public.hr_assets enable row level security;
alter table public.hr_asset_assignments enable row level security;
alter table public.hr_attendance enable row level security;

do $$
declare t text;
begin
  foreach t in array array['hr_employees', 'hr_onboarding_tasks', 'hr_assets', 'hr_asset_assignments', 'hr_attendance'] loop
    execute format('create policy %I on public.%I for select using (public.has_module_access(''careers'', ''read''))', t || '_read', t);
    execute format('create policy %I on public.%I for all using (public.has_module_access(''careers'', ''write'')) with check (public.has_module_access(''careers'', ''write''))', t || '_write', t);
  end loop;
end $$;

-- people changes are kept in the audit log
create trigger audit_hr_employees after insert or update or delete on public.hr_employees
  for each row execute function public.audit_row();
