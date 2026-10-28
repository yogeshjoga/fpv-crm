-- Organisation tree: who reports to whom, as an editable chart, and lead / admission performance for each person.
-- Several charts are allowed (the company, a marketing team, a custom structure). A person node points at a staff
-- account, so their leads can be counted; a group node is a team or a role label and shows its team's total.
--
-- "Leads" are admissions: website enquiries (assigned_to) and registrations (owner_id, new here). A lead is open while it is
-- waiting, won when it becomes an admission, lost when it is dropped or rejected.
--
-- Safety (see .claude/skills/fpv-crm-security-guidelines):
--  * module 'org-tree': staff read/write through has_module_access; instructors and coordinators start with no access,
--    because it shows everyone's performance and fees collected
--  * the numbers come from one SECURITY DEFINER function that checks the module itself and returns totals only
--  * the database refuses loops, cross-chart managers, runaway depth and oversized charts; changes are audited

alter table public.registrations add column owner_id uuid references public.profiles(id) on delete set null;
create index registrations_owner on public.registrations (owner_id) where owner_id is not null;

create table public.org_charts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_nodes (
  id uuid primary key default gen_random_uuid(),
  chart_id uuid not null references public.org_charts(id) on delete cascade,
  parent_id uuid references public.org_nodes(id) on delete set null,
  kind text not null default 'person' check (kind in ('person', 'group')),
  profile_id uuid references public.profiles(id) on delete set null,
  label text not null default '' check (char_length(label) <= 80),
  title text not null default '' check (char_length(title) <= 120),
  image_url text check (image_url is null or (char_length(image_url) <= 500 and image_url ~ '^https://')),
  note text not null default '' check (char_length(note) <= 400),
  accent text not null default 'slate' check (accent in ('slate', 'blue', 'green', 'amber', 'rose', 'violet')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_node_named check (profile_id is not null or char_length(btrim(label)) > 0)
);
create index org_nodes_chart on public.org_nodes (chart_id);
create index org_nodes_parent on public.org_nodes (parent_id);
create unique index org_nodes_one_person_per_chart on public.org_nodes (chart_id, profile_id) where profile_id is not null;

create or replace function public.org_nodes_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  cur uuid;
  depth integer := 0;
begin
  if tg_op = 'UPDATE' then new.chart_id := old.chart_id; end if; -- a node never moves to another chart
  if tg_op = 'INSERT' and (select count(*) from public.org_nodes where chart_id = new.chart_id) >= 300 then
    raise exception 'A chart can hold at most 300 people' using errcode = '22023';
  end if;
  if new.parent_id is not null then
    if new.parent_id = new.id then raise exception 'A person cannot report to themselves' using errcode = '22023'; end if;
    if not exists (select 1 from public.org_nodes p where p.id = new.parent_id and p.chart_id = new.chart_id) then
      raise exception 'The manager must be in the same chart' using errcode = '22023';
    end if;
    cur := new.parent_id;
    while cur is not null loop
      depth := depth + 1;
      if depth > 20 then raise exception 'The chart is too deep' using errcode = '22023'; end if;
      if cur = new.id then raise exception 'That would make a loop' using errcode = '22023'; end if;
      select parent_id into cur from public.org_nodes where id = cur;
    end loop;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger org_nodes_guard before insert or update on public.org_nodes
  for each row execute function public.org_nodes_guard();

-- Removing someone moves their reports up to the removed person's manager instead of orphaning them.
create or replace function public.org_nodes_reparent()
returns trigger language plpgsql set search_path = public as $$
begin
  update public.org_nodes
     set parent_id = case when old.parent_id is not null and exists (select 1 from public.org_nodes p where p.id = old.parent_id) then old.parent_id end
   where parent_id = old.id;
  return old;
end $$;
create trigger org_nodes_reparent before delete on public.org_nodes
  for each row execute function public.org_nodes_reparent();

create trigger org_charts_touch before update on public.org_charts for each row execute function public.set_updated_at();
create trigger audit_org_charts after insert or update or delete on public.org_charts for each row execute function public.audit_row();
create trigger audit_org_nodes after insert or update or delete on public.org_nodes for each row execute function public.audit_row();

alter table public.org_charts enable row level security;
alter table public.org_nodes enable row level security;
revoke all on public.org_charts, public.org_nodes from anon, authenticated;
grant select, insert, update, delete on public.org_charts, public.org_nodes to authenticated;
create policy org_charts_read on public.org_charts for select to authenticated using ((select public.has_module_access('org-tree', 'read')));
create policy org_charts_write on public.org_charts for all to authenticated
  using ((select public.has_module_access('org-tree', 'write'))) with check ((select public.has_module_access('org-tree', 'write')));
create policy org_nodes_read on public.org_nodes for select to authenticated using ((select public.has_module_access('org-tree', 'read')));
create policy org_nodes_write on public.org_nodes for all to authenticated
  using ((select public.has_module_access('org-tree', 'write'))) with check ((select public.has_module_access('org-tree', 'write')));

insert into public.role_module_access (role, module_key, access_level) values
  ('instructor', 'org-tree', 'none'),
  ('coordinator', 'org-tree', 'none')
on conflict (role, module_key) do nothing;

-- Lead and admission numbers per owner, for leads created in [p_from, p_to). Totals only, never contact details.
--   enquiry      = website enquiries, owner = assigned_to      (open: new / contacted / qualified, won, lost)
--   registration = admission requests, owner = owner_id        (open: pending, won: accepted, lost: rejected)
-- fees = money recorded as paid on accepted registrations.
create or replace function public.org_kpi_summary(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_module_access('org-tree', 'read') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return (
    with leads as (
      select 'enquiry'::text as src, e.assigned_to as owner,
             (e.status in ('new', 'contacted', 'qualified')) as is_open, (e.status = 'won') as is_won, (e.status = 'lost') as is_lost,
             0::numeric as fees, e.created_at as created, case when e.status = 'won' then e.updated_at end as closed
        from public.site_enquiries e
       where (p_from is null or e.created_at >= p_from) and (p_to is null or e.created_at < p_to)
      union all
      select 'registration', r.owner_id,
             (r.status = 'pending'), (r.status = 'accepted'), (r.status = 'rejected'),
             case when r.status = 'accepted' and r.payment_status = 'paid' then coalesce(r.payment_amount, 0) else 0 end,
             r.created_at, case when r.status = 'accepted' then coalesce(r.reviewed_at, r.created_at) end
        from public.registrations r
       where (p_from is null or r.created_at >= p_from) and (p_to is null or r.created_at < p_to)
    )
    select jsonb_build_object(
      'owners', (select coalesce(jsonb_agg(jsonb_build_object('owner', owner, 'src', src, 'total', total, 'open', open, 'won', won, 'lost', lost, 'fees', fees)), '[]'::jsonb)
                   from (select owner, src, count(*) total, count(*) filter (where is_open) open, count(*) filter (where is_won) won,
                                count(*) filter (where is_lost) lost, coalesce(sum(fees), 0) fees
                           from leads group by owner, src) o),
      'created', (select coalesce(jsonb_agg(jsonb_build_object('owner', owner, 'week', week, 'n', n)), '[]'::jsonb)
                    from (select owner, date_trunc('week', created)::date week, count(*) n from leads group by 1, 2) c),
      'closed',  (select coalesce(jsonb_agg(jsonb_build_object('owner', owner, 'week', week, 'n', n)), '[]'::jsonb)
                    from (select owner, date_trunc('week', closed)::date week, count(*) n from leads where closed is not null group by 1, 2) c)
    )
  );
end $$;
revoke all on function public.org_kpi_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.org_kpi_summary(timestamptz, timestamptz) to authenticated;
