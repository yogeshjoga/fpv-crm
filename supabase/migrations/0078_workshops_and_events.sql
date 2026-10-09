-- Workshops, events and ordinary batches.
-- A student belongs to one of three kinds of programme:
--   workshop  (e.g. the Sivani Engineering College workshop),
--   event     (a one-off event),
--   regular   (normal students on ordinary courses).
-- Each workshop or event is its own course group, so its students, results and reports stay inside it. A new workshop never
-- touches the old ones. This adds the identity of a workshop (a code such as WS-0001, who organised it, where and when),
-- and two reporting functions so one workshop's roster and one student's report are read in a single scoped request.
-- A student's type is derived from the groups they are in: workshop first, then event, otherwise normal.

alter table public.course_groups
  add column if not exists kind text not null default 'regular' check (kind in ('regular', 'workshop', 'event')),
  add column if not exists code text,
  add column if not exists organizer text not null default '' check (char_length(organizer) <= 160),
  add column if not exists venue text not null default '' check (char_length(venue) <= 160),
  add column if not exists starts_on date,
  add column if not exists ends_on date;
alter table public.course_groups add constraint course_groups_dates_check check (ends_on is null or starts_on is null or ends_on >= starts_on);
create unique index if not exists course_groups_code_uidx on public.course_groups (code) where code is not null;

create sequence if not exists public.workshop_code_seq;
create sequence if not exists public.event_code_seq;
create sequence if not exists public.batch_code_seq;

create or replace function public.course_group_prepare()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- a new group gets its code; changing a group's kind gives it a code of the new kind
  if new.code is null or (tg_op = 'UPDATE' and new.kind is distinct from old.kind) then
    new.code := (case new.kind when 'workshop' then 'WS' when 'event' then 'EV' else 'BT' end) || '-' ||
      lpad((case new.kind
        when 'workshop' then nextval('public.workshop_code_seq')
        when 'event' then nextval('public.event_code_seq')
        else nextval('public.batch_code_seq') end)::text, 4, '0');
  end if;
  return new;
end $$;
revoke all on function public.course_group_prepare() from public, anon, authenticated;
create trigger course_groups_prepare before insert or update on public.course_groups
  for each row execute function public.course_group_prepare();

-- the existing Sivani group is the first workshop; every other existing group is a regular batch
update public.course_groups set kind = 'workshop', organizer = 'Sivani Engineering College' where slug like 'sivani-fpv-course%' and kind = 'regular';
update public.course_groups set code = code where code is null; -- fires the trigger, which assigns the code

-- people with the Workshops section see it (default: admins write, everyone else on staff reads)
insert into public.role_module_access (role, module_key, access_level) values
  ('admin', 'workshops', 'write'),
  ('coordinator', 'workshops', 'read'),
  ('instructor', 'workshops', 'read')
on conflict (role, module_key) do nothing;

