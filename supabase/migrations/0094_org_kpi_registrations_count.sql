-- Org tree numbers: every registration that has been reviewed counts as an admission, whether it was accepted or rejected in
-- Registrations (that is how the team counts admissions). A registration still waiting for review stays Open. Website enquiries
-- are unchanged: open until won or lost. Fees are the amounts recorded as paid on registrations.

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
             (r.status = 'pending'), (r.status <> 'pending'), false,
             case when r.payment_status = 'paid' then coalesce(r.payment_amount, 0) else 0 end,
             r.created_at, case when r.status <> 'pending' then coalesce(r.reviewed_at, r.created_at) end
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
