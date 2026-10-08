-- Close the public Supabase Auth sign-up door. Anyone could call the Auth API directly (supabase.auth.signUp, bypassing
-- our registration form) and create accounts: database rows, confirmation emails sent from our address, a flooded
-- pending queue. Accounts are meant to come only from an admin (accept-registration, add-students, admin-create-user),
-- which mark the user with app_metadata.provisioned = true. app_metadata cannot be set by a self sign-up, only by the
-- service role. Google sign-in keeps working. Any "role" a caller puts in user metadata is dropped as well. (The
-- profile trigger already ignores it, so nobody could become an admin this way, but there is no reason to store it.)

create or replace function public.guard_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email'
     and coalesce(new.raw_app_meta_data ->> 'provisioned', '') <> 'true' then
    raise exception 'Sign-ups are closed. Register through the registration form and an admin will create your account.' using errcode = 'P0001';
  end if;
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'role' - 'status';
  return new;
end $$;
revoke all on function public.guard_new_auth_user() from public, anon, authenticated;

drop trigger if exists a_guard_new_auth_user on auth.users;
create trigger a_guard_new_auth_user before insert on auth.users
  for each row execute function public.guard_new_auth_user();
