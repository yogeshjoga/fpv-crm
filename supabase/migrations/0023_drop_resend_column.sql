-- Reverts 0022_resend_email_transport.sql: the project is staying on GoDaddy
-- SMTP for now rather than switching to Resend, so this column is unused.

alter table public.mail_config drop column if exists resend_api_key;
