-- EgireRobotics LMS — staff directory, shared calendar, in-app notifications.

-- ---------------------------------------------------------------------------
-- Staff directory
-- ---------------------------------------------------------------------------
create table public.staff_details (
  profile_id    uuid primary key references public.profiles(id) on delete cascade,
  employee_code text,
  department    text not null default '',
  designation   text not null default '',
  joined_on     date,
  notes         text not null default '',
  updated_at    timestamptz not null default now()
);
create trigger trg_staff_details_updated before update on public.staff_details
  for each row execute function public.set_updated_at();

alter table public.staff_details enable row level security;

create policy staff_details_select on public.staff_details
  for select using (profile_id = auth.uid() or public.is_staff());
create policy staff_details_write_super on public.staff_details
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------
create type calendar_event_type as enum ('session', 'exam_window', 'deadline', 'holiday', 'other');

create table public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  type        calendar_event_type not null default 'other',
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  all_day     boolean not null default false,
  location    text not null default '',
  course_id   uuid references public.courses(id) on delete cascade,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.calendar_events (starts_at);
create index on public.calendar_events (course_id);
create trigger trg_calendar_events_updated before update on public.calendar_events
  for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;

create policy calendar_events_select on public.calendar_events
  for select using (
    public.is_staff()
    or (
      public.is_active_user()
      and (
        course_id is null
        or exists (
          select 1 from public.enrollments e
          where e.student_id = auth.uid()
            and e.course_id = calendar_events.course_id
            and e.status <> 'revoked'
        )
      )
    )
  );
create policy calendar_events_write_staff on public.calendar_events
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- In-app notifications + broadcast log
-- ---------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  body         text not null default '',
  kind         text not null default 'broadcast',
  link         text,
  broadcast_id uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index on public.notifications (recipient_id, read_at);
create index on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

-- recipients read their own; may only flip read_at (enforced in the client + a guard trigger)
create policy notifications_select_own on public.notifications
  for select using (recipient_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
-- inserts happen through the service role (notify / broadcast edge functions)

create or replace function public.guard_notification_immutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;  -- service role
  end if;
  -- end users may only change read_at
  new.title := old.title;
  new.body := old.body;
  new.kind := old.kind;
  new.link := old.link;
  new.recipient_id := old.recipient_id;
  new.broadcast_id := old.broadcast_id;
  new.created_at := old.created_at;
  return new;
end;
$$;
create trigger trg_notifications_guard
  before update on public.notifications
  for each row execute function public.guard_notification_immutable();

create table public.broadcasts (
  id              uuid primary key default gen_random_uuid(),
  subject         text not null,
  body            text not null default '',
  audience_type   text not null,           -- all_students | course | all_staff | users
  audience_ref    jsonb not null default '{}'::jsonb,
  recipient_count int not null default 0,
  email_sent      int not null default 0,
  sent_by         uuid references public.profiles(id) on delete set null,
  sent_at         timestamptz not null default now()
);
create index on public.broadcasts (sent_at desc);

alter table public.broadcasts enable row level security;

create policy broadcasts_select_staff on public.broadcasts
  for select using (public.is_staff());
-- inserts happen through the service role (broadcast edge function)

alter table public.notifications
  add constraint notifications_broadcast_fk
  foreign key (broadcast_id) references public.broadcasts(id) on delete set null;