-- ───────── one workshop: every student with their numbers, scoped to that workshop's courses ─────────
create or replace function public.workshop_roster(p_group uuid)
returns table (
  student_id uuid, full_name text, email text, phone text, status text, joined_at timestamptz,
  courses_enrolled integer, attempts integer, best_score numeric, courses_passed integer,
  certificates integer, marks_total numeric, study_seconds bigint, review_rating integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_module_access('workshops', 'read') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, p.email, coalesce(p.phone, ''), p.status::text, m.added_at,
    (select count(*)::int from public.enrollments e where e.student_id = p.id and e.status in ('active', 'completed')
        and e.course_id in (select gc.course_id from public.course_group_courses gc where gc.group_id = p_group)),
    (select count(*)::int from public.exam_attempts a where a.student_id = p.id and a.status <> 'in_progress'
        and a.course_id in (select gc.course_id from public.course_group_courses gc where gc.group_id = p_group)),
    (select max(a.score_pct) from public.exam_attempts a where a.student_id = p.id and a.status = 'submitted'
        and a.course_id in (select gc.course_id from public.course_group_courses gc where gc.group_id = p_group)),
    (select count(distinct a.course_id)::int from public.exam_attempts a where a.student_id = p.id and a.passed is true
        and a.course_id in (select gc.course_id from public.course_group_courses gc where gc.group_id = p_group)),
    (select count(*)::int from public.certificates c where c.student_id = p.id and not c.revoked
        and c.course_id in (select gc.course_id from public.course_group_courses gc where gc.group_id = p_group)),
    (select sum(am.marks) from public.assessment_marks am where am.student_id = p.id
        and am.course_id in (select gc.course_id from public.course_group_courses gc where gc.group_id = p_group)),
    (select coalesce(sum(st.seconds), 0)::bigint from public.study_time st where st.student_id = p.id
        and st.course_id in (select gc.course_id from public.course_group_courses gc where gc.group_id = p_group)),
    (select r.rating::int from public.reviews r where r.student_id = p.id and r.group_id = p_group limit 1)
  from public.course_group_members m
  join public.profiles p on p.id = m.student_id
  where m.group_id = p_group
  order by p.full_name;
end $$;
revoke all on function public.workshop_roster(uuid) from public, anon;
grant execute on function public.workshop_roster(uuid) to authenticated;

-- ───────── the list of workshops and events, with headline numbers ─────────
create or replace function public.workshop_overview()
returns table (group_id uuid, students integer, exam_takers integer, avg_best_score numeric, passed_students integer, certificates integer, reviews integer, avg_rating numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_module_access('workshops', 'read') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select g.id,
    (select count(*)::int from public.course_group_members m where m.group_id = g.id),
    (select count(distinct a.student_id)::int from public.exam_attempts a
       where a.status = 'submitted' and a.student_id in (select m.student_id from public.course_group_members m where m.group_id = g.id)
         and a.course_id in (select gc.course_id from public.course_group_courses gc where gc.group_id = g.id)),
    (select round(avg(best), 1) from (
       select max(a.score_pct) as best from public.exam_attempts a
        where a.status = 'submitted' and a.student_id in (select m.student_id from public.course_group_members m where m.group_id = g.id)
          and a.course_id in (select gc.course_id from public.course_group_courses gc where gc.group_id = g.id)
        group by a.student_id) b),
    (select count(distinct a.student_id)::int from public.exam_attempts a
       where a.passed is true and a.student_id in (select m.student_id from public.course_group_members m where m.group_id = g.id)
         and a.course_id in (select gc.course_id from public.course_group_courses gc where gc.group_id = g.id)),
    (select count(*)::int from public.certificates c
       where not c.revoked and c.student_id in (select m.student_id from public.course_group_members m where m.group_id = g.id)
         and c.course_id in (select gc.course_id from public.course_group_courses gc where gc.group_id = g.id)),
    (select count(*)::int from public.reviews r where r.group_id = g.id),
    (select round(avg(r.rating), 1) from public.reviews r where r.group_id = g.id)
  from public.course_groups g;
end $$;
revoke all on function public.workshop_overview() from public, anon;
grant execute on function public.workshop_overview() to authenticated;

-- ───────── one student's report inside one workshop ─────────
create or replace function public.workshop_student_report(p_group uuid, p_student uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not public.has_module_access('workshops', 'read') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.course_group_members m where m.group_id = p_group and m.student_id = p_student) then
    raise exception 'That student is not in this workshop' using errcode = 'P0002';
  end if;
  select jsonb_build_object(
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'course_id', c.id, 'title', c.title,
        'enrollment', (select e.status::text from public.enrollments e where e.student_id = p_student and e.course_id = c.id),
        'attempts', coalesce((select jsonb_agg(jsonb_build_object('no', a.attempt_no, 'status', a.status::text, 'score', a.score_pct, 'passed', a.passed, 'at', coalesce(a.submitted_at, a.started_at)) order by a.attempt_no)
                               from public.exam_attempts a where a.student_id = p_student and a.course_id = c.id), '[]'::jsonb),
        'certificate', (select jsonb_build_object('id', ce.cert_id_string, 'issued_at', ce.issued_at, 'revoked', ce.revoked)
                          from public.certificates ce where ce.student_id = p_student and ce.course_id = c.id order by ce.issued_at desc limit 1),
        'marks', coalesce((select jsonb_agg(jsonb_build_object('component', am.component::text, 'marks', am.marks) order by am.component::text)
                             from public.assessment_marks am where am.student_id = p_student and am.course_id = c.id), '[]'::jsonb),
        'study_seconds', coalesce((select sum(st.seconds) from public.study_time st where st.student_id = p_student and st.course_id = c.id), 0)
      ) order by c.title)
      from public.course_group_courses gc join public.courses c on c.id = gc.course_id where gc.group_id = p_group
    ), '[]'::jsonb),
    'review', (select jsonb_build_object('rating', r.rating, 'comment', r.comment, 'at', r.created_at) from public.reviews r where r.student_id = p_student and r.group_id = p_group limit 1)
  ) into v;
  return v;
end $$;
revoke all on function public.workshop_student_report(uuid, uuid) from public, anon;
grant execute on function public.workshop_student_report(uuid, uuid) to authenticated;

-- a student's type, for the Users list
create or replace function public.student_kinds()
returns table (student_id uuid, kind text, workshops text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select m.student_id,
    case when bool_or(g.kind = 'workshop') then 'workshop' when bool_or(g.kind = 'event') then 'event' else 'normal' end,
    coalesce(string_agg(g.name, ', ' order by g.name) filter (where g.kind in ('workshop', 'event')), '')
  from public.course_group_members m join public.course_groups g on g.id = m.group_id
  group by m.student_id;
end $$;
revoke all on function public.student_kinds() from public, anon;
grant execute on function public.student_kinds() to authenticated;
