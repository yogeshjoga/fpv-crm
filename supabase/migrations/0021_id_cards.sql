-- Student ID cards: generated automatically when a registration is accepted
-- (front + back in one PDF, emailed to the student), viewable/downloadable/
-- resendable by staff from the admin panel. Mirrors the certificates
-- pattern: a service-role-only sequence counter, a private storage bucket
-- with owner-or-staff read, and writes only ever happening through an edge
-- function's admin client.

create table public.id_cards (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null unique references public.profiles(id) on delete cascade,
  card_number     text not null unique,
  course_id       uuid references public.courses(id) on delete set null,
  pdf_path        text not null,
  issued_at       timestamptz not null default now(),
  issued_by       uuid references public.profiles(id) on delete set null,
  valid_until     date,
  last_emailed_at timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.id_cards enable row level security;

create policy id_cards_staff on public.id_cards
  for all using (public.is_staff()) with check (public.is_staff());
create policy id_cards_own_select on public.id_cards
  for select using (student_id = auth.uid());

-- service-role-only sequence, same pattern as cert_counters
create table public.id_card_counters (
  key      text primary key,
  last_seq int not null default 0
);
alter table public.id_card_counters enable row level security;
-- no policies -> service role only (see cert_counters)

create or replace function public.next_id_card_number()
returns int language plpgsql security definer set search_path = public as $$
declare next_seq int;
begin
  insert into public.id_card_counters (key, last_seq)
  values ('id_card', 1)
  on conflict (key)
    do update set last_seq = public.id_card_counters.last_seq + 1
  returning last_seq into next_seq;
  return next_seq;
end;
$$;

revoke execute on function public.next_id_card_number() from anon, authenticated, public;

comment on table public.id_card_counters is
  'Service-role only. RLS enabled with no policies is intentional — never client-accessible.';

-- storage bucket: owner-or-staff read; writes are service-role only (same as certificates)
insert into storage.buckets (id, name, public)
values ('id-cards', 'id-cards', false)
on conflict (id) do nothing;

-- path convention: id-cards/<user_id>/<card_number>.pdf
create policy "id-cards read" on storage.objects
  for select using (
    bucket_id = 'id-cards'
    and ( public.is_staff() or (storage.foldername(name))[1] = auth.uid()::text )
  );

insert into public.instructor_module_access (module_key, access_level) values
  ('id-cards', 'read')
on conflict (module_key) do nothing;
