-- The Google Forms webhook secret now lives in org_secrets (super admins + service role only).
-- Remove the copy that every signed-in user could read through org_settings.
alter table public.org_settings drop column google_form_secret;
