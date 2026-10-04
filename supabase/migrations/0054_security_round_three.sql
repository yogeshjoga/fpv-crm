-- Security round three.

-- 1) Section permissions enforced in the database, not just hidden in the UI. A role's access level
--    for a section comes from role_module_access (missing row = 'read', like the app). Super admins
--    always pass; non-staff never do.
create or replace function public.has_module_access(p_key text, p_level text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_super_admin() then true
    when not public.is_staff() then false
    else coalesce(
      (select case m.access_level
                when 'write' then true
                when 'read' then p_level = 'read'
                else false
              end
         from public.role_module_access m
        where m.module_key = p_key
          and m.role = (select p.role::text from public.profiles p where p.id = auth.uid())),
      p_level = 'read')
  end;
$$;
revoke all on function public.has_module_access(text, text) from public, anon;
grant execute on function public.has_module_access(text, text) to authenticated;

-- certificates: only roles with Write on Certificates can revoke / edit
alter policy certificates_update_staff on public.certificates
  using (public.has_module_access('certificates', 'write'))
  with check (public.has_module_access('certificates', 'write'));
alter policy certificates_select on public.certificates
  using (student_id = auth.uid() or public.has_module_access('certificates', 'read'));

-- registrations
alter policy registrations_select_staff on public.registrations using (public.has_module_access('registrations', 'read'));
alter policy registrations_update_staff on public.registrations
  using (public.has_module_access('registrations', 'write'))
  with check (public.has_module_access('registrations', 'write'));

-- exam marks (Exams section)
drop policy assessment_marks_staff on public.assessment_marks;
create policy assessment_marks_staff_read on public.assessment_marks for select using (public.has_module_access('exams', 'read'));
create policy assessment_marks_staff_insert on public.assessment_marks for insert with check (public.has_module_access('exams', 'write'));
create policy assessment_marks_staff_update on public.assessment_marks for update
  using (public.has_module_access('exams', 'write')) with check (public.has_module_access('exams', 'write'));
create policy assessment_marks_staff_delete on public.assessment_marks for delete using (public.has_module_access('exams', 'write'));

-- reviews: a role set to None cannot read them at all (this is what really hides reviewer identity
-- from a role); deleting / deciding edit requests needs Write on Reviews.
alter policy reviews_staff_read on public.reviews using (public.has_module_access('reviews', 'read'));
alter policy reviews_staff_delete on public.reviews using (public.has_module_access('reviews', 'write'));
alter policy review_edit_requests_staff_read on public.review_edit_requests using (public.has_module_access('reviews', 'read'));
alter policy review_edit_requests_staff_decide on public.review_edit_requests
  using (public.has_module_access('reviews', 'write') and status = any (array['pending', 'approved']))
  with check (public.has_module_access('reviews', 'write') and status = any (array['approved', 'denied']));

-- 2) The name on a certificate is fixed when it is issued. The verify page used to read the live
--    profile name, which a student can edit.
alter table public.certificates add column if not exists student_name text;
update public.certificates c set student_name = p.full_name from public.profiles p where p.id = c.student_id and c.student_name is null;

create or replace function public.snapshot_certificate_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.student_name is null or btrim(new.student_name) = '' then
    select full_name into new.student_name from public.profiles where id = new.student_id;
  end if;
  return new;
end;
$$;
revoke all on function public.snapshot_certificate_name() from public, anon, authenticated;
drop trigger if exists certificates_snapshot_name on public.certificates;
create trigger certificates_snapshot_name before insert on public.certificates
  for each row execute function public.snapshot_certificate_name();

-- 3) Verify lookups are rate limited per caller address (the lookup itself stays public).
create table if not exists public.verify_attempts (
  id bigint generated always as identity primary key,
  caller text not null,
  at timestamptz not null default now()
);
create index if not exists verify_attempts_caller_at on public.verify_attempts (caller, at desc);
alter table public.verify_attempts enable row level security;

