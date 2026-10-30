-- Website members: sign-in for the public website, a member type, a college and (for workshop people) a workshop and its date.
--
-- A person who registers on the website is a "member" (account_kind = 'member'). They stay `pending` in the CRM, so they do not
-- show up as students waiting for approval and they get no course access. Course access is still only the enrollments row.
-- member_type is one of individual / paid / workshop and is derived, never chosen by the member:
--   workshop  a confirmed workshop group membership, or a workshop the member says they attended (claimed, pending staff check)
--   paid      a paid registration, or staff ticked paid_member
--   individual everyone else
-- A member's claim to a workshop is a separate row (member_workshops). It does NOT add them to the course group, because joining a
-- group grants the group's courses. Staff confirm a claim in the CRM, which is what actually adds them.

alter table public.profiles
  add column if not exists account_kind text not null default 'student' check (account_kind in ('student', 'member')),
  add column if not exists member_type text not null default 'individual' check (member_type in ('individual', 'paid', 'workshop')),
  add column if not exists college_name text not null default '' check (char_length(college_name) <= 160),
  add column if not exists signup_source text not null default 'crm' check (signup_source in ('crm', 'google', 'email_otp', 'admin')),
  add column if not exists paid_member boolean not null default false,
  add column if not exists last_seen_at timestamptz;

create index if not exists profiles_college_idx on public.profiles (lower(college_name)) where college_name <> '';
create index if not exists profiles_member_type_idx on public.profiles (member_type);

