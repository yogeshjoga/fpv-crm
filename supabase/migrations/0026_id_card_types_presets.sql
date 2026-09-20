-- ID cards move from "students only, one fixed layout" to three card types
-- (student / coordinator / volunteer) with an admin-set validity window,
-- workshop name/location and fee, plus reusable presets so a whole batch
-- of cards can be generated without re-typing the same workshop details
-- for every single card.

alter table public.id_cards
  add column card_type text not null default 'student',
  add column workshop_name text,
  add column workshop_location text,
  add column fee_paid text,
  add column valid_from date;

create table public.id_card_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  card_type text not null default 'student',
  workshop_name text,
  workshop_location text,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

alter table public.id_card_presets enable row level security;

create policy id_card_presets_staff on public.id_card_presets
  for all using (public.is_staff()) with check (public.is_staff());
