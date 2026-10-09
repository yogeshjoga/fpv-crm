-- Follow-up to 0069. Anonymous visitors cannot execute has_module_access() / is_super_admin(), so a read
-- policy that calls them for the anon role raises "permission denied" instead of filtering rows. Split each
-- read policy into a public one (plain column checks only) and a staff one that applies to signed-in users only.

drop policy site_gallery_albums_read on public.site_gallery_albums;
create policy site_gallery_albums_read_public on public.site_gallery_albums
  for select to anon, authenticated
  using (is_published);
create policy site_gallery_albums_read_staff on public.site_gallery_albums
  for select to authenticated
  using (public.has_module_access('site-gallery', 'read'));

drop policy site_gallery_images_read on public.site_gallery_images;
create policy site_gallery_images_read_public on public.site_gallery_images
  for select to anon, authenticated
  using (is_published and exists (select 1 from public.site_gallery_albums a where a.id = album_id and a.is_published));
create policy site_gallery_images_read_staff on public.site_gallery_images
  for select to authenticated
  using (public.has_module_access('site-gallery', 'read'));

-- blog: super admins already read drafts through the "for all" write policy
drop policy site_blog_posts_read on public.site_blog_posts;
create policy site_blog_posts_read_public on public.site_blog_posts
  for select to anon, authenticated
  using (is_published);
