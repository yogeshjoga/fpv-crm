-- Videos on the public website (the carousel on the Home and Workshops pages), managed from the CRM.
--
-- A video is either a file uploaded to the public `site-videos` bucket, or a YouTube link (played in
-- YouTube's privacy-enhanced player, only when a visitor presses play). The website reads published rows
-- with the anon key; staff with the 'site-videos' module manage them. Additive: nothing existing changes.

create table public.site_videos (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('file', 'youtube')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  caption text not null default '' check (char_length(caption) <= 300),
  -- uploaded file: the public address, an optional lighter copy for phones, and the storage paths for clean-up
  video_url text check (video_url is null or video_url ~ '^https://'),
  video_url_low text check (video_url_low is null or video_url_low ~ '^https://'),
  video_path text,
  video_low_path text,
  -- YouTube: the 11-character video id
  youtube_id text check (youtube_id is null or youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  poster_url text not null check (poster_url ~ '^https://'),
  poster_path text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint site_videos_has_source check (
    (kind = 'file' and video_url is not null and youtube_id is null)
    or (kind = 'youtube' and youtube_id is not null and video_url is null)
  )
);

revoke all on public.site_videos from anon, authenticated;
grant select on public.site_videos to anon, authenticated;
grant insert, update, delete on public.site_videos to authenticated;
alter table public.site_videos enable row level security;

-- the public sees published videos; anonymous visitors cannot run has_module_access(), so staff read is separate
create policy site_videos_read_public on public.site_videos
  for select to anon, authenticated using (is_published);
create policy site_videos_read_staff on public.site_videos
  for select to authenticated using (public.has_module_access('site-videos', 'read'));
create policy site_videos_write on public.site_videos
  for all to authenticated
  using (public.has_module_access('site-videos', 'write'))
  with check (public.has_module_access('site-videos', 'write'));

-- files: a public-read bucket of their own (videos are larger than the 10 MB image bucket allows)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-videos', 'site-videos', true, 52428800, array['video/mp4', 'video/webm', 'image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "site-videos read" on storage.objects
  for select using (bucket_id = 'site-videos');
create policy "site-videos write" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-videos' and public.has_module_access('site-videos', 'write'));
create policy "site-videos update" on storage.objects
  for update to authenticated using (bucket_id = 'site-videos' and public.has_module_access('site-videos', 'write'));
create policy "site-videos delete" on storage.objects
  for delete to authenticated using (bucket_id = 'site-videos' and public.has_module_access('site-videos', 'write'));

-- admins manage videos by default; a super admin can change this per role in Company Settings
insert into public.role_module_access (role, module_key, access_level) values
  ('admin', 'site-videos', 'write')
on conflict (role, module_key) do nothing;
