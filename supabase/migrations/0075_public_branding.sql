-- The company logo and name are public by nature (the logo file sits in a public storage bucket). The public pages
-- (landing, sign-in) need the URL before anyone is signed in, so expose just those two values, nothing else from org_settings.
create or replace function public.public_branding()
returns table (org_name text, logo_url text)
language sql stable security definer set search_path = public as $$
  select s.org_name, s.logo_url from public.org_settings s limit 1;
$$;
revoke all on function public.public_branding() from public;
grant execute on function public.public_branding() to anon, authenticated;
