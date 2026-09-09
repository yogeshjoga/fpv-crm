-- Allow service-role / direct-SQL updates (no end-user JWT) to change role/status.
-- End users always have a non-null auth.uid(); this only opens the trusted path.
create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;
  new.role   := old.role;
  new.status := old.status;
  return new;
end;
$$;

-- At most one in-progress exam attempt per student per course (guards against a
-- double-invoked start-exam creating duplicate attempts).
create unique index if not exists exam_attempts_one_in_progress
  on public.exam_attempts (student_id, course_id)
  where status = 'in_progress';
