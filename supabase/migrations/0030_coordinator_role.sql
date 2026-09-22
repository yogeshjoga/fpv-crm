-- New role: coordinator, promoted from an existing student account (role changes
-- are super_admin-only per profiles_update_super RLS, same as any other role
-- change). Kept as its own migration because a new enum value can't be used in
-- the same transaction it's added in.
alter type public.user_role add value if not exists 'coordinator';
