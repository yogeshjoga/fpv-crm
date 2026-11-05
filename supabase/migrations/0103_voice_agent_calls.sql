-- Conversations held by the EGIRE Robotics voice agent (website "Talk to us" widget and outbound phone calls).
--
-- Nobody on the public internet can read or write this table: the voice-agent server (E:\EgireRobotics_voice_agent)
-- writes each finished conversation with the service role. Staff work the leads in the CRM (module 'voice-agent').
-- Additive: nothing existing is changed.

create table public.voice_agent_calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  channel text not null check (channel in ('web', 'phone')),
  call_id text not null default '' check (char_length(call_id) <= 120),
  started_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  language text not null default '' check (char_length(language) <= 10),
  lead_name text not null default '' check (char_length(lead_name) <= 120),
  phone text not null default '' check (char_length(phone) <= 20),
  city text not null default '' check (char_length(city) <= 120),
  institution text not null default '' check (char_length(institution) <= 200),
  audience_type text not null default '' check (char_length(audience_type) <= 40),
  interest_level text not null default '' check (interest_level in ('', 'hot', 'warm', 'cold', 'not_interested')),
  program text not null default '' check (char_length(program) <= 200),
  next_step text not null default '' check (char_length(next_step) <= 40),
  callback_time text not null default '' check (char_length(callback_time) <= 120),
  summary text not null default '' check (char_length(summary) <= 2000),
  whatsapp_offered boolean not null default false,
  source_page text not null default '' check (char_length(source_page) <= 200),
  voice text not null default '' check (voice in ('', 'priya', 'founder')),
  transcript jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 4000)
);

create index voice_agent_calls_created_idx on public.voice_agent_calls (created_at desc);
create index voice_agent_calls_status_idx on public.voice_agent_calls (status, created_at desc);
create index voice_agent_calls_interest_idx on public.voice_agent_calls (interest_level, created_at desc);

create trigger voice_agent_calls_touch before update on public.voice_agent_calls
  for each row execute function public.set_updated_at();

-- No access for the public. Staff may read, and update only the working fields; the conversation is never edited.
revoke all on public.voice_agent_calls from anon, authenticated;
grant select on public.voice_agent_calls to authenticated;
grant update (status, assigned_to, notes) on public.voice_agent_calls to authenticated;
grant delete on public.voice_agent_calls to authenticated;
alter table public.voice_agent_calls enable row level security;

create policy voice_agent_calls_read on public.voice_agent_calls
  for select to authenticated using (public.has_module_access('voice-agent', 'read'));
create policy voice_agent_calls_update on public.voice_agent_calls
  for update to authenticated
  using (public.has_module_access('voice-agent', 'write'))
  with check (public.has_module_access('voice-agent', 'write'));
create policy voice_agent_calls_delete on public.voice_agent_calls
  for delete to authenticated using (public.has_module_access('voice-agent', 'write'));

-- Conversations carry phone numbers, so by default only admins see them. A super admin can change this per role
-- in Company Settings.
insert into public.role_module_access (role, module_key, access_level) values
  ('instructor', 'voice-agent', 'none'),
  ('coordinator', 'voice-agent', 'none'),
  ('admin', 'voice-agent', 'write')
on conflict (role, module_key) do nothing;

-- One switch for the voice agent: whether visitors may pick Yogesh's cloned voice. The website and the agent read it
-- (it is not secret, so anyone may read it); only staff with write access to 'voice-agent' may change it.
create table public.voice_agent_settings (
  id smallint primary key default 1 check (id = 1),
  founder_voice_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.voice_agent_settings (id) values (1) on conflict (id) do nothing;

create trigger voice_agent_settings_touch before update on public.voice_agent_settings
  for each row execute function public.set_updated_at();

revoke all on public.voice_agent_settings from anon, authenticated;
grant select on public.voice_agent_settings to anon, authenticated;
grant update (founder_voice_enabled, updated_by) on public.voice_agent_settings to authenticated;
alter table public.voice_agent_settings enable row level security;

create policy voice_agent_settings_read on public.voice_agent_settings
  for select to anon, authenticated using (true);
create policy voice_agent_settings_update on public.voice_agent_settings
  for update to authenticated
  using (public.has_module_access('voice-agent', 'write'))
  with check (public.has_module_access('voice-agent', 'write'));
