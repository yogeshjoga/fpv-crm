-- Student reviews on the public website.
--
-- Reviews stay private: `reviews` keeps its RLS untouched (a student reads their own, staff with the
-- Reviews module read the rest). A review only reaches the public site when an admin explicitly features
-- it here, choosing the display name (and optionally a one-line description) and confirming the student
-- agreed. The website then reads two SECURITY DEFINER functions that return only the featured reviews and
-- an anonymous overall average. Nothing else about a student is ever exposed.

create table public.site_featured_reviews (
  review_id uuid primary key references public.reviews(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  subtitle text not null default '' check (char_length(subtitle) <= 120),
  featured_by uuid default auth.uid() references auth.users(id) on delete set null,
  featured_at timestamptz not null default now()
);

revoke all on public.site_featured_reviews from anon, authenticated;
grant select, insert, update, delete on public.site_featured_reviews to authenticated;
alter table public.site_featured_reviews enable row level security;

create policy site_featured_reviews_read on public.site_featured_reviews
  for select to authenticated
  using (public.has_module_access('reviews', 'read'));
create policy site_featured_reviews_write on public.site_featured_reviews
  for all to authenticated
  using (public.has_module_access('reviews', 'write'))
  with check (public.has_module_access('reviews', 'write'));

-- Featured reviews that have a comment, newest feature first. Only these five columns ever leave the database.
create or replace function public.get_public_reviews()
returns table (id uuid, rating smallint, comment text, display_name text, subtitle text, reviewed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.comment, f.display_name, f.subtitle, r.created_at
  from public.site_featured_reviews f
  join public.reviews r on r.id = f.review_id
  where char_length(btrim(r.comment)) > 0
  order by f.featured_at desc
  limit 24;
$$;

-- Overall numbers across every review, with no personal data: how many and the average.
create or replace function public.get_public_review_stats()
returns table (review_count bigint, avg_rating numeric)
language sql stable security definer set search_path = public as $$
  select count(*), round(avg(rating)::numeric, 1) from public.reviews;
$$;

revoke all on function public.get_public_reviews() from public;
revoke all on function public.get_public_review_stats() from public;
grant execute on function public.get_public_reviews() to anon, authenticated;
grant execute on function public.get_public_review_stats() to anon, authenticated;
