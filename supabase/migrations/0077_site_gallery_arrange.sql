-- Site gallery: arranging and fast delivery.
--  * images can be put in any order (sort_order), keep the original file name (so a folder can be imported again without
--    duplicates) and have a medium size next to the thumbnail and the full size, so the website can choose the smallest
--    file that looks sharp on the visitor's screen;
--  * get_public_gallery() returns the whole published gallery (categories, albums, images with ready-to-use links) in ONE
--    request, which is what keeps the website quick: one round trip instead of three, and every image link is a
--    permanent, cached address (the files never change, so browsers and the CDN keep them for a year).

alter table public.site_gallery_images
  add column if not exists sort_order double precision not null default extract(epoch from clock_timestamp()),
  add column if not exists medium_path text,
  add column if not exists source_name text check (source_name is null or char_length(source_name) <= 200);

update public.site_gallery_images set sort_order = extract(epoch from created_at) where sort_order = 0;

create index if not exists site_gallery_images_order_idx on public.site_gallery_images (album_id, sort_order);
create index if not exists site_gallery_images_source_idx on public.site_gallery_images (album_id, source_name);

create or replace function public.get_public_gallery()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(cat order by cat_sort, cat_name), '[]'::jsonb)
  from (
    select c.sort_order as cat_sort, c.name as cat_name,
      jsonb_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug,
        'albums', (
          select coalesce(jsonb_agg(alb order by a.event_date desc nulls last, a.created_at desc), '[]'::jsonb)
          from public.site_gallery_albums a
          cross join lateral (
            select jsonb_build_object(
              'id', a.id, 'title', a.title, 'slug', a.slug, 'description', a.description, 'event_date', a.event_date,
              'images', (
                select coalesce(jsonb_agg(jsonb_build_object(
                    'id', i.id, 'caption', i.caption, 'width', i.width, 'height', i.height,
                    'thumb', 'https://txbrnewcztixcagdnnfx.supabase.co/storage/v1/object/public/site-media/' || i.thumb_path,
                    'medium', 'https://txbrnewcztixcagdnnfx.supabase.co/storage/v1/object/public/site-media/' || coalesce(i.medium_path, i.full_path),
                    'full', 'https://txbrnewcztixcagdnnfx.supabase.co/storage/v1/object/public/site-media/' || i.full_path
                  ) order by i.sort_order, i.created_at), '[]'::jsonb)
                from public.site_gallery_images i
                where i.album_id = a.id and i.is_published
              )
            ) as alb
          ) x
          where a.category_id = c.id and a.is_published
            and exists (select 1 from public.site_gallery_images i2 where i2.album_id = a.id and i2.is_published)
        )
      ) as cat
    from public.site_gallery_categories c
    where exists (
      select 1 from public.site_gallery_albums a2
      where a2.category_id = c.id and a2.is_published
        and exists (select 1 from public.site_gallery_images i3 where i3.album_id = a2.id and i3.is_published)
    )
  ) t;
$$;
revoke all on function public.get_public_gallery() from public;
grant execute on function public.get_public_gallery() to anon, authenticated;
