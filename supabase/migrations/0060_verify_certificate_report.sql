-- Scanning the QR code on a certificate opens the verify page. It now also returns the student's report
-- card (the per-module marks snapshot kept on the certificate), so whoever scans it can see the marks
-- behind a Merit or Participation certificate as well as the certificate itself. Certificate numbers carry
-- a random tail and lookups are rate limited, so this is not enumerable.
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
  cert_background_url text,
  signatory_image_url text,
  company_seal_url    text,
  report_total        numeric,
  report_max          numeric,
  report              jsonb
)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_caller text;
begin
  begin
    v_caller := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', 'unknown'), ',', 1);
  exception when others then
    v_caller := 'unknown';
  end;
  delete from public.verify_attempts where at < now() - interval '1 hour';
  if (select count(*) from public.verify_attempts where caller = v_caller and at > now() - interval '1 minute') >= 20 then
    return;
  end if;
  insert into public.verify_attempts (caller) values (v_caller);

  return query
  select
    (c.id is not null and not c.revoked),
    coalesce(c.student_name, p.full_name),
    co.title,
    coalesce(c.cert_type, co.cert_type),
    c.issued_at,
    c.score_pct,
    coalesce(c.revoked, false),
    c.cert_id_string,
    (select o.org_name from public.org_settings o limit 1),
    (select o.verify_base_url from public.org_settings o limit 1),
    (select o.cert_background_url from public.org_settings o limit 1),
    (select o.signatory_image_url from public.org_settings o limit 1),
    (select o.company_seal_url from public.org_settings o limit 1),
    (c.report->>'total')::numeric,
    (c.report->>'max')::numeric,
    c.report
  from public.certificates c
  join public.profiles p on p.id = c.student_id
  join public.courses  co on co.id = c.course_id
  where upper(c.cert_id_string) = upper(p_cert_id);
end;
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;
