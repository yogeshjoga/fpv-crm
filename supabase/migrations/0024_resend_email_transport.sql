-- Re-adds the Resend API key column (previously added in 0022, dropped in 0023).
-- GoDaddy SMTP from Edge Functions consistently fails with 535 even with a
-- confirmed-correct password (works fine from Supabase Auth's own mail path),
-- consistent with GoDaddy rejecting the shared/rotating cloud IPs Edge
-- Functions connect from. Switching the whole app's custom email (welcome,
-- certificates, ID cards, notifications, broadcasts) to Resend's HTTP API,
-- which doesn't have this problem.

alter table public.mail_config add column resend_api_key text;
