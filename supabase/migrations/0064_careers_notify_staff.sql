-- When a position opens, tell the staff (employees) as well as the students. Staff cannot apply, so their
-- notification is for information and links to the position in the admin area when their role can open Careers.

create or replace function public.careers_notify_job()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_link text := '/app/careers/' || new.slug;
  v_admin_link text := '/admin/careers/' || new.id;
  v_label text := case new.kind when 'internship' then 'Internship' when 'full_time' then 'Full-time job' when 'part_time' then 'Part-time job' else 'Contract role' end;
  v_body text;
begin
  if new.status <> 'open' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'open'
     and new.apply_starts_at is not distinct from old.apply_starts_at
     and new.apply_ends_at is not distinct from old.apply_ends_at then
    return new;
  end if;

  v_body := case when new.apply_starts_at is not null and new.apply_starts_at > now()
                 then 'Applications open ' || public.careers_ist(new.apply_starts_at)
                 else 'Applications are open' end
         || case when new.apply_ends_at is not null then ' · close ' || public.careers_ist(new.apply_ends_at) else '' end;

  delete from public.notifications where kind = 'careers_job' and link in (v_link, v_admin_link) and read_at is null;

  insert into public.notifications (recipient_id, title, body, kind, link)
  select p.id, v_label || ': ' || new.title, v_body || '. Open Careers to read the details and apply.', 'careers_job', v_link
    from public.profiles p
   where p.role = 'student' and p.status = 'active' and p.archived_at is null;

  insert into public.notifications (recipient_id, title, body, kind, link)
  select p.id, 'New position open: ' || new.title, v_label || '. ' || v_body || '. Tell people who may be interested.', 'careers_job',
         case when p.role::text = 'super_admin' or coalesce((select m.access_level from public.role_module_access m where m.module_key = 'careers' and m.role = p.role::text), 'read') <> 'none'
              then v_admin_link end
    from public.profiles p
   where p.role::text <> 'student' and p.status = 'active' and p.archived_at is null
     and p.id is distinct from auth.uid();
  return new;
end;
$$;
revoke all on function public.careers_notify_job() from public, anon, authenticated;
