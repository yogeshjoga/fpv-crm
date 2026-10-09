-- Student consent for showing a review on the public website.
--
-- Consent is kept in its own table so the review itself (and its edit lock) is untouched. A student can
-- allow or withdraw at any time through set_review_website_consent(), with no admin approval; withdrawing
-- also removes the review from the website immediately. Admins can only read the choice, never set it.

create table public.review_website_consent (
  review_id uuid primary key references public.reviews(id) on delete cascade,
  allowed boolean not null,
  decided_at timestamptz not null default now()
);

revoke all on public.review_website_consent from anon, authenticated;
grant select on public.review_website_consent to authenticated;
alter table public.review_website_consent enable row level security;

create policy review_website_consent_own_read on public.review_website_consent
  for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id and r.student_id = auth.uid()));
create policy review_website_consent_staff_read on public.review_website_consent
  for select to authenticated
  using (public.has_module_access('reviews', 'read'));

create or replace function public.set_review_website_consent(p_review uuid, p_allow boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.reviews r where r.id = p_review and r.student_id = auth.uid()) then
    raise exception 'That is not your review' using errcode = '42501';
  end if;
  insert into public.review_website_consent (review_id, allowed) values (p_review, p_allow)
    on conflict (review_id) do update set allowed = excluded.allowed, decided_at = now();
  if not p_allow then
    delete from public.site_featured_reviews where review_id = p_review;
  end if;
end $$;

revoke all on function public.set_review_website_consent(uuid, boolean) from public, anon;
grant execute on function public.set_review_website_consent(uuid, boolean) to authenticated;

-- How an admin got the go-ahead: the student opted in themselves, or staff confirmed it another way.
alter table public.site_featured_reviews
  add column consent text not null default 'staff-confirmed' check (consent in ('student-opt-in', 'staff-confirmed'));

-- A student who has said no is never shown, whatever else is recorded.
create or replace function public.get_public_reviews()
returns table (id uuid, rating smallint, comment text, display_name text, subtitle text, reviewed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.comment, f.display_name, f.subtitle, r.created_at
  from public.site_featured_reviews f
  join public.reviews r on r.id = f.review_id
  where char_length(btrim(r.comment)) > 0
    and not exists (select 1 from public.review_website_consent c where c.review_id = r.id and not c.allowed)
  order by f.featured_at desc
  limit 24;
$$;
