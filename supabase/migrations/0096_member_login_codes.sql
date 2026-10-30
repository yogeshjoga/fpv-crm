-- One-time email codes for signing in on the public website (member-otp-send / member-otp-verify).
-- Service-role only: RLS is on with no policies on purpose, so no client can read or write a code. Only a keyed hash of the
-- code is stored, never the code itself.
create table if not exists public.member_login_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists member_login_codes_email_idx on public.member_login_codes (email, created_at desc);
alter table public.member_login_codes enable row level security;
comment on table public.member_login_codes is 'Service-role only. RLS enabled with no policies is intentional - never client-accessible.';
