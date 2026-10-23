-- AI-agent access (MCP). A super admin issues named keys; an agent presents one to the `mcp` edge function.
--
-- Safety model (see .claude/skills/fpv-crm-security-guidelines):
--  * only a super admin who has passed two-step verification can issue or revoke a key
--  * the secret is shown once and only its SHA-256 hash is stored, so a database leak does not leak keys
--  * every key has a name, an expiry (at most one year) and explicit scopes:
--      read  - non-sensitive CRM data         pii   - emails, phones, free-text answers, pay
--      audit - the audit log                  write - a small set of reviewed write tools
--    a key with only `read` sees masked contact details and cannot search by email or phone
--  * every call is recorded in mcp_call_log (tool, key, outcome, row count), never the returned data
--  * keys, hashes and the log are closed to everyone except the service role and, for reading, super admins

create table public.mcp_agent_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['read']::text[],
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count bigint not null default 0,
  constraint mcp_scopes_valid check (scopes <@ array['read','pii','audit','write']::text[] and cardinality(scopes) between 1 and 4),
  constraint mcp_expiry_bound check (expires_at <= created_at + interval '366 days')
);

create table public.mcp_call_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  key_id uuid references public.mcp_agent_keys(id) on delete set null,
  tool text not null,
  ok boolean not null,
  rows_returned integer,
  detail text
);
create index mcp_call_log_at on public.mcp_call_log (at desc);

alter table public.mcp_agent_keys enable row level security;
alter table public.mcp_call_log enable row level security;

revoke all on public.mcp_agent_keys from anon, authenticated;
revoke all on public.mcp_call_log from anon, authenticated;
-- super admins may list keys (never the hash) and read the call log
create policy mcp_keys_super_read on public.mcp_agent_keys for select using (public.is_super_admin() and public.mfa_ok());
create policy mcp_log_super_read on public.mcp_call_log for select using (public.is_super_admin() and public.mfa_ok());
grant select (id, name, key_prefix, scopes, created_by, created_at, expires_at, revoked_at, last_used_at, use_count) on public.mcp_agent_keys to authenticated;
grant select on public.mcp_call_log to authenticated;

-- Issue a key. Returns the secret once; it cannot be read again.
create or replace function public.create_mcp_key(p_name text, p_scopes text[], p_days integer default 90)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_secret text := 'egrmcp_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id uuid;
  v_days integer := least(greatest(coalesce(p_days, 90), 1), 365);
begin
  if v_uid is null or not public.is_super_admin() or not public.mfa_ok() then
    raise exception 'Only a verified super admin can issue agent keys' using errcode = '42501';
  end if;
  if p_scopes is null or cardinality(p_scopes) = 0 or not (p_scopes <@ array['read','pii','audit','write']::text[]) then
    raise exception 'Scopes must be chosen from read, pii, audit, write' using errcode = '22023';
  end if;
  if (select count(*) from public.mcp_agent_keys where revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'Ten keys are active already. Revoke one first.' using errcode = '22023';
  end if;
  insert into public.mcp_agent_keys (name, key_prefix, key_hash, scopes, created_by, expires_at)
  values (btrim(p_name), left(v_secret, 14), encode(sha256(convert_to(v_secret, 'utf8')), 'hex'),
          (select array_agg(distinct s order by s) from unnest(p_scopes || array['read']) s), v_uid, now() + make_interval(days => v_days))
  returning id into v_id;
  insert into public.audit_log (actor, actor_role, action, table_name, row_id, new_data)
  values (v_uid, 'super_admin', 'CREATE_MCP_KEY', 'mcp_agent_keys', v_id::text,
          jsonb_build_object('name', btrim(p_name), 'scopes', p_scopes, 'days', v_days));
  return v_secret;
end $$;
revoke all on function public.create_mcp_key(text, text[], integer) from public, anon;
grant execute on function public.create_mcp_key(text, text[], integer) to authenticated;

create or replace function public.revoke_mcp_key(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_super_admin() or not public.mfa_ok() then
    raise exception 'Only a verified super admin can revoke agent keys' using errcode = '42501';
  end if;
  update public.mcp_agent_keys set revoked_at = now() where id = p_id and revoked_at is null;
  if not found then return false; end if;
  insert into public.audit_log (actor, actor_role, action, table_name, row_id)
  values (auth.uid(), 'super_admin', 'REVOKE_MCP_KEY', 'mcp_agent_keys', p_id::text);
  return true;
end $$;
revoke all on function public.revoke_mcp_key(uuid) from public, anon;
grant execute on function public.revoke_mcp_key(uuid) to authenticated;

-- Service role only: look a presented key up by hash. Returns nothing for unknown, revoked or expired keys.
create or replace function public.mcp_authenticate(p_hash text)
returns table (id uuid, name text, scopes text[]) language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.mcp_agent_keys k
     set last_used_at = now(), use_count = k.use_count + 1
   where k.key_hash = p_hash and k.revoked_at is null and k.expires_at > now()
  returning k.id, k.name, k.scopes;
end $$;
revoke all on function public.mcp_authenticate(text) from public, anon, authenticated;
grant execute on function public.mcp_authenticate(text) to service_role;

-- Service role only: append a line to the call log and prune old ones.
create or replace function public.mcp_log_call(p_key uuid, p_tool text, p_ok boolean, p_rows integer, p_detail text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.mcp_call_log (key_id, tool, ok, rows_returned, detail)
  values (p_key, left(coalesce(p_tool, ''), 80), p_ok, p_rows, left(p_detail, 300));
  if random() < 0.02 then delete from public.mcp_call_log where at < now() - interval '90 days'; end if;
end $$;
revoke all on function public.mcp_log_call(uuid, text, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.mcp_log_call(uuid, text, boolean, integer, text) to service_role;