-- ───────── workshop claims ─────────
create table if not exists public.member_workshops (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.course_groups(id) on delete set null,
  workshop_name text not null check (char_length(workshop_name) between 1 and 160),
  workshop_date date,
  status text not null default 'claimed' check (status in ('claimed', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz
);
create unique index if not exists member_workshops_one_per_group on public.member_workshops (profile_id, group_id) where group_id is not null;
create index if not exists member_workshops_group_idx on public.member_workshops (group_id);
alter table public.member_workshops enable row level security;
create policy member_workshops_select on public.member_workshops for select
  using (profile_id = auth.uid() or public.has_module_access('members', 'read'));
create policy member_workshops_staff_write on public.member_workshops for all
  using (public.has_module_access('members', 'write')) with check (public.has_module_access('members', 'write'));
create trigger audit_member_workshops after insert or update or delete on public.member_workshops
  for each row execute function public.audit_row();

-- ───────── saved member groups (static lists made from a filter) ─────────
create table if not exists public.member_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  filter jsonb not null default '{}'::jsonb check (pg_column_size(filter) < 4000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.member_group_members (
  group_id uuid not null references public.member_groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);
alter table public.member_groups enable row level security;
alter table public.member_group_members enable row level security;
create policy member_groups_read on public.member_groups for select using (public.has_module_access('members', 'read'));
create policy member_groups_write on public.member_groups for all
  using (public.has_module_access('members', 'write')) with check (public.has_module_access('members', 'write'));
create policy member_group_members_read on public.member_group_members for select using (public.has_module_access('members', 'read'));
create policy member_group_members_write on public.member_group_members for all
  using (public.has_module_access('members', 'write')) with check (public.has_module_access('members', 'write'));

-- people with the Members section: admins write, coordinators and instructors read
insert into public.role_module_access (role, module_key, access_level) values
  ('admin', 'members', 'write'),
  ('coordinator', 'members', 'read'),
  ('instructor', 'members', 'read')
on conflict (role, module_key) do nothing;

-- ───────── member type: derived, kept fresh by triggers ─────────
create or replace function public.compute_member_type(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.course_group_members m join public.course_groups g on g.id = m.group_id
                  where m.student_id = p_uid and g.kind = 'workshop')
      or exists (select 1 from public.member_workshops w where w.profile_id = p_uid and w.status in ('claimed', 'confirmed'))
      then 'workshop'
    when coalesce((select p.paid_member from public.profiles p where p.id = p_uid), false)
      or exists (select 1 from public.registrations r where r.created_profile_id = p_uid and r.payment_status = 'paid')
      then 'paid'
    else 'individual'
  end;
$$;
revoke all on function public.compute_member_type(uuid) from public, anon, authenticated;

create or replace function public.refresh_member_type(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v text := public.compute_member_type(p_uid);
begin
  perform set_config('app.member_write', '1', true);
  update public.profiles set member_type = v where id = p_uid and member_type is distinct from v;
end $$;
revoke all on function public.refresh_member_type(uuid) from public, anon, authenticated;

create or replace function public.trg_refresh_member_type()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if tg_table_name = 'course_group_members' then v_uid := coalesce(new.student_id, old.student_id);
  elsif tg_table_name = 'member_workshops' then v_uid := coalesce(new.profile_id, old.profile_id);
  elsif tg_table_name = 'registrations' then v_uid := new.created_profile_id;
  else v_uid := new.id; end if;
  if v_uid is not null then perform public.refresh_member_type(v_uid); end if;
  return coalesce(new, old);
end $$;
revoke all on function public.trg_refresh_member_type() from public, anon, authenticated;

create trigger member_type_from_groups after insert or delete on public.course_group_members
  for each row execute function public.trg_refresh_member_type();
create trigger member_type_from_claims after insert or update or delete on public.member_workshops
  for each row execute function public.trg_refresh_member_type();
create trigger member_type_from_registrations after insert or update of payment_status, created_profile_id on public.registrations
  for each row execute function public.trg_refresh_member_type();
create trigger member_type_from_paid_flag after update of paid_member on public.profiles
  for each row execute function public.trg_refresh_member_type();

-- a member cannot change their own kind, type, source or paid flag; staff with Members write access and the service role can
create or replace function public.guard_member_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.member_write', true) = '1' or auth.uid() is null or public.has_module_access('members', 'write') then
    return new;
  end if;
  new.account_kind := old.account_kind;
  new.member_type := old.member_type;
  new.signup_source := old.signup_source;
  new.paid_member := old.paid_member;
  return new;
end $$;
revoke all on function public.guard_member_columns() from public, anon, authenticated;
drop trigger if exists trg_profiles_guard_member on public.profiles;
create trigger trg_profiles_guard_member before update on public.profiles
  for each row execute function public.guard_member_columns();

-- ───────── what the website calls ─────────
-- the workshops a member can pick from: upcoming and recent ones
create or replace function public.public_workshops()
returns table (id uuid, name text, code text, starts_on date, ends_on date, venue text, organizer text)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.code, g.starts_on, g.ends_on, g.venue, g.organizer
  from public.course_groups g
  where auth.uid() is not null and g.kind = 'workshop' and (g.ends_on is null or g.ends_on >= current_date - 180)
  order by g.starts_on desc nulls last, g.name;
$$;
revoke all on function public.public_workshops() from public, anon;
grant execute on function public.public_workshops() to authenticated;

-- the member fills in (or corrects) their name and college, and may say which workshop they were in
create or replace function public.member_complete_profile(
  p_full_name text, p_college text,
  p_workshop_id uuid default null, p_workshop_name text default null, p_workshop_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  p public.profiles%rowtype;
  v_college text;
  v_name text;
  v_wname text;
  v_g public.course_groups%rowtype;
  v_provider text;
  v_source text;
  v_new boolean;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into p from public.profiles where id = v_uid;
  if not found then raise exception 'Your account is not ready yet. Please try again.' using errcode = 'P0002'; end if;

  v_college := btrim(regexp_replace(coalesce(p_college, ''), '\s+', ' ', 'g'));
  if char_length(v_college) < 2 or char_length(v_college) > 160 then
    raise exception 'Please enter your college name.' using errcode = '22023';
  end if;
  v_name := btrim(regexp_replace(coalesce(nullif(btrim(p_full_name), ''), p.full_name), '\s+', ' ', 'g'));
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Please enter your name.' using errcode = '22023';
  end if;

  select u.raw_app_meta_data ->> 'provider', u.raw_app_meta_data ->> 'source' into v_provider, v_source
    from auth.users u where u.id = v_uid;
  -- a brand new person (not an existing student) becomes a website member
  v_new := p.role = 'student' and p.status = 'pending' and p.account_kind = 'student' and p.signup_source = 'crm'
           and not exists (select 1 from public.enrollments e where e.student_id = v_uid)
           and not exists (select 1 from public.course_group_members m where m.student_id = v_uid);

  perform set_config('app.member_write', '1', true);
  update public.profiles set
    full_name = v_name,
    college_name = v_college,
    account_kind = case when v_new then 'member' else account_kind end,
    signup_source = case when v_new then (case when v_provider = 'google' then 'google' when v_source = 'email_otp' then 'email_otp' else 'admin' end) else signup_source end,
    last_seen_at = now()
  where id = v_uid;

  if p_workshop_id is not null then
    select * into v_g from public.course_groups where id = p_workshop_id and kind = 'workshop';
    if not found then raise exception 'That workshop was not found.' using errcode = '22023'; end if;
    insert into public.member_workshops (profile_id, group_id, workshop_name, workshop_date)
      values (v_uid, v_g.id, v_g.name, v_g.starts_on)
      on conflict (profile_id, group_id) where group_id is not null do nothing;
  else
    v_wname := btrim(regexp_replace(coalesce(p_workshop_name, ''), '\s+', ' ', 'g'));
    if v_wname <> '' then
      if char_length(v_wname) > 160 then raise exception 'That workshop name is too long.' using errcode = '22023'; end if;
      if (select count(*) from public.member_workshops where profile_id = v_uid) >= 5 then
        raise exception 'You have already added the most workshops you can.' using errcode = '22023';
      end if;
      insert into public.member_workshops (profile_id, workshop_name, workshop_date) values (v_uid, v_wname, p_workshop_date);
    end if;
  end if;

  perform public.refresh_member_type(v_uid);
  return jsonb_build_object('member_type', (select member_type from public.profiles where id = v_uid), 'college_name', v_college);
end $$;
revoke all on function public.member_complete_profile(text, text, uuid, text, date) from public, anon;
grant execute on function public.member_complete_profile(text, text, uuid, text, date) to authenticated;

-- ───────── what the CRM calls ─────────
create or replace function public.members_directory(
  p_search text default null, p_college text default null, p_type text default null, p_workshop uuid default null,
  p_from date default null, p_to date default null, p_kind text default null, p_limit integer default 500)
returns table (
  id uuid, full_name text, email text, phone text, college_name text, member_type text, account_kind text, signup_source text,
  status text, created_at timestamptz, last_seen_at timestamptz, workshops text, workshop_dates text, workshop_ids uuid[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_module_access('members', 'read') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  with w as (
    select m.student_id as pid, g.id as gid, g.name as wname, g.starts_on as wdate
      from public.course_group_members m join public.course_groups g on g.id = m.group_id and g.kind = 'workshop'
    union
    select mw.profile_id, mw.group_id, mw.workshop_name, coalesce(mw.workshop_date, g.starts_on)
      from public.member_workshops mw left join public.course_groups g on g.id = mw.group_id
     where mw.status <> 'rejected'
  )
  select p.id, p.full_name, p.email, coalesce(p.phone, ''), p.college_name, p.member_type, p.account_kind, p.signup_source,
         p.status::text, p.created_at, p.last_seen_at,
         coalesce(string_agg(distinct w.wname, ' · '), ''),
         coalesce(string_agg(distinct to_char(w.wdate, 'YYYY-MM-DD'), ', '), ''),
         coalesce(array_agg(distinct w.gid) filter (where w.gid is not null), '{}'::uuid[])
  from public.profiles p
  left join w on w.pid = p.id
  where p.archived_at is null and p.role = 'student'
    and (p_search is null or p_search = '' or p.full_name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
    and (p_college is null or p_college = '' or lower(p.college_name) = lower(p_college))
    and (p_type is null or p_type = '' or p.member_type = p_type)
    and (p_kind is null or p_kind = '' or p.account_kind = p_kind)
  group by p.id
  having (p_workshop is null or p_workshop = any(array_agg(w.gid)))
     and ((p_from is null and p_to is null)
          or coalesce(bool_or((p_from is null or w.wdate >= p_from) and (p_to is null or w.wdate <= p_to)), false))
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 3000);
end $$;
revoke all on function public.members_directory(text, text, text, uuid, date, date, text, integer) from public, anon;
grant execute on function public.members_directory(text, text, text, uuid, date, date, text, integer) to authenticated;

create or replace function public.members_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.has_module_access('members', 'read') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'total', (select count(*) from public.profiles where role = 'student' and archived_at is null),
    'members', (select count(*) from public.profiles where account_kind = 'member' and archived_at is null),
    'by_type', coalesce((select jsonb_object_agg(member_type, n) from (select member_type, count(*) n from public.profiles where role = 'student' and archived_at is null group by 1) t), '{}'::jsonb),
    'colleges', coalesce((select jsonb_agg(jsonb_build_object('college', college_name, 'n', n) order by n desc) from (
        select college_name, count(*) n from public.profiles where role = 'student' and archived_at is null and college_name <> '' group by 1 order by 2 desc limit 30) c), '[]'::jsonb),
    'missing_college', (select count(*) from public.profiles where role = 'student' and archived_at is null and college_name = '')
  ) into r;
  return r;
end $$;
revoke all on function public.members_overview() from public, anon;
grant execute on function public.members_overview() to authenticated;

create or replace function public.member_group_add(p_group uuid, p_ids uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.has_module_access('members', 'write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 3000 then raise exception 'Too many people at once.' using errcode = '22023'; end if;
  insert into public.member_group_members (group_id, profile_id)
    select p_group, p.id from public.profiles p where p.id = any(p_ids) and p.role = 'student'
    on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.member_group_add(uuid, uuid[]) from public, anon;
grant execute on function public.member_group_add(uuid, uuid[]) to authenticated;

-- ───────── backfill ─────────
-- existing workshop students take the workshop organiser as their college (the Sivani course is organised by the college)
update public.profiles p set college_name = g.organizer
  from public.course_group_members m join public.course_groups g on g.id = m.group_id
 where m.student_id = p.id and g.kind = 'workshop' and g.organizer <> '' and p.college_name = '';
update public.profiles p set member_type = public.compute_member_type(p.id) where p.role = 'student';
