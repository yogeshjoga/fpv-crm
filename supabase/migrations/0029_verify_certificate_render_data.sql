-- The public /verify page now renders the actual certificate (background image +
-- overlaid text, same layout as generate-certificate's PDF) instead of a plain
-- text summary, so a viewer can see it's a genuine EgireRobotics certificate, not
-- just take our word for the fields. verify_certificate needs a few more fields to
-- do that: the certificate ID and type, and just the safe branding columns off
-- org_settings (never `select *` there — it also holds google_form_secret).
-- Branding is a scalar subquery, not a join, so a missing/extra org_settings row
-- can never suppress an otherwise-valid certificate match.

-- return type is changing (more OUT columns), so the old signature must go first
drop function if exists public.verify_certificate(text);

create function public.verify_certificate(p_cert_id text)
returns table (
  valid               boolean,
  student_name        text,
  course_title        text,
  cert_type           text,
  issued_at           timestamptz,
  score_pct           numeric,
  revoked             boolean,
  cert_id_string      text,
  org_name            text,
  verify_base_url     text,
  cert_background_url text
)
language sql stable security definer set search_path = public as $$
  select
    (c.id is not null and not c.revoked)      as valid,
    p.full_name                               as student_name,
    co.title                                  as course_title,
    co.cert_type                              as cert_type,
    c.issued_at,
    c.score_pct,
    coalesce(c.revoked, false)                as revoked,
    c.cert_id_string,
    (select o.org_name from public.org_settings o limit 1),
    (select o.verify_base_url from public.org_settings o limit 1),
    (select o.cert_background_url from public.org_settings o limit 1)
  from public.certificates c
  join public.profiles p on p.id = c.student_id
  join public.courses  co on co.id = c.course_id
  where upper(c.cert_id_string) = upper(p_cert_id);
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;
