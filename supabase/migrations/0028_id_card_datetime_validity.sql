-- ID card validity moves from date-only to full date+time, and gains a
-- per-registration-form default so an admin doesn't have to re-enter the
-- same start/expiry window for every card issued from that form (or from
-- accept-registration's auto-issued card, which never had a way to set one).

alter table public.id_cards
  alter column valid_from type timestamptz using valid_from::timestamptz,
  alter column valid_until type timestamptz using valid_until::timestamptz;

alter table public.id_card_presets
  alter column valid_from type timestamptz using valid_from::timestamptz,
  alter column valid_until type timestamptz using valid_until::timestamptz;

alter table public.enrollment_forms
  add column id_card_valid_from timestamptz,
  add column id_card_valid_until timestamptz;
