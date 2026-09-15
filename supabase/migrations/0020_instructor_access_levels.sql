-- Upgrades instructor_module_access from a plain visible/hidden flag to a
-- three-level access_level: 'none' (hidden, same as before), 'read' (can
-- open and view the module, but every write action is hidden/disabled),
-- 'write' (full access, same as "visible" used to mean).
--
-- Effective immediately: every currently-visible module becomes 'read' for
-- instructors (they keep visibility, lose write access) until a super
-- admin explicitly upgrades a module to 'write'. Anything already hidden
-- stays 'none'.

alter table public.instructor_module_access add column access_level text;

update public.instructor_module_access
set access_level = case when visible then 'read' else 'none' end;

alter table public.instructor_module_access alter column access_level set not null;
alter table public.instructor_module_access alter column access_level set default 'read';
alter table public.instructor_module_access
  add constraint instructor_module_access_level_check check (access_level in ('none', 'read', 'write'));

alter table public.instructor_module_access drop column visible;
