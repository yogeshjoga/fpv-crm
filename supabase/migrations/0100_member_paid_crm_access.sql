-- CRM access for website members: only when the member is PAID and an admin has accepted them (status = 'active').
-- is_paid is derived (staff ticked paid_member, or a paid registration) and kept fresh by refresh_member_type. A database trigger refuses to
-- activate a website member who is not paid, so the Approvals page, the Members page and any direct update all obey the same rule.

alter table public.profiles add column if not exists is_paid boolean not null default false;

create or replace function public.compute_is_paid(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.paid_member from public.profiles p where p.id = p_uid), false)
      or exists (select 1 from public.registrations r where r.created_profile_id = p_uid and r.payment_status = 'paid');
$$;
revoke all on function public.compute_is_paid(uuid) from public, anon, authenticated;

create or replace function public.refresh_member_type(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v text := public.compute_member_type(p_uid);
        v_paid boolean := public.compute_is_paid(p_uid);
begin
  perform set_config('app.member_write', '1', true);
  update public.profiles set member_type = v, is_paid = v_paid
   where id = p_uid and (member_type is distinct from v or is_paid is distinct from v_paid);
end $$;
revoke all on function public.refresh_member_type(uuid) from public, anon, authenticated;

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
  new.is_paid := old.is_paid;
  return new;
end $$;
revoke all on function public.guard_member_columns() from public, anon, authenticated;

create or replace function public.guard_member_activation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' and new.account_kind = 'member'
     and not (new.paid_member or public.compute_is_paid(new.id)) then
    raise exception 'Only paid members can be given CRM access. Mark this member as paid first.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.guard_member_activation() from public, anon, authenticated;
drop trigger if exists trg_profiles_guard_member_activation on public.profiles;
create trigger trg_profiles_guard_member_activation before update of status on public.profiles
  for each row execute function public.guard_member_activation();

update public.profiles p set is_paid = public.compute_is_paid(p.id) where p.role = 'student';

-- members_directory gains is_paid (see 0095 for the body; the only change is the extra column and its select)
drop function if exists public.members_directory(text, text, text, uuid, date, date, text, integer);
create function public.members_directory(
  p_search text default null, p_college text default null, p_type text default null, p_workshop uuid default null,
  p_from date default null, p_to date default null, p_kind text default null, p_limit integer default 500)
returns table (
  id uuid, full_name text, email text, phone text, college_name text, member_type text, account_kind text, signup_source text,
  status text, created_at timestamptz, last_seen_at timestamptz, workshops text, workshop_dates text, workshop_ids uuid[], is_paid boolean)
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
         coalesce(array_agg(distinct w.gid) filter (where w.gid is not null), '{}'::uuid[]),
         p.is_paid
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