drop function if exists public.verify_certificate(text);
create function public.verify_certificate(p_cert_id text)
returns table (
  valid               boolean,
  student_name        text,
  course_title        text,
  cert_type           text,
  issued_at           timestamptz,
  score_pct           numeric,
  revoked             boolean,
  cert_id_string      text,
  org_name            text,
  verify_base_url     text,
  cert_background_url text,
  signatory_image_url text,
  company_seal_url    text,
  report_total        numeric,
  report_max          numeric
)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_caller text;
begin
  begin
    v_caller := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', 'unknown'), ',', 1);
  exception when others then
    v_caller := 'unknown';
  end;
  delete from public.verify_attempts where at < now() - interval '1 hour';
  if (select count(*) from public.verify_attempts where caller = v_caller and at > now() - interval '1 minute') >= 20 then
    return;
  end if;
  insert into public.verify_attempts (caller) values (v_caller);

  return query
  select
    (c.id is not null and not c.revoked),
    coalesce(c.student_name, p.full_name),
    co.title,
    coalesce(c.cert_type, co.cert_type),
    c.issued_at,
    c.score_pct,
    coalesce(c.revoked, false),
    c.cert_id_string,
    (select o.org_name from public.org_settings o limit 1),
    (select o.verify_base_url from public.org_settings o limit 1),
    (select o.cert_background_url from public.org_settings o limit 1),
    (select o.signatory_image_url from public.org_settings o limit 1),
    (select o.company_seal_url from public.org_settings o limit 1),
    (c.report->>'total')::numeric,
    (c.report->>'max')::numeric
  from public.certificates c
  join public.profiles p on p.id = c.student_id
  join public.courses  co on co.id = c.course_id
  where upper(c.cert_id_string) = upper(p_cert_id);
end;
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- 4) Profile photos must live in our own avatars bucket (or come from Google sign-in). The server
--    downloads this URL when it prints an ID card, so an arbitrary address was a server-side
--    request forgery vector; it also leaked staff IP addresses to whoever hosted the image.
create or replace function public.safe_avatar_url(p_url text)
returns boolean language sql immutable as $$
  select p_url is null
      or p_url like 'https://txbrnewcztixcagdnnfx.supabase.co/storage/v1/object/public/avatars/%'
      or p_url like 'https://lh3.googleusercontent.com/%';
$$;

create or replace function public.guard_avatar_url()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.safe_avatar_url(new.avatar_url) then
    if tg_op = 'INSERT' or auth.uid() is null then
      new.avatar_url := null;
    else
      raise exception 'Profile photos must be uploaded through the app.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_avatar_url() from public, anon, authenticated;
drop trigger if exists profiles_guard_avatar on public.profiles;
create trigger profiles_guard_avatar before insert or update of avatar_url on public.profiles
  for each row execute function public.guard_avatar_url();

-- 5) Library files follow the resource's audience: a student can read a file only if its resource
--    row is visible to them (group-restricted resources stay restricted at the file level too).
alter policy "library active read" on storage.objects using (
  bucket_id = 'library' and is_active_user() and (
    is_staff() or (
      public.exam_lock_until() is null
      and exists (select 1 from public.resources r where r.file_path = objects.name)
    )
  )
);

-- 6) Support threads: a student can only change their own thread's status; the owner, subject and
--    timestamps are pinned. A suspended account can't open new threads.
create or replace function public.guard_support_thread()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;
  new.student_id := old.student_id;
  new.subject := old.subject;
  new.created_at := old.created_at;
  return new;
end;
$$;
revoke all on function public.guard_support_thread() from public, anon, authenticated;
drop trigger if exists support_threads_guard on public.support_threads;
create trigger support_threads_guard before update on public.support_threads
  for each row execute function public.guard_support_thread();

alter policy support_threads_insert on public.support_threads with check (student_id = auth.uid() and public.is_active_user());
