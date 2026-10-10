-- Trusted devices: after someone passes the two-step code on a computer they can choose "don't ask again on this device".
-- Like Google, that computer then signs in with the password alone for up to 30 days of use (180 days at most), and any
-- other computer still needs the code.
--
-- How it works without weakening the database rule: the server hands the browser a secret device token (kept in an HttpOnly
-- cookie, so page scripts cannot read it). When the same browser signs in again with the password, the token is presented once
-- and that one session is marked trusted. mfa_ok() then accepts a trusted session in place of the code, in every database
-- policy, in storage and in the edge functions. A password alone, from any other device, is still stopped.

create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text not null default '' check (char_length(label) <= 120),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index trusted_devices_user on public.trusted_devices (user_id);

create table public.trusted_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.trusted_devices(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index trusted_sessions_user on public.trusted_sessions (user_id);

alter table public.trusted_devices enable row level security;
alter table public.trusted_sessions enable row level security;
-- a person may list their own devices (never the token); everything else goes through the functions below
create policy trusted_devices_own_read on public.trusted_devices for select using (user_id = auth.uid());
revoke all on public.trusted_devices from anon, authenticated;
grant select (id, label, created_at, last_used_at, expires_at) on public.trusted_devices to authenticated;
revoke all on public.trusted_sessions from anon, authenticated;

create or replace function public.jwt_session_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

-- is THIS session one that was let in on a trusted device?
create or replace function public.session_is_trusted()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trusted_sessions s
     where s.session_id = public.jwt_session_id() and s.user_id = auth.uid() and s.expires_at > now()
  );
$$;
revoke all on function public.session_is_trusted() from public, anon;
grant execute on function public.session_is_trusted() to authenticated;

-- the two-step rule: a code this session, no code needed (not turned on), or a trusted session
create or replace function public.mfa_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
      or public.session_is_trusted();
$$;

-- for edge functions (service role)
create or replace function public.trusted_session_valid(p_uid uuid, p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trusted_sessions s where s.session_id = p_session and s.user_id = p_uid and s.expires_at > now());
$$;
revoke all on function public.trusted_session_valid(uuid, uuid) from public, anon, authenticated;
grant execute on function public.trusted_session_valid(uuid, uuid) to service_role;

-- Called right after the code was entered (the session is aal2). Returns the secret device token, once.
create or replace function public.trust_this_device(p_label text default '')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_device uuid;
  v_exp timestamptz := now() + interval '30 days';
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Enter your two-step code first' using errcode = '42501';
  end if;
  delete from public.trusted_devices where user_id = v_uid and (expires_at < now() or created_at < now() - interval '180 days');
  -- keep the ten most recent devices
  delete from public.trusted_devices d where d.user_id = v_uid and d.id in (
    select id from public.trusted_devices where user_id = v_uid order by last_used_at desc offset 9);
  insert into public.trusted_devices (user_id, token_hash, label, expires_at)
    values (v_uid, encode(sha256(convert_to(v_token, 'utf8')), 'hex'), left(coalesce(p_label, ''), 120), v_exp)
    returning id into v_device;
  if public.jwt_session_id() is not null then
    insert into public.trusted_sessions (session_id, user_id, device_id, expires_at)
      values (public.jwt_session_id(), v_uid, v_device, v_exp)
      on conflict (session_id) do update set device_id = excluded.device_id, expires_at = excluded.expires_at;
  end if;
  insert into public.audit_log (actor, actor_role, action, table_name, row_id, new_data)
    values (v_uid, (select p.role::text from public.profiles p where p.id = v_uid), 'TRUST_DEVICE', 'trusted_devices', v_device::text, jsonb_build_object('label', left(coalesce(p_label, ''), 120)));
  return v_token;
end $$;
revoke all on function public.trust_this_device(text) from public, anon;
grant execute on function public.trust_this_device(text) to authenticated;

-- Called after a password sign-in on a browser that holds a device token: marks this session trusted when the token is good.
create or replace function public.trust_session(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_dev public.trusted_devices;
  v_exp timestamptz;
begin
  if v_uid is null or public.jwt_session_id() is null or coalesce(p_token, '') = '' then return false; end if;
  select * into v_dev from public.trusted_devices d
   where d.user_id = v_uid and d.token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
     and d.expires_at > now() and d.created_at > now() - interval '180 days';
  if not found then return false; end if;
  -- slides forward with use: 30 days from now, but never past 180 days after the device was first trusted
  v_exp := least(now() + interval '30 days', v_dev.created_at + interval '180 days');
  update public.trusted_devices set last_used_at = now(), expires_at = v_exp where id = v_dev.id;
  insert into public.trusted_sessions (session_id, user_id, device_id, expires_at)
    values (public.jwt_session_id(), v_uid, v_dev.id, v_exp)
    on conflict (session_id) do update set device_id = excluded.device_id, expires_at = excluded.expires_at;
  delete from public.trusted_sessions where user_id = v_uid and expires_at < now();
  return true;
end $$;
revoke all on function public.trust_session(text) from public, anon;
grant execute on function public.trust_session(text) to authenticated;

create or replace function public.revoke_trusted_device(p_id uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  delete from public.trusted_devices where user_id = auth.uid() and (p_id is null or id = p_id);
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.audit_log (actor, actor_role, action, table_name, row_id, new_data)
      values (auth.uid(), (select p.role::text from public.profiles p where p.id = auth.uid()), 'REVOKE_DEVICE', 'trusted_devices', coalesce(p_id::text, 'all'), jsonb_build_object('removed', n));
  end if;
  return n;
end $$;
revoke all on function public.revoke_trusted_device(uuid) from public, anon;
grant execute on function public.revoke_trusted_device(uuid) to authenticated;
