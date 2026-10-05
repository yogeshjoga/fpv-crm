-- Admins can take attempts away as well as give them. The per-student extra can now go below zero
-- (down to -20), so one student can be allowed fewer attempts than the course default. Attempts they
-- have already used are never deleted by this; use Reset exam for that.
alter table public.enrollments drop constraint if exists enrollments_extra_attempts_check;
alter table public.enrollments add constraint enrollments_extra_attempts_check check (extra_attempts between -20 and 20);

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
    raise exception 'Only an admin can change exam attempts.' using errcode = '42501';
  end if;
  if p_extra is null or p_extra < -20 or p_extra > 20 then
    raise exception 'Change attempts by between -20 and 20 at a time.' using errcode = '22023';
  end if;

  select e.id, e.extra_attempts, e.status into v_enr
    from public.enrollments e where e.student_id = p_student_id and e.course_id = p_course_id;
  if not found or v_enr.status = 'revoked' then
    raise exception 'That student is not enrolled in this course.' using errcode = '22023';
  end if;
  select c.title, c.max_attempts into v_course from public.courses c where c.id = p_course_id;

  -- the allowance can be cut down to zero, never below it
  update public.enrollments
     set extra_attempts = greatest(-least(20, v_course.max_attempts), least(20, extra_attempts + p_extra))
   where id = v_enr.id
  returning extra_attempts into v_new;

  -- giving attempts unlocks the student; taking them away leaves lock state alone
  if p_extra > 0 then
    update public.exam_attempts
       set locked = false,
           cooldown_until = case when p_skip_wait then null else cooldown_until end
     where student_id = p_student_id and course_id = p_course_id and status <> 'in_progress';
  end if;

  v_total := greatest(0, v_course.max_attempts + v_new);

  if p_extra <> 0 then
    insert into public.notifications (recipient_id, title, body, kind, link)
    select p_student_id,
           case when p_extra > 0 then 'Another exam attempt: ' else 'Exam attempts changed: ' end || v_course.title,
           case when p_extra > 0
                then 'You have been given ' || p_extra || ' more attempt' || case when p_extra = 1 then '' else 's' end || ' (' || v_total || ' in total).'
                else 'Your allowed attempts for this exam are now ' || v_total || ' in total.' end,
           'exam_schedule',
           '/app/courses/' || c.slug
      from public.courses c where c.id = p_course_id;
  end if;

  return jsonb_build_object('extra_attempts', v_new, 'allowed', v_total);
end;
$$;
revoke all on function public.grant_exam_attempts(uuid, uuid, integer, boolean) from public, anon;
grant execute on function public.grant_exam_attempts(uuid, uuid, integer, boolean) to authenticated;
