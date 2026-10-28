-- Photos for the org tree. Staff with write access to the Org tree can upload a person's picture into site-media/org/
-- (the same public bucket the website content uses; file names are random, and only these three rules are added).

create policy "site-media org write" on storage.objects for insert to authenticated with check (
  bucket_id = 'site-media' and (storage.foldername(name))[1] = 'org' and (select public.has_module_access('org-tree', 'write')));
create policy "site-media org update" on storage.objects for update to authenticated using (
  bucket_id = 'site-media' and (storage.foldername(name))[1] = 'org' and (select public.has_module_access('org-tree', 'write')));
create policy "site-media org delete" on storage.objects for delete to authenticated using (
  bucket_id = 'site-media' and (storage.foldername(name))[1] = 'org' and (select public.has_module_access('org-tree', 'write')));
