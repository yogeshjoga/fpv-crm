-- A second, explicit way through the sign-up guard.
--
-- guard_new_auth_user (0066) lets an email sign-up through only when app_metadata.provisioned = true. In practice GoTrue writes the
-- user row before it applies app_metadata passed to admin.createUser, so the guard sees no flag and refuses even our own functions.
-- This adds a short-lived, service-only allow-list: a function that is about to create a user for an address writes that address
-- here first, and the guard lets exactly that insert through (and removes the row). Nobody can write this table except the service
-- role, so public sign-ups stay closed. Google sign-in is untouched.
create table if not exists public.signup_allowlist (
  email text primary key check (email = lower(email) and char_length(email) <= 254),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.signup_allowlist enable row level security;
comment on table public.signup_allowlist is 'Service-role only. RLS enabled with no policies is intentional - never client-accessible.';

create or replace function public.guard_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email'
     and coalesce(new.raw_app_meta_data ->> 'provisioned', '') <> 'true' then
    if exists (select 1 from public.signup_allowlist a where a.email = lower(new.email) and a.expires_at > now()) then
      delete from public.signup_allowlist where email = lower(new.email);
    else
      raise exception 'Sign-ups are closed. Register through the registration form and an admin will create your account.' using errcode = 'P0001';
    end if;
  end if;
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'role' - 'status';
  return new;
end $$;
revoke all on function public.guard_new_auth_user() from public, anon, authenticated;
