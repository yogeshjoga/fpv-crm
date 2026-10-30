-- Website members: a few onboarding questions, and workshop membership set by staff from a list of emails.
--
-- Everyone who registers on the website is an individual. They no longer pick a workshop themselves. Instead an admin pastes the emails of a
-- workshop's attendees into the CRM (Members page); anyone on that list is put into the workshop's group, now or when they register.
-- The questions are: how they found us, who they are, what they are looking for, their drone experience, and an optional phone number.

alter table public.profiles
  add column if not exists heard_from text not null default '' check (heard_from in ('', 'google', 'chatgpt', 'other_ai', 'youtube', 'instagram', 'facebook', 'linkedin', 'whatsapp', 'friend', 'college', 'event', 'other')),
  add column if not exists heard_from_other text not null default '' check (char_length(heard_from_other) <= 80),
  add column if not exists member_role text not null default '' check (member_role in ('', 'student', 'professional', 'business', 'institution', 'hobbyist')),
  add column if not exists looking_for text[] not null default '{}' check (cardinality(looking_for) <= 8),
  add column if not exists drone_experience text not null default '' check (drone_experience in ('', 'none', 'simulator', 'camera_drone', 'fpv_beginner', 'fpv_advanced'));

-- ───────── workshop email lists ─────────
create table if not exists public.workshop_emails (
  group_id uuid not null references public.course_groups(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) <= 254),
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, email)
);
alter table public.workshop_emails enable row level security;
create policy workshop_emails_read on public.workshop_emails for select using (public.has_module_access('members', 'read'));
create policy workshop_emails_write on public.workshop_emails for all
  using (public.has_module_access('members', 'write')) with check (public.has_module_access('members', 'write'));

