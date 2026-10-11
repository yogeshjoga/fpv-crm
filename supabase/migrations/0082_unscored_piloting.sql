-- A free flight round can be assessed without marks: the report card then shows a short description
-- (e.g. "Moderate piloting skills") in place of marks, and the module counts towards neither the total
-- nor the cleared check. A course turns this on by setting marks_piloting to 0 and giving it a label.
alter table public.courses add column piloting_label text;

-- Sivani FPV Final Exam: piloting is not marked; out of 60 (online 15 + viva 15 + simulation 30),
-- Merit at 75% = 45.
update public.courses
   set marks_piloting = 0,
       pass_marks_piloting = 0,
       merit_min_marks = 45,
       piloting_label = 'Moderate piloting skills'
 where id = '7eacd2fe-6078-4851-bd52-ab3f6c3cd723';
