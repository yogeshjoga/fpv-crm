-- Two gaps found while polishing ID cards: (1) there was no way for a student to
-- ever set profiles.avatar_url — the ID card and header both read it, but nothing
-- wrote it — so every card fell back to initials. (2) the org has an official
-- round seal/stamp it wants shown next to the founder's signature on ID cards.

-- Public bucket, same pattern as course-covers: anyone can read, but a user may
-- only write inside their own uid-prefixed folder (matches enrollment-uploads).
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars owner write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner delete" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.org_settings add column company_seal_url text;
