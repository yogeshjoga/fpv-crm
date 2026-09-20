-- Certificates move from a code-drawn layout to a branded background image
-- (uploaded via Settings, same pattern as logo_url/signatory_image_url) with
-- dynamic text (type, name, blurb, ID, date) drawn on top by generate-certificate.
-- cert_type is per-course so instructors can label certificates "Participation",
-- "L1 Pilot", "Coordinator", etc. without a code change.

alter table public.org_settings add column cert_background_url text;
alter table public.courses add column cert_type text not null default 'Participation';
