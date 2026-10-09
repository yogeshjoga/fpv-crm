-- Reviews the student has agreed to publish now reach the website on their own, newest first, so the site
-- stays current without staff featuring each one. Staff keep control: a featured row can change the shown
-- name and description, or set `hidden` to keep a review off the site (for example a comment that should not
-- be public). A student who said no is never shown, and a review nobody has agreed to is never shown.

alter table public.site_featured_reviews
  add column hidden boolean not null default false;

create or replace function public.get_public_reviews()
returns table (id uuid, rating smallint, comment text, display_name text, subtitle text, reviewed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select
    r.id,
    r.rating,
    r.comment,
    coalesce(
      f.display_name,
      nullif(
        case
          when cardinality(n.parts) > 1 then n.parts[1] || ' ' || upper(left(n.parts[cardinality(n.parts)], 1)) || '.'
          else n.parts[1]
        end,
        ''
      ),
      'Student'
    ),
    coalesce(f.subtitle, ''),
    r.created_at
  from public.reviews r
  left join public.site_featured_reviews f on f.review_id = r.id
  left join public.review_website_consent c on c.review_id = r.id
  left join public.profiles p on p.id = r.student_id
  cross join lateral (
    select regexp_split_to_array(btrim(coalesce(p.full_name, '')), '\s+') as parts
  ) n
  where char_length(btrim(r.comment)) > 0
    and coalesce(f.hidden, false) = false
    and (c.allowed is true or (f.review_id is not null and c.allowed is distinct from false))
  order by r.created_at desc
  limit 24;
$$;
