-- A student gets exactly one review per course group: no editing it and no deleting it to
-- submit another. (A unique index already allows only one row per student and group.)
-- Staff can still remove an inappropriate review, which lets that student submit again.
drop policy reviews_student_update on public.reviews;
drop policy reviews_student_delete on public.reviews;
