-- Website members stay in the Academy. They reach the CRM only when they ask for it on purpose and an admin accepts them.
--  1. A person who signs up on the website (Google or an emailed code) is a website MEMBER from the first moment, never a CRM student,
--     so they do not turn up in the CRM's account approvals until they ask.
--  2. member_request_crm_access(): the one thing a member can do to ask for the CRM. It records the request and tells the admins.
--     The existing rules still decide who gets in: a member must be marked paid and accepted (status = 'active') by an admin.

alter table public.profiles add column if not exists crm_requested_at timestamptz;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  v_source text := coalesce(new.raw_app_meta_data ->> 'source', '');
  v_member boolean := v_provider = 'google' or v_source = 'email_otp';
begin
  insert into public.profiles (id, email, full_name, avatar_url, account_kind, signup_source)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    case when v_member then 'member' else 'student' end,
    case when v_provider = 'google' then 'google' when v_source = 'email_otp' then 'email_otp' else 'crm' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.member_request_crm_access()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  p public.profiles%rowtype;
  v_paid boolean;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into p from public.profiles where id = v_uid;
  if not found then raise exception 'Your account is not ready yet. Please try again.' using errcode = 'P0002'; end if;
  if p.account_kind <> 'member' then raise exception 'This account already belongs to the CRM.' using errcode = '22023'; end if;
  if p.status = 'active' then return jsonb_build_object('state', 'approved'); end if;
  if p.status = 'suspended' then raise exception 'This account cannot ask for CRM access. Please contact us.' using errcode = '42501'; end if;
  if p.crm_requested_at is not null then return jsonb_build_object('state', 'requested'); end if;

  v_paid := p.paid_member or public.compute_is_paid(v_uid);
  update public.profiles set crm_requested_at = now() where id = v_uid;
  insert into public.notifications (recipient_id, title, body, kind, link)
  select a.id,
         'CRM access request',
         coalesce(nullif(p.full_name, ''), p.email) || ' (' || coalesce(nullif(p.college_name, ''), 'no college given') || ') asked for CRM access. '
           || case when v_paid then 'They are marked as paid: open Members and accept them for the CRM.'
                   else 'They are not marked as paid yet: mark them as paid in Members first, then accept them.' end,
         'crm_request',
         '/admin/members'
    from public.profiles a
   where a.role in ('admin', 'super_admin') and a.status = 'active' and a.archived_at is null;
  return jsonb_build_object('state', 'requested');
end $$;

revoke all on function public.member_request_crm_access() from public, anon;
grant execute on function public.member_request_crm_access() to authenticated;

-- sign-ups that already came in through Google or a code but were filed as CRM students, and never opened the Academy
update public.profiles p
   set account_kind = 'member', signup_source = 'google'
  from auth.users u
 where u.id = p.id
   and u.raw_app_meta_data ->> 'provider' = 'google'
   and p.account_kind = 'student' and p.signup_source = 'crm' and p.status = 'pending' and p.role = 'student'
   and not exists (select 1 from public.enrollments e where e.student_id = p.id)
   and not exists (select 1 from public.course_group_members m where m.student_id = p.id);
