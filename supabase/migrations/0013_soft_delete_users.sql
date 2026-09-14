-- Soft-delete for user accounts. Deleting stays a service-role-only edge
-- function (admin-delete-user) that also bans the auth user; this migration
-- just adds the marker columns the UI and function need.

alter table public.profiles add column if not exists archived_at timestamptz;
alter table public.profiles add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create index if not exists profiles_archived_at_idx on public.profiles (archived_at);
