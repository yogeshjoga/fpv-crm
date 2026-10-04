-- A student can look at (and download) the questions they got wrong in any of their own submitted
-- attempts, any time after the exam, not just on the results screen. Students cannot read the question
-- bank directly, so this goes through a function that only ever returns the caller's own attempt, only
-- wrong answers, and only for courses that have "show wrong answers after submitting" switched on.
create or replace function public.my_exam_review(p_attempt_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a record;
  v_show boolean;
begin
  select ea.id, ea.course_id, ea.status, ea.attempt_no, ea.score_pct, ea.submitted_at, ea.question_ids_json
    into a
    from public.exam_attempts ea
   where ea.id = p_attempt_id and ea.student_id = auth.uid();
  if not found or a.status = 'in_progress' then
    return jsonb_build_object('available', false, 'items', '[]'::jsonb);
  end if;

  select c.show_review into v_show from public.courses c where c.id = a.course_id;
  if not coalesce(v_show, false) then
    return jsonb_build_object('available', false, 'items', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'available', true,
    'attempt_no', a.attempt_no,
    'score_pct', a.score_pct,
    'submitted_at', a.submitted_at,
    'total', jsonb_array_length(a.question_ids_json),
    'items', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'question_id', q.id,
                 'prompt', q.prompt,
                 'type', q.type,
                 'your_answers', coalesce((
                   select jsonb_agg(o.label order by o."position")
                     from public.question_options o
                    where o.question_id = q.id
                      and o.id::text in (select jsonb_array_elements_text(x.selected_option_ids_json))
                 ), '[]'::jsonb),
                 'correct_answers', coalesce((
                   select jsonb_agg(o.label order by o."position")
                     from public.question_options o
                    where o.question_id = q.id and o.is_correct
                 ), '[]'::jsonb),
                 'explanation', coalesce(q.explanation, '')
               )
               order by qi.ord)
        from jsonb_array_elements_text(a.question_ids_json) with ordinality as qi(qid, ord)
        join public.exam_attempt_answers x on x.attempt_id = a.id and x.question_id = qi.qid::uuid
        join public.questions q on q.id = x.question_id
       where x.is_correct is not true
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.my_exam_review(uuid) from public, anon;
grant execute on function public.my_exam_review(uuid) to authenticated;
