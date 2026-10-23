-- Client quotations for workshops, trainings and events. Staff fill in the client's requirements, the CRM works out the
-- totals and the PDF (with logo, seal and signature) is built from the saved quotation.
--
-- Safety (see .claude/skills/fpv-crm-security-guidelines):
--  * module 'quotations': staff read/write through has_module_access; instructors and coordinators start with no access
--    because a quotation carries prices (a super admin can change that in Company Settings)
--  * the database, not the browser, works out subtotal / GST / total, so a PDF can never disagree with the stored figures
--  * every field is length- and range-checked; changes land in the audit log

create sequence public.quotation_seq;

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  quote_no text unique,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'expired')),
  enquiry_id uuid references public.site_enquiries(id) on delete set null,

  client_name text not null check (char_length(btrim(client_name)) between 1 and 120),
  client_designation text not null default '' check (char_length(client_designation) <= 160),
  organisation text not null default '' check (char_length(organisation) <= 200),
  client_email text check (client_email is null or (char_length(client_email) <= 200 and client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  client_phone text not null default '' check (char_length(client_phone) <= 30),
  client_address text not null default '' check (char_length(client_address) <= 400),

  title text not null check (char_length(btrim(title)) between 1 and 160),
  programme_type text not null default 'workshop' check (programme_type in ('workshop', 'training', 'event', 'demo')),
  topics jsonb not null default '[]' check (jsonb_typeof(topics) = 'array' and jsonb_array_length(topics) <= 30 and octet_length(topics::text) <= 6000),
  participants integer not null check (participants between 1 and 5000),
  duration_days numeric(4,1) check (duration_days is null or (duration_days > 0 and duration_days <= 60)),
  hours_per_day numeric(3,1) check (hours_per_day is null or (hours_per_day > 0 and hours_per_day <= 24)),
  mode text not null default 'onsite' check (mode in ('onsite', 'online', 'at_egire', 'hybrid')),
  venue text not null default '' check (char_length(venue) <= 240),
  proposed_start date,
  proposed_end date,
  dates_note text not null default '' check (char_length(dates_note) <= 240),

  issued_on date not null default current_date,
  valid_until date not null,

  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 25 and octet_length(items::text) <= 10000),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  gst_percent numeric(4,1) not null default 0 check (gst_percent between 0 and 40),
  gst_note text not null default '' check (char_length(gst_note) <= 240),
  subtotal numeric(12,2) not null default 0,
  gst_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,

  inclusions jsonb not null default '[]' check (jsonb_typeof(inclusions) = 'array' and jsonb_array_length(inclusions) <= 30 and octet_length(inclusions::text) <= 6000),
  terms text not null default '' check (char_length(terms) <= 4000),
  payment_terms text not null default '' check (char_length(payment_terms) <= 1200),
  notes text not null default '' check (char_length(notes) <= 1500),

  prepared_by text not null default '' check (char_length(prepared_by) <= 120),
  prepared_phone text not null default '' check (char_length(prepared_phone) <= 30),
  signatory_name text not null default '' check (char_length(signatory_name) <= 120),
  signatory_designation text not null default '' check (char_length(signatory_designation) <= 200),

  sent_at timestamptz,
  responded_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint quotation_validity check (valid_until >= issued_on),
  constraint quotation_dates check (proposed_end is null or proposed_start is null or proposed_end >= proposed_start)
);
create index quotations_created on public.quotations (created_at desc);
create index quotations_enquiry on public.quotations (enquiry_id);

-- Numbering, validation of the line items and the money maths all happen here.
create or replace function public.quotation_prepare()
returns trigger language plpgsql set search_path = public as $$
declare
  it jsonb;
  v_sub numeric := 0;
  v_qty numeric;
  v_rate numeric;
begin
  if tg_op = 'INSERT' and new.quote_no is null then
    new.quote_no := 'EGR-QTN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quotation_seq')::text, 4, '0');
  end if;
  if tg_op = 'UPDATE' then new.quote_no := old.quote_no; end if;

  for it in select * from jsonb_array_elements(new.items) loop
    if jsonb_typeof(it) <> 'object' or char_length(btrim(coalesce(it ->> 'description', ''))) not between 1 and 240 then
      raise exception 'Every line needs a description (up to 240 characters)' using errcode = '22023';
    end if;
    begin
      v_qty := (it ->> 'qty')::numeric;
      v_rate := (it ->> 'rate')::numeric;
    exception when others then
      raise exception 'Quantity and rate must be numbers' using errcode = '22023';
    end;
    if v_qty is null or v_rate is null or v_qty <= 0 or v_qty > 100000 or v_rate < 0 or v_rate > 10000000 then
      raise exception 'Quantity must be above 0 and rate between 0 and 1,00,00,000' using errcode = '22023';
    end if;
    if char_length(coalesce(it ->> 'unit', '')) > 24 then
      raise exception 'Unit is too long' using errcode = '22023';
    end if;
    v_sub := v_sub + round(v_qty * v_rate, 2);
  end loop;

  if new.discount_amount > v_sub then
    raise exception 'The discount cannot be more than the subtotal' using errcode = '22023';
  end if;
  new.subtotal := v_sub;
  new.gst_amount := round((v_sub - new.discount_amount) * new.gst_percent / 100, 2);
  new.total := v_sub - new.discount_amount + new.gst_amount;
  if new.total >= 1000000000 then raise exception 'The total is too large' using errcode = '22023'; end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'sent' and new.sent_at is null then new.sent_at := now(); end if;
    if new.status in ('accepted', 'declined') then new.responded_at := now(); end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger quotations_prepare before insert or update on public.quotations
  for each row execute function public.quotation_prepare();
create trigger audit_quotations after insert or update or delete on public.quotations
  for each row execute function public.audit_row();

alter table public.quotations enable row level security;
revoke all on public.quotations from anon, authenticated;
grant select, insert, update, delete on public.quotations to authenticated;
create policy quotations_read on public.quotations for select to authenticated
  using (public.has_module_access('quotations', 'read'));
create policy quotations_insert on public.quotations for insert to authenticated
  with check (public.has_module_access('quotations', 'write'));
create policy quotations_update on public.quotations for update to authenticated
  using (public.has_module_access('quotations', 'write')) with check (public.has_module_access('quotations', 'write'));
-- only a draft can be deleted; sent quotations stay on record
create policy quotations_delete on public.quotations for delete to authenticated
  using (status = 'draft' and public.has_module_access('quotations', 'write'));

insert into public.role_module_access (role, module_key, access_level) values
  ('instructor', 'quotations', 'none'),
  ('coordinator', 'quotations', 'none')
on conflict (role, module_key) do nothing;
