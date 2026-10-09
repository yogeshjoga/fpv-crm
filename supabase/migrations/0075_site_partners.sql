-- Partners and collaborations shown on the public website (Workshops page). Staff with the 'site-partners'
-- module add a logo, a name and an optional website link; the site reads published rows with the anon key.
-- Additive: no existing table or policy is changed.

create table public.site_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  website_url text check (website_url is null or (char_length(website_url) <= 300 and website_url ~ '^https?://')),
  logo_path text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

revoke all on public.site_partners from anon, authenticated;
grant select on public.site_partners to anon, authenticated;
grant insert, update, delete on public.site_partners to authenticated;
alter table public.site_partners enable row level security;

-- the public sees published partners; anonymous visitors cannot run has_module_access(), so the staff read is separate
create policy site_partners_read_public on public.site_partners
  for select to anon, authenticated
  using (is_published);
create policy site_partners_read_staff on public.site_partners
  for select to authenticated
  using (public.has_module_access('site-partners', 'read'));
create policy site_partners_write on public.site_partners
  for all to authenticated
  using (public.has_module_access('site-partners', 'write'))
  with check (public.has_module_access('site-partners', 'write'));

-- logos live under site-media/partners/ in the existing public bucket; these add to the gallery and blog rules
create policy "site-media partners write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'partners'
    and public.has_module_access('site-partners', 'write')
  );
create policy "site-media partners update" on storage.objects
  for update to authenticated using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'partners'
    and public.has_module_access('site-partners', 'write')
  );
create policy "site-media partners delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'partners'
    and public.has_module_access('site-partners', 'write')
  );
