-- Website reviews read as real people: the reviewer's full name and a tag saying where they studied.
--  * display name: the full name from the profile, tidied (ALL CAPS and all lower case become Title Case, "A.Name" becomes
--    "A Name"). Only a student who agreed to it (scope 'full') is shown with the full name; anyone who agreed under the earlier
--    wording (first name and last initial) stays "First L." until they choose to show more. An admin's own display name wins.
--  * tag (subtitle): the admin's description if there is one, otherwise the course group the review was written for
--    (e.g. "Sivani FPV course"), otherwise the course title.

create or replace function public.tidy_person_name(p text)
returns text language sql immutable set search_path = public as $$
  select coalesce(string_agg(case when w = upper(w) or w = lower(w) then initcap(lower(w)) else w end, ' ' order by ord), '')
    from unnest(string_to_array(
           btrim(regexp_replace(regexp_replace(coalesce(p, ''), '([A-Za-z]{2,})\.([A-Za-z])', '\1 \2', 'g'), '\s+', ' ', 'g')),
           ' ')) with ordinality as t(w, ord)
   where w <> '';
$$;

alter table public.review_website_consent
  add column if not exists scope text not null default 'first-name' check (scope in ('first-name', 'full'));

drop function if exists public.set_review_website_consent(uuid, boolean);
create or replace function public.set_review_website_consent(p_review uuid, p_allow boolean, p_full boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.reviews r where r.id = p_review and r.student_id = auth.uid()) then
    raise exception 'That is not your review' using errcode = '42501';
  end if;
  insert into public.review_website_consent (review_id, allowed, scope)
    values (p_review, p_allow, case when p_allow and p_full then 'full' else 'first-name' end)
    on conflict (review_id) do update set allowed = excluded.allowed, scope = excluded.scope, decided_at = now();
  if not p_allow then
    delete from public.site_featured_reviews where review_id = p_review;
  end if;
end $$;
revoke all on function public.set_review_website_consent(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_review_website_consent(uuid, boolean, boolean) to authenticated;

create or replace function public.get_public_reviews()
returns table (id uuid, rating smallint, comment text, display_name text, subtitle text, reviewed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select
    r.id,
    r.rating,
    r.comment,
    coalesce(
      nullif(btrim(f.display_name), ''),
      nullif(
        case
          when c.scope = 'full' then n.tidy
          when cardinality(n.parts) > 1 then n.parts[1] || ' ' || upper(left(n.parts[cardinality(n.parts)], 1)) || '.'
          else n.parts[1]
        end,
        ''
      ),
      'Student'
    ),
    coalesce(nullif(btrim(f.subtitle), ''), g.name, co.title, ''),
    r.created_at
  from public.reviews r
  left join public.site_featured_reviews f on f.review_id = r.id
  left join public.review_website_consent c on c.review_id = r.id
  left join public.profiles p on p.id = r.student_id
  left join public.course_groups g on g.id = r.group_id
  left join public.courses co on co.id = r.course_id
  cross join lateral (
    select public.tidy_person_name(p.full_name) as tidy,
           string_to_array(public.tidy_person_name(p.full_name), ' ') as parts
  ) n
  where char_length(btrim(r.comment)) > 0
    and coalesce(f.hidden, false) = false
    and (c.allowed is true or (f.review_id is not null and c.allowed is distinct from false))
  order by r.created_at desc
  limit 24;
$$;
