-- Admins can give the online exam its own name (shown to students on the dashboard and in the
-- schedule notification). Empty = fall back to the course title.
alter table public.courses add column if not exists exam_name text;

create or replace function public.notify_exam_schedule_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_link  text := '/app/courses/' || new.slug;
  v_name  text := coalesce(nullif(btrim(new.exam_name), ''), new.title);
  v_title text;
  v_body  text;
  v_fmt   constant text := 'Dy DD Mon YYYY, HH12:MI AM';
begin
  if new.exam_access is not distinct from old.exam_access
     and new.exam_opens_at is not distinct from old.exam_opens_at
     and new.exam_closes_at is not distinct from old.exam_closes_at
     and new.exam_time_limit_min is not distinct from old.exam_time_limit_min
     and new.exam_name is not distinct from old.exam_name then
    return new;
  end if;

  if new.exam_access = 'scheduled' then
    v_title := 'Exam scheduled: ' || v_name;
    v_body := case when new.exam_opens_at is not null
                   then 'Opens ' || to_char(new.exam_opens_at at time zone 'Asia/Kolkata', v_fmt) || ' IST'
                   else 'Opens immediately' end
           || case when new.exam_closes_at is not null
                   then ' · Closes ' || to_char(new.exam_closes_at at time zone 'Asia/Kolkata', v_fmt) || ' IST'
                   else '' end
           || ' · ' || new.exam_time_limit_min || ' min. Your dashboard shows the countdown.';
  elsif new.exam_access = 'open' and old.exam_access is distinct from 'open' then
    v_title := 'Exam is now open: ' || v_name;
    v_body := 'You can start the online exam any time. You have ' || new.exam_time_limit_min || ' minutes once you begin.';
  else
    return new;
  end if;

  delete from public.notifications
   where kind = 'exam_schedule' and link = v_link and read_at is null;

  insert into public.notifications (recipient_id, title, body, kind, link)
  select e.student_id, v_title, v_body, 'exam_schedule', v_link
    from public.enrollments e
    join public.profiles p on p.id = e.student_id
   where e.course_id = new.id
     and e.status = 'active'
     and p.status = 'active'
     and p.role = 'student';

  return new;
end;
$$;
