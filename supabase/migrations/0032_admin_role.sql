-- New role: admin (co-founder-level staff), a real distinct role value alongside
-- instructor/super_admin — added directly via Employees, same as instructor.
-- Kept as its own migration because a new enum value can't be used in the same
-- transaction it's added in.
alter type public.user_role add value if not exists 'admin';
