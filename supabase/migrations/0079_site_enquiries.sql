-- Enquiries from the public website (students, parents, colleges and universities).
--
-- Nobody on the public internet can read or write this table: the website posts to the `site-enquiry` edge
-- function, which validates the form, rate-limits it, stores the row with the service role and notifies
-- admins. Staff work the leads in the CRM (module 'enquiries'). Additive: nothing existing is changed.

create table public.site_enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text not null check (kind in ('student', 'college', 'demo', 'general')),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  email text check (email is null or (char_length(email) <= 200 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  phone text check (phone is null or char_length(phone) between 7 and 20),
  organisation text not null default '' check (char_length(organisation) <= 200),
  interest text not null default '' check (char_length(interest) <= 200),
  message text not null default '' check (char_length(message) <= 2000),
  source_page text not null default '' check (char_length(source_page) <= 200),
  consent_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 4000),
  constraint site_enquiries_has_contact check (email is not null or phone is not null)
);

create index site_enquiries_status_idx on public.site_enquiries (status, created_at desc);
create index site_enquiries_created_idx on public.site_enquiries (created_at desc);

create trigger site_enquiries_touch before update on public.site_enquiries
  for each row execute function public.set_updated_at();

-- No access for the public. Staff may read, and update only the working fields; the enquiry itself is never edited.
revoke all on public.site_enquiries from anon, authenticated;
grant select on public.site_enquiries to authenticated;
grant update (status, assigned_to, notes) on public.site_enquiries to authenticated;
grant delete on public.site_enquiries to authenticated;
alter table public.site_enquiries enable row level security;

create policy site_enquiries_read on public.site_enquiries
  for select to authenticated using (public.has_module_access('enquiries', 'read'));
create policy site_enquiries_update on public.site_enquiries
  for update to authenticated
  using (public.has_module_access('enquiries', 'write'))
  with check (public.has_module_access('enquiries', 'write'));
create policy site_enquiries_delete on public.site_enquiries
  for delete to authenticated using (public.has_module_access('enquiries', 'write'));

-- Leads carry phone numbers and emails, so by default only admins see them. A super admin can change this
-- per role in Company Settings.
insert into public.role_module_access (role, module_key, access_level) values
  ('instructor', 'enquiries', 'none'),
  ('coordinator', 'enquiries', 'none'),
  ('admin', 'enquiries', 'write')
on conflict (role, module_key) do nothing;
