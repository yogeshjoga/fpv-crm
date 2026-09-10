-- The real Titan mailbox is contact@egirerobotics.com; support@ was never provisioned.
update public.org_settings
set support_email = 'contact@egirerobotics.com'
where id = true and support_email = 'support@egirerobotics.com';

alter table public.org_settings
  alter column support_email set default 'contact@egirerobotics.com';
