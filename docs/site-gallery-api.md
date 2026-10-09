# Site gallery: how the website reads it

Everything is managed under **Site Gallery** in the CRM (super admins and anyone with Write on "Site Gallery"). Files live in the public Supabase Storage bucket `site-media`; the records live in `site_gallery_categories`, `site_gallery_albums` and `site_gallery_images`.

## One request for the whole gallery

```js
const { data } = await supabase.rpc('get_public_gallery'); // anon key is enough
// [{ id, name, slug, albums: [{ id, title, slug, description, event_date,
//      images: [{ id, caption, width, height, thumb, medium, full }] }] }]
```

Only published categories, albums and photos are returned, already in the order set in the CRM, with ready-to-use image links.

## Rendering the images quickly

- Every file name is a random id and never changes, and is served with `Cache-Control: max-age=31536000`, so browsers and the CDN keep it for a year. A repeat view comes from the browser cache.
- Use `thumb` (800px) in grids, `medium` (1280px) for lightbox on phones and `full` (up to 2560px) only for zoom. Set `width` and `height` on the `<img>` so the page does not jump, add `loading="lazy"` and `decoding="async"`, and for a responsive image use `srcset="thumb 800w, medium 1280w, full 2560w"`.
- Cache the RPC result in the website (for example 60 seconds) instead of calling it on every page view.
