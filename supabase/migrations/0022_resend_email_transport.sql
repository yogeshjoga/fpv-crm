-- Adds a Resend API key alongside the existing SMTP fields on mail_config, so the
-- shared sendEmail() helper can use Resend's HTTP API instead of GoDaddy SMTP
-- relay (which has been disabled on the account's mailbox, independent of the
-- mailbox password). Same service-role-only table as the existing SMTP columns —
-- RLS already blocks all client access; only edge functions read it.

alter table public.mail_config add column resend_api_key text;
