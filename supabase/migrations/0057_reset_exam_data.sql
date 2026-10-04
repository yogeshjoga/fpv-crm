-- Start a course's exam fresh. An admin picks which parts to wipe (online exam attempts, viva, simulation,
-- free flight) and whether it is everyone or one student. A dry run reports exactly what would go, so the
-- screen can show real numbers before anything is deleted. Every real reset is logged.
create table if not exists public.exam_resets (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete set null,
  done_by uuid references public.profiles(id) on delete set null,
  parts text[] not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.exam_resets enable row level security;
create policy exam_resets_admin_read on public.exam_resets for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin')));

create or replace function public.reset_exam_data(
  p_course_id uuid,
  p_student_id uuid default null,
  p_online boolean default false,
  p_viva boolean default false,
  p_simulation boolean default false,
  p_piloting boolean default false,
  p_revoke_certs boolean default false,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_parts text[] := array[]::text[];
  v_marks_parts text[] := array[]::text[];
  v_targets uuid[];
  v_certified uuid[];
  v_reset uuid[];
  v_attempts integer := 0;
  v_marks integer := 0;
  v_revoked integer := 0;
  v_notified integer := 0;
  v_result jsonb;
begin
  if auth.uid() is null
     or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin')) then
    raise exception 'Only an admin can reset an exam.' using errcode = '42501';
  end if;

  if p_online then v_parts := array_append(v_parts, 'online'); end if;
  if p_viva then v_parts := array_append(v_parts, 'viva'); v_marks_parts := array_append(v_marks_parts, 'viva'); end if;
  if p_simulation then v_parts := array_append(v_parts, 'simulation'); v_marks_parts := array_append(v_marks_parts, 'simulation'); end if;
  if p_piloting then v_parts := array_append(v_parts, 'piloting'); v_marks_parts := array_append(v_marks_parts, 'piloting'); end if;
  if cardinality(v_parts) = 0 then
    raise exception 'Pick at least one part to reset.' using errcode = '22023';
  end if;

  -- everyone this applies to: enrolled students, plus anyone with attempts or marks left over
  select coalesce(array_agg(distinct s), array[]::uuid[]) into v_targets
    from (
      select e.student_id s from public.enrollments e where e.course_id = p_course_id and e.status <> 'revoked'
      union select a.student_id from public.exam_attempts a where a.course_id = p_course_id
      union select m.student_id from public.assessment_marks m where m.course_id = p_course_id
    ) t
   where p_student_id is null or s = p_student_id;

  select coalesce(array_agg(distinct c.student_id), array[]::uuid[]) into v_certified
    from public.certificates c
   where c.course_id = p_course_id and not c.revoked and c.student_id = any (v_targets);

  -- a student holding a certificate is left alone unless the admin chose to revoke it
  if p_revoke_certs then
    v_reset := v_targets;
  else
    select coalesce(array_agg(s), array[]::uuid[]) into v_reset from unnest(v_targets) s where not (s = any (v_certified));
  end if;

  if p_online then
    select count(*) into v_attempts from public.exam_attempts a where a.course_id = p_course_id and a.student_id = any (v_reset);
  end if;
  if cardinality(v_marks_parts) > 0 then
    select count(*) into v_marks from public.assessment_marks m
     where m.course_id = p_course_id and m.student_id = any (v_reset) and m.component = any (v_marks_parts);
  end if;

  if not p_dry_run then
    if p_revoke_certs and cardinality(v_certified) > 0 then
      update public.certificates
         set revoked = true, revoked_reason = 'Exam reset by admin'
       where course_id = p_course_id and not revoked and student_id = any (v_certified);
      get diagnostics v_revoked = row_count;
    end if;

    if p_online then
      -- notify the students who actually lose attempts, before the rows disappear
      insert into public.notifications (recipient_id, title, body, kind, link)
      select distinct a.student_id,
             'Your exam was reset: ' || c.title,
             'Your earlier attempt' || ' was cleared, so you can start this exam fresh.',
             'exam_schedule',
             '/app/courses/' || c.slug
        from public.exam_attempts a
        join public.courses c on c.id = a.course_id
       where a.course_id = p_course_id and a.student_id = any (v_reset);
      get diagnostics v_notified = row_count;

      delete from public.exam_attempts a where a.course_id = p_course_id and a.student_id = any (v_reset);

      update public.enrollments
         set extra_attempts = 0,
             status = case when status = 'completed' then 'active'::enrollment_status else status end
       where course_id = p_course_id and student_id = any (v_reset);
    end if;

    if cardinality(v_marks_parts) > 0 then
      delete from public.assessment_marks m
       where m.course_id = p_course_id and m.student_id = any (v_reset) and m.component = any (v_marks_parts);
    end if;
  end if;

  v_result := jsonb_build_object(
    'dry_run', p_dry_run,
    'students', cardinality(v_reset),
    'attempts', v_attempts,
    'marks', v_marks,
    'certified_students', cardinality(v_certified),
    'skipped_certified', case when p_revoke_certs then 0 else cardinality(v_certified) end,
    'certificates_revoked', v_revoked,
    'notified', v_notified
  );

  if not p_dry_run then
    insert into public.exam_resets (course_id, student_id, done_by, parts, result)
    values (p_course_id, p_student_id, auth.uid(), v_parts, v_result);
  end if;

  return v_result;
end;
$$;
revoke all on function public.reset_exam_data(uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.reset_exam_data(uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
