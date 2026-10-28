-- Org tree: a box can now be an employee or intern from the HR records, any user account, or a temporary person from outside
-- the organisation (a consultant, trainer, advisor...) who may have an end date. Additive: existing boxes are unchanged.

alter table public.org_nodes
  add column employee_id uuid references public.hr_employees(id) on delete set null,
  add column is_external boolean not null default false,
  add column until date;

alter table public.org_nodes drop constraint org_node_named;
alter table public.org_nodes add constraint org_node_named
  check (profile_id is not null or employee_id is not null or char_length(btrim(label)) > 0);
-- someone from outside has no account or HR record, only a name
alter table public.org_nodes add constraint org_node_external
  check (not is_external or (profile_id is null and employee_id is null and char_length(btrim(label)) > 0));
alter table public.org_nodes add constraint org_node_until check (until is null or is_external);

create unique index org_nodes_one_employee_per_chart on public.org_nodes (chart_id, employee_id) where employee_id is not null;
