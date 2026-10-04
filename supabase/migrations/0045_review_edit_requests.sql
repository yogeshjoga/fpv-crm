-- Review edits are by permission only. A student asks (with a reason); a staff member approves or
-- declines. An approval unlocks exactly one edit of that review's rating/comment, then the
-- request is marked 'used' and the review is locked again.
create table public.review_edit_requests (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 5 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'used')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
-- one open (pending or approved) request per review at a time
create unique index review_edit_requests_one_open on public.review_edit_requests (review_id) where status in ('pending', 'approved');
create index review_edit_requests_status_idx on public.review_edit_requests (status);

alter table public.review_edit_requests enable row level security;
create policy review_edit_requests_staff_read on public.review_edit_requests for select using (public.is_staff());
create policy review_edit_requests_own_read on public.review_edit_requests for select using (student_id = auth.uid());
create policy review_edit_requests_student_insert on public.review_edit_requests for insert with check (
  student_id = auth.uid()
  and status = 'pending'
  and public.is_active_user()
  and not public.is_staff()
  and exists (select 1 from public.reviews r where r.id = review_id and r.student_id = auth.uid())
);
create policy review_edit_requests_staff_decide on public.review_edit_requests for update
  using (public.is_staff() and status in ('pending', 'approved'))
  with check (public.is_staff() and status in ('approved', 'denied'));

-- A decision can only change the status; record who decided and when, and tell the student.
create or replace function public.review_edit_request_decided() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.review_id <> old.review_id or new.student_id <> old.student_id or new.reason <> old.reason or new.created_at <> old.created_at then
    raise exception 'Only the status of an edit request can change';
  end if;
  if new.status <> old.status and new.status in ('approved', 'denied') then
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;
create trigger review_edit_request_decided before update on public.review_edit_requests
  for each row execute function public.review_edit_request_decided();

create or replace function public.review_edit_request_notify_student() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and new.status in ('approved', 'denied') then
    insert into public.notifications (recipient_id, title, body, kind, link)
    values (
      new.student_id,
      case when new.status = 'approved' then 'Your review edit was approved' else 'Your review edit request was declined' end,
      case when new.status = 'approved'
           then 'You can now update your review once. Open Reviews to make your change.'
           else 'An admin reviewed your request and kept the original review.' end,
      'review_edit',
      '/app/reviews'
    );
  end if;
  return null;
end;
$$;
create trigger review_edit_request_notify_student after update on public.review_edit_requests
  for each row execute function public.review_edit_request_notify_student();

create or replace function public.review_edit_request_notify_staff() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; grp text;
begin
  select coalesce(nullif(p.full_name, ''), p.email) into who from public.profiles p where p.id = new.student_id;
  select g.name into grp from public.reviews r join public.course_groups g on g.id = r.group_id where r.id = new.review_id;
  insert into public.notifications (recipient_id, title, body, kind, link)
  select p.id, 'Review edit request', coalesce(who, 'A student') || ' asked to edit their review of ' || coalesce(grp, 'a course group') || '.', 'review_edit', '/admin/reviews'
    from public.profiles p
   where p.status = 'active' and p.role in ('instructor', 'coordinator', 'admin', 'super_admin');
  return null;
end;
$$;
create trigger review_edit_request_notify_staff after insert on public.review_edit_requests
  for each row execute function public.review_edit_request_notify_staff();

-- Reviews: a student may update their own review only while an approved request exists, and can
-- never move it to another student or group.
create policy reviews_student_update_if_approved on public.reviews for update
  using (
    student_id = auth.uid() and not public.is_staff()
    and exists (select 1 from public.review_edit_requests q where q.review_id = reviews.id and q.status = 'approved')
  )
  with check (student_id = auth.uid());

create or replace function public.reviews_guard_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.student_id <> old.student_id or new.group_id is distinct from old.group_id
     or new.course_id is distinct from old.course_id or new.created_at <> old.created_at then
    raise exception 'A review cannot be moved to another student or group';
  end if;
  return new;
end;
$$;
create trigger reviews_guard_update before update on public.reviews
  for each row execute function public.reviews_guard_update();

-- Using the approval: once the review is saved, the request is spent and the review locks again.
create or replace function public.reviews_spend_edit_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.review_edit_requests set status = 'used' where review_id = new.id and status = 'approved';
  return null;
end;
$$;
create trigger reviews_spend_edit_request after update on public.reviews
  for each row execute function public.reviews_spend_edit_request();

-- Trigger functions run with elevated rights; nobody should be able to call them directly.
revoke execute on function public.review_edit_request_decided() from public, anon, authenticated;
revoke execute on function public.review_edit_request_notify_student() from public, anon, authenticated;
revoke execute on function public.review_edit_request_notify_staff() from public, anon, authenticated;
revoke execute on function public.reviews_spend_edit_request() from public, anon, authenticated;