-- puts one person into every workshop whose email list contains their address
create or replace function public.apply_workshop_emails(p_uid uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; r record;
begin
  for r in
    select we.group_id, g.name, g.starts_on
      from public.workshop_emails we
      join public.course_groups g on g.id = we.group_id and g.kind = 'workshop'
      join public.profiles p on lower(p.email) = we.email
     where p.id = p_uid
  loop
    insert into public.course_group_members (group_id, student_id) values (r.group_id, p_uid) on conflict do nothing;
    insert into public.member_workshops (profile_id, group_id, workshop_name, workshop_date, status, decided_at)
      values (p_uid, r.group_id, r.name, r.starts_on, 'confirmed', now())
      on conflict (profile_id, group_id) where group_id is not null do update set status = 'confirmed';
    n := n + 1;
  end loop;
  if n > 0 then perform public.refresh_member_type(p_uid); end if;
  return n;
end $$;
revoke all on function public.apply_workshop_emails(uuid) from public, anon, authenticated;

-- staff paste a list of emails for a workshop
create or replace function public.workshop_emails_add(p_group uuid, p_emails text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clean text[]; v_added integer; v_matched integer := 0; r record;
begin
  if not public.has_module_access('members', 'write') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.course_groups where id = p_group and kind = 'workshop') then
    raise exception 'Choose a workshop.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_emails, 1), 0) > 1000 then raise exception 'Add at most 1000 emails at a time.' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct lower(btrim(e))), '{}') into v_clean
    from unnest(coalesce(p_emails, '{}')) e
   where lower(btrim(e)) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(btrim(e)) <= 254;
  insert into public.workshop_emails (group_id, email, added_by)
    select p_group, e, auth.uid() from unnest(v_clean) e on conflict do nothing;
  get diagnostics v_added = row_count;
  for r in select p.id from public.profiles p where lower(p.email) = any(v_clean) and p.role = 'student' and p.archived_at is null loop
    v_matched := v_matched + public.apply_workshop_emails(r.id);
  end loop;
  return jsonb_build_object('added', v_added, 'valid', coalesce(array_length(v_clean, 1), 0), 'matched_existing', v_matched);
end $$;
revoke all on function public.workshop_emails_add(uuid, text[]) from public, anon;
grant execute on function public.workshop_emails_add(uuid, text[]) to authenticated;

-- ───────── what the website calls ─────────
drop function if exists public.member_complete_profile(text, text, uuid, text, date);
create or replace function public.member_complete_profile(
  p_full_name text, p_college text, p_heard_from text, p_heard_other text default '',
  p_role text default '', p_looking_for text[] default '{}', p_experience text default '', p_phone text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  p public.profiles%rowtype;
  v_college text;
  v_name text;
  v_provider text;
  v_source text;
  v_new boolean;
  v_phone text := null;
  v_digits text;
  v_looking text[] := coalesce(p_looking_for, '{}');
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into p from public.profiles where id = v_uid;
  if not found then raise exception 'Your account is not ready yet. Please try again.' using errcode = 'P0002'; end if;

  v_college := btrim(regexp_replace(coalesce(p_college, ''), '\s+', ' ', 'g'));
  if char_length(v_college) < 2 or char_length(v_college) > 160 then raise exception 'Please enter your college or company name.' using errcode = '22023'; end if;
  v_name := btrim(regexp_replace(coalesce(nullif(btrim(p_full_name), ''), p.full_name), '\s+', ' ', 'g'));
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'Please enter your name.' using errcode = '22023'; end if;
  if coalesce(p_heard_from, '') not in ('google', 'chatgpt', 'other_ai', 'youtube', 'instagram', 'facebook', 'linkedin', 'whatsapp', 'friend', 'college', 'event', 'other') then
    raise exception 'Please tell us how you found us.' using errcode = '22023';
  end if;
  if coalesce(p_role, '') not in ('student', 'professional', 'business', 'institution', 'hobbyist') then
    raise exception 'Please choose what describes you best.' using errcode = '22023';
  end if;
  if coalesce(p_experience, '') not in ('', 'none', 'simulator', 'camera_drone', 'fpv_beginner', 'fpv_advanced') then
    raise exception 'Please choose your drone experience.' using errcode = '22023';
  end if;
  if not (v_looking <@ array['learn_fpv', 'build_drone', 'college_workshop', 'buy_drones', 'drone_services', 'start_business', 'ai_robotics']) or cardinality(v_looking) > 7 then
    raise exception 'Please choose from the list.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_phone, '')) <> '' then
    v_digits := regexp_replace(p_phone, '\D', '', 'g');
    if char_length(v_digits) < 7 or char_length(v_digits) > 15 then raise exception 'Please enter a valid phone number.' using errcode = '22023'; end if;
    v_phone := case when btrim(p_phone) like '+%' then '+' else '' end || v_digits;
  end if;

  select u.raw_app_meta_data ->> 'provider', u.raw_app_meta_data ->> 'source' into v_provider, v_source from auth.users u where u.id = v_uid;
  v_new := p.role = 'student' and p.status = 'pending' and p.account_kind = 'student' and p.signup_source = 'crm'
           and not exists (select 1 from public.enrollments e where e.student_id = v_uid)
           and not exists (select 1 from public.course_group_members m where m.student_id = v_uid);

  perform set_config('app.member_write', '1', true);
  update public.profiles set
    full_name = v_name,
    college_name = v_college,
    heard_from = p_heard_from,
    heard_from_other = case when p_heard_from = 'other' then left(btrim(coalesce(p_heard_other, '')), 80) else '' end,
    member_role = p_role,
    looking_for = v_looking,
    drone_experience = coalesce(p_experience, ''),
    phone = coalesce(v_phone, phone),
    account_kind = case when v_new then 'member' else account_kind end,
    signup_source = case when v_new then (case when v_provider = 'google' then 'google' when v_source = 'email_otp' then 'email_otp' else 'admin' end) else signup_source end,
    last_seen_at = now()
  where id = v_uid;

  perform public.apply_workshop_emails(v_uid);
  perform public.refresh_member_type(v_uid);
  return jsonb_build_object('member_type', (select member_type from public.profiles where id = v_uid), 'college_name', v_college);
end $$;
revoke all on function public.member_complete_profile(text, text, text, text, text, text[], text, text) from public, anon;
grant execute on function public.member_complete_profile(text, text, text, text, text, text[], text, text) to authenticated;

-- ───────── what the CRM calls ─────────
create or replace function public.members_answers()
returns table (id uuid, heard_from text, heard_from_other text, member_role text, looking_for text[], drone_experience text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_module_access('members', 'read') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query select p.id, p.heard_from, p.heard_from_other, p.member_role, p.looking_for, p.drone_experience
    from public.profiles p where p.role = 'student' and p.archived_at is null;
end $$;
revoke all on function public.members_answers() from public, anon;
grant execute on function public.members_answers() to authenticated;
