-- Admins can give a student more exam attempts than the course allows. The allowance for one student
-- is the course's "attempts allowed" plus this per-enrollment extra.
alter table public.enrollments
  add column if not exists extra_attempts integer not null default 0
  check (extra_attempts >= 0 and extra_attempts <= 20);

-- Only an admin / super admin (or the service role) may change it, so an instructor or coordinator
-- editing enrollments through the API cannot hand out attempts.
create or replace function public.guard_extra_attempts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.extra_attempts is distinct from old.extra_attempts
     and auth.uid() is not null
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin')) then
    new.extra_attempts := old.extra_attempts;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_extra_attempts() from public, anon, authenticated;
drop trigger if exists enrollments_guard_extra_attempts on public.enrollments;
create trigger enrollments_guard_extra_attempts before update on public.enrollments
  for each row execute function public.guard_extra_attempts();

-- Give a student more attempts at a course's exam. Also unlocks them (the last attempt is marked locked
-- once the allowance runs out) and, by default, clears any waiting time so they can start straight away.
-- A student already holding a certificate for the course cannot sit it again; that rule is unchanged.
create or replace function public.grant_exam_attempts(
  p_student_id uuid,
  p_course_id uuid,
  p_extra integer default 1,
  p_skip_wait boolean default true
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_enr record;
  v_course record;
  v_total integer;
  v_new integer;
begin
  if auth.uid() is null
     or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin')) then
    raise exception 'Only an admin can give extra attempts.' using errcode = '42501';
  end if;
  if p_extra is null or p_extra < 0 or p_extra > 20 then
    raise exception 'Give between 0 and 20 extra attempts at a time.' using errcode = '22023';
  end if;

  select e.id, e.extra_attempts, e.status into v_enr
    from public.enrollments e where e.student_id = p_student_id and e.course_id = p_course_id;
  if not found or v_enr.status = 'revoked' then
    raise exception 'That student is not enrolled in this course.' using errcode = '22023';
  end if;
  select c.title, c.max_attempts into v_course from public.courses c where c.id = p_course_id;

  update public.enrollments
     set extra_attempts = least(20, extra_attempts + p_extra)
   where id = v_enr.id
  returning extra_attempts into v_new;

  update public.exam_attempts
     set locked = false,
         cooldown_until = case when p_skip_wait then null else cooldown_until end
   where student_id = p_student_id and course_id = p_course_id and status <> 'in_progress';

  v_total := v_course.max_attempts + v_new;

  if p_extra > 0 then
    insert into public.notifications (recipient_id, title, body, kind, link)
    select p_student_id,
           'Another exam attempt: ' || v_course.title,
           'You have been given ' || p_extra || ' more attempt' || case when p_extra = 1 then '' else 's' end
             || ' (' || v_total || ' in total).',
           'exam_schedule',
           '/app/courses/' || c.slug
      from public.courses c where c.id = p_course_id;
  end if;

  return jsonb_build_object('extra_attempts', v_new, 'allowed', v_total);
end;
$$;
revoke all on function public.grant_exam_attempts(uuid, uuid, integer, boolean) from public, anon;
grant execute on function public.grant_exam_attempts(uuid, uuid, integer, boolean) to authenticated;
