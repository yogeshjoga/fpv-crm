-- One-time helper for the Org tree: registrations that came in before leads had an owner can be credited to the staff member who
-- accepted or reviewed them. Only registrations with no owner yet are touched, and only people with write access to the Org tree
-- can run it. Returns how many were credited and leaves a line in the audit log.

create or replace function public.org_credit_reviewers()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if auth.uid() is null or not public.has_module_access('org-tree', 'write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.registrations r
     set owner_id = r.reviewed_by
   where r.owner_id is null and r.reviewed_by is not null
     and exists (select 1 from public.profiles p where p.id = r.reviewed_by and p.role <> 'student');
  get diagnostics n = row_count;
  insert into public.audit_log (actor, actor_role, action, table_name, row_id, new_data)
  values (auth.uid(), (select p.role::text from public.profiles p where p.id = auth.uid()), 'CREDIT_LEADS', 'registrations', 'bulk', jsonb_build_object('credited', n));
  return n;
end $$;
revoke all on function public.org_credit_reviewers() from public, anon;
grant execute on function public.org_credit_reviewers() to authenticated;
