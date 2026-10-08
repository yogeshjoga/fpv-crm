-- Security hardening (OWASP review).
--  1. staff checks now also require an ACTIVE, non-archived account (a suspended admin lost nothing before) and,
--     for anyone who has turned on two-step verification, a session that passed it (aal2).
--  2. nobody can remove, demote or suspend the last active super admin.
--  3. an append-only audit log of privileged changes (roles, access matrix, company settings, staff details, certificate revocation).
--  4. lesson links must be http(s) (or an in-app path for embeds).
--  5. function search paths pinned.

-- ───────── two-step verification helpers ─────────
create or replace function public.mfa_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated, service_role;

-- for edge functions (service role): has this user turned two-step verification on?
create or replace function public.user_has_mfa(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.mfa_factors f where f.user_id = p_uid and f.status = 'verified');
$$;
revoke all on function public.user_has_mfa(uuid) from public, anon, authenticated;
grant execute on function public.user_has_mfa(uuid) to service_role;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.role in ('instructor', 'coordinator', 'admin', 'super_admin') and p.status = 'active' and p.archived_at is null
       from public.profiles p where p.id = auth.uid()),
    false) and public.mfa_ok();
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.role = 'super_admin' and p.status = 'active' and p.archived_at is null
       from public.profiles p where p.id = auth.uid()),
    false) and public.mfa_ok();
$$;

-- ───────── the last super admin cannot be removed ─────────
create or replace function public.guard_last_super_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old public.profiles := old;
begin
  if v_old.role = 'super_admin' and v_old.status = 'active' and v_old.archived_at is null
     and (tg_op = 'DELETE' or new.role <> 'super_admin' or new.status <> 'active' or new.archived_at is not null)
     and not exists (select 1 from public.profiles p where p.role = 'super_admin' and p.status = 'active' and p.archived_at is null and p.id <> v_old.id) then
    raise exception 'The last active super admin cannot be removed, demoted or suspended.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.guard_last_super_admin() from public, anon, authenticated;
create trigger trg_profiles_guard_last_super before update of role, status, archived_at or delete on public.profiles
  for each row execute function public.guard_last_super_admin();

-- ───────── audit log (append-only, super admin can read) ─────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_role text,
  action text not null,
  table_name text not null,
  row_id text,
  old_data jsonb,
  new_data jsonb
);
create index audit_log_at on public.audit_log (at desc);
create index audit_log_table on public.audit_log (table_name, at desc);
alter table public.audit_log enable row level security;
create policy audit_log_read on public.audit_log for select using (public.is_super_admin());
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create or replace function public.audit_log_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'The audit log cannot be changed or deleted.';
end $$;
create trigger audit_log_no_change before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_log_immutable();

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_src jsonb := coalesce(v_new, v_old);
  v_o jsonb := '{}'::jsonb;
  v_n jsonb := '{}'::jsonb;
  k text;
  v_id text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if k in ('updated_at', 'last_seen_at') then continue; end if;
      if (v_new -> k) is distinct from (v_old -> k) then
        v_o := v_o || jsonb_build_object(k, case when k ~* '(secret|password|token|key)' then '"[redacted]"'::jsonb else v_old -> k end);
        v_n := v_n || jsonb_build_object(k, case when k ~* '(secret|password|token|key)' then '"[redacted]"'::jsonb else v_new -> k end);
      end if;
    end loop;
    if v_n = '{}'::jsonb then return new; end if;
  else
    for k in select jsonb_object_keys(v_src) loop
      if tg_op = 'DELETE' then v_o := v_o || jsonb_build_object(k, case when k ~* '(secret|password|token|key)' then '"[redacted]"'::jsonb else v_old -> k end);
      else v_n := v_n || jsonb_build_object(k, case when k ~* '(secret|password|token|key)' then '"[redacted]"'::jsonb else v_new -> k end);
      end if;
    end loop;
  end if;
  v_id := coalesce(v_src ->> 'id', v_src ->> 'profile_id', (v_src ->> 'role') || ':' || (v_src ->> 'module_key'));
  insert into public.audit_log (actor, actor_role, action, table_name, row_id, old_data, new_data)
  values (auth.uid(), (select p.role::text from public.profiles p where p.id = auth.uid()), tg_op, tg_table_name, v_id,
          nullif(v_o, '{}'::jsonb), nullif(v_n, '{}'::jsonb));
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.audit_row() from public, anon, authenticated;

create trigger audit_profiles_update after update of role, status, archived_at, email on public.profiles
  for each row execute function public.audit_row();
create trigger audit_profiles_delete after delete on public.profiles
  for each row execute function public.audit_row();
create trigger audit_role_module_access after insert or update or delete on public.role_module_access
  for each row execute function public.audit_row();
create trigger audit_org_settings after update on public.org_settings
  for each row execute function public.audit_row();
create trigger audit_staff_details after insert or update or delete on public.staff_details
  for each row execute function public.audit_row();
create trigger audit_certificates_revoke after update of revoked, revoked_reason on public.certificates
  for each row execute function public.audit_row();

-- ───────── lesson links must be web links ─────────
alter table public.lessons add constraint lessons_video_url_scheme check (video_url is null or video_url ~* '^https?://');
alter table public.lessons add constraint lessons_embed_url_scheme check (embed_url is null or embed_url ~* '^(https?://|/)');

-- ───────── pin function search paths ─────────
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname in ('safe_avatar_url', 'careers_ist', 'careers_touch_job') loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;
