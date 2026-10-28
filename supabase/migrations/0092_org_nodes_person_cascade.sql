-- A box in the org tree that points at a person cannot stay once that person is deleted: it would be left with no name, which the
-- table rightly refuses, and that would block deleting a user account or an HR record. The box goes with the person, and the
-- people who reported to it move up to its manager (the existing delete trigger does that).

alter table public.org_nodes drop constraint org_nodes_profile_id_fkey;
alter table public.org_nodes add constraint org_nodes_profile_id_fkey foreign key (profile_id) references public.profiles(id) on delete cascade;
alter table public.org_nodes drop constraint org_nodes_employee_id_fkey;
alter table public.org_nodes add constraint org_nodes_employee_id_fkey foreign key (employee_id) references public.hr_employees(id) on delete cascade;
