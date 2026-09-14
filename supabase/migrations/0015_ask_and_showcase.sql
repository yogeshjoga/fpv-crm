-- "Ask us" — a light Q&A thread between a student and staff.
create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  status text not null default 'open', -- open | answered | closed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.support_threads (student_id);
create index on public.support_threads (status, updated_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.support_messages (thread_id, created_at);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

create policy support_threads_select on public.support_threads
  for select using (student_id = auth.uid() or public.is_staff());
create policy support_threads_insert on public.support_threads
  for insert with check (student_id = auth.uid());
create policy support_threads_update on public.support_threads
  for update using (student_id = auth.uid() or public.is_staff())
  with check (student_id = auth.uid() or public.is_staff());

create policy support_messages_select on public.support_messages
  for select using (
    exists (select 1 from public.support_threads t where t.id = support_messages.thread_id and (t.student_id = auth.uid() or public.is_staff()))
  );
create policy support_messages_insert on public.support_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from public.support_threads t where t.id = support_messages.thread_id and (t.student_id = auth.uid() or public.is_staff()))
  );

-- a new message bumps the thread and flips its status depending on who sent it
create or replace function public.touch_support_thread()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.support_threads
  set updated_at = now(),
      status = case when public.is_staff() then 'answered' else 'open' end
  where id = new.thread_id;
  return new;
end;
$$;
create trigger trg_support_message_touch after insert on public.support_messages
for each row execute function public.touch_support_thread();

-- Build showcase — students post a photo/video of their build; a shared feed
-- for the whole active community (students + staff) to like and comment on.
create table public.showcase_posts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  caption text not null default '',
  media_path text not null,
  media_type text not null default 'image', -- image | video
  created_at timestamptz not null default now()
);
create index on public.showcase_posts (created_at desc);

create table public.showcase_likes (
  post_id uuid not null references public.showcase_posts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, student_id)
);

create table public.showcase_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.showcase_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.showcase_comments (post_id, created_at);

alter table public.showcase_posts enable row level security;
alter table public.showcase_likes enable row level security;
alter table public.showcase_comments enable row level security;

create policy showcase_posts_select on public.showcase_posts
  for select using (public.is_active_user() or public.is_staff());
create policy showcase_posts_insert on public.showcase_posts
  for insert with check (student_id = auth.uid() and public.is_active_user());
create policy showcase_posts_delete on public.showcase_posts
  for delete using (student_id = auth.uid() or public.is_staff());

create policy showcase_likes_select on public.showcase_likes
  for select using (public.is_active_user() or public.is_staff());
create policy showcase_likes_insert on public.showcase_likes
  for insert with check (student_id = auth.uid());
create policy showcase_likes_delete on public.showcase_likes
  for delete using (student_id = auth.uid());

create policy showcase_comments_select on public.showcase_comments
  for select using (public.is_active_user() or public.is_staff());
create policy showcase_comments_insert on public.showcase_comments
  for insert with check (author_id = auth.uid() and public.is_active_user());
create policy showcase_comments_delete on public.showcase_comments
  for delete using (author_id = auth.uid() or public.is_staff());

insert into storage.buckets (id, name, public)
values ('showcase', 'showcase', false)
on conflict (id) do nothing;

-- path convention: showcase/<student_id>/<filename>
create policy "showcase write own" on storage.objects
  for insert with check (bucket_id = 'showcase' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "showcase read" on storage.objects
  for select using (bucket_id = 'showcase' and (public.is_active_user() or public.is_staff()));
create policy "showcase delete own or staff" on storage.objects
  for delete using (bucket_id = 'showcase' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
