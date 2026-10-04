-- When an admin sets or changes a course's exam schedule, every enrolled student gets an in-app
-- notification (bell + dashboard timer). No email is sent. Runs as a trigger so it works no matter
-- which screen saved the change, and so students cannot forge these rows (notifications has no
-- client insert policy).
create or replace function public.notify_exam_schedule_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_link  text := '/app/courses/' || new.slug;
  v_title text;
  v_body  text;
  v_fmt   constant text := 'Dy DD Mon YYYY, HH12:MI AM';
begin
  if new.exam_access is not distinct from old.exam_access
     and new.exam_opens_at is not distinct from old.exam_opens_at
     and new.exam_closes_at is not distinct from old.exam_closes_at
     and new.exam_time_limit_min is not distinct from old.exam_time_limit_min then
    return new;
  end if;

  if new.exam_access = 'scheduled' then
    v_title := 'Exam scheduled: ' || new.title;
    v_body := case when new.exam_opens_at is not null
                   then 'Opens ' || to_char(new.exam_opens_at at time zone 'Asia/Kolkata', v_fmt) || ' IST'
                   else 'Opens immediately' end
           || case when new.exam_closes_at is not null
                   then ' · Closes ' || to_char(new.exam_closes_at at time zone 'Asia/Kolkata', v_fmt) || ' IST'
                   else '' end
           || ' · ' || new.exam_time_limit_min || ' min. Your dashboard shows the countdown.';
  elsif new.exam_access = 'open' and old.exam_access is distinct from 'open' then
    v_title := 'Exam is now open: ' || new.title;
    v_body := 'You can start the online exam any time. You have ' || new.exam_time_limit_min || ' minutes once you begin.';
  else
    return new;
  end if;

  -- an updated schedule replaces the earlier unread one instead of piling up
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

revoke all on function public.notify_exam_schedule_change() from public, anon, authenticated;

drop trigger if exists courses_exam_schedule_notify on public.courses;
create trigger courses_exam_schedule_notify
  after update on public.courses
  for each row execute function public.notify_exam_schedule_change();
