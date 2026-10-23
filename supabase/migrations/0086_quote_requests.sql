-- Requirement forms for quotations. An admin creates a link for one client, the client opens it (no login) and says what
-- they expect (simulation, piloting, theory, PID, PCB reverse engineering, research...), and the admin turns the answers
-- into a quotation.
--
-- Safety (see .claude/skills/fpv-crm-security-guidelines):
--  * the public never touches this table: the `quote-request` edge function (service role) validates every answer,
--    rate limits by network and by link, and is the only writer of answers
--  * a link is a 128-bit random token, expires, and stops accepting answers once a quotation has been made from it
--  * staff read/write through the 'quotations' module; the token and the answers cannot be written by a client session

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'open' check (status in ('open', 'submitted', 'quoted', 'closed')),
  client_name text not null check (char_length(btrim(client_name)) between 1 and 120),
  organisation text not null default '' check (char_length(organisation) <= 200),
  client_email text check (client_email is null or (char_length(client_email) <= 200 and client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  client_phone text not null default '' check (char_length(client_phone) <= 30),
  enquiry_id uuid references public.site_enquiries(id) on delete set null,
  expires_at timestamptz not null default now() + interval '30 days',
  answers jsonb check (answers is null or (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 20000)),
  submitted_at timestamptz,
  submit_count integer not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_request_token_format check (token ~ '^[a-f0-9]{32}$')
);
create index quote_requests_created on public.quote_requests (created_at desc);

alter table public.quotations add column request_id uuid references public.quote_requests(id) on delete set null;

create trigger quote_requests_touch before update on public.quote_requests
  for each row execute function public.set_updated_at();
-- the audit trigger redacts any column whose name looks like a secret, which includes "token"
create trigger audit_quote_requests after insert or update or delete on public.quote_requests
  for each row execute function public.audit_row();

alter table public.quote_requests enable row level security;
revoke all on public.quote_requests from anon, authenticated;
-- staff may create a link (never choose the token, the status or the answers) and read everything
grant select on public.quote_requests to authenticated;
grant insert (client_name, organisation, client_email, client_phone, enquiry_id, expires_at) on public.quote_requests to authenticated;
grant update (client_name, organisation, client_email, client_phone, expires_at, status) on public.quote_requests to authenticated;
grant delete on public.quote_requests to authenticated;

create policy quote_requests_read on public.quote_requests for select to authenticated
  using (public.has_module_access('quotations', 'read'));
create policy quote_requests_insert on public.quote_requests for insert to authenticated
  with check (public.has_module_access('quotations', 'write') and status = 'open');
create policy quote_requests_update on public.quote_requests for update to authenticated
  using (public.has_module_access('quotations', 'write')) with check (public.has_module_access('quotations', 'write'));
create policy quote_requests_delete on public.quote_requests for delete to authenticated
  using (public.has_module_access('quotations', 'write') and status in ('open', 'closed'));
