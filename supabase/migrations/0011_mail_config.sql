-- Server-only mail transport config. RLS on, NO policies => only the service role
-- (edge functions) can read/write it. Never exposed to the client API.
create table if not exists public.mail_config (
  id           boolean primary key default true,
  smtp_host    text,
  smtp_port    integer not null default 465,
  smtp_user    text,
  smtp_pass    text,
  smtp_tls     boolean not null default true,
  mail_from    text,
  mail_reply_to text,
  updated_at   timestamptz not null default now(),
  constraint mail_config_singleton check (id)
);
alter table public.mail_config enable row level security;
revoke all on public.mail_config from anon, authenticated;
insert into public.mail_config (id) values (true) on conflict (id) do nothing;
