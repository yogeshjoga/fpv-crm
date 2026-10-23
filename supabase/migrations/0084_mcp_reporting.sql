-- Read-only reporting functions for the `mcp` edge function (AI agents). Each returns one jsonb document, computed in the
-- database so an agent gets an answer in a single round trip instead of fetching and counting rows itself.
-- Service role only: the edge function decides which key may see what (masking of contact details happens there).

create or replace function public.mcp_overview(p_days integer default 7)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'students', (select jsonb_build_object('total', count(*), 'active', count(*) filter (where status = 'active'),
        'pending', count(*) filter (where status = 'pending'), 'suspended', count(*) filter (where status = 'suspended'),
        'archived', count(*) filter (where archived_at is not null)) from public.profiles where role = 'student'),
    'staff', (select jsonb_build_object('instructors', count(*) filter (where role = 'instructor'),
        'super_admins', count(*) filter (where role = 'super_admin')) from public.profiles where role <> 'student'),
    'courses', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status::text s, count(*) n from public.courses group by 1) x),
    'enrollments', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status::text s, count(*) n from public.enrollments group by 1) x),
    'exams', (select jsonb_build_object('attempts', count(*), 'submitted', count(*) filter (where submitted_at is not null),
        'passed', count(*) filter (where passed), 'average_score_pct', round(avg(score_pct) filter (where submitted_at is not null), 1))
        from public.exam_attempts),
    'certificates', (select jsonb_build_object('total', count(*), 'active', count(*) filter (where not revoked),
        'revoked', count(*) filter (where revoked)) from public.certificates),
    'registrations', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status::text s, count(*) n from public.registrations group by 1) x),
    'workshops_and_events', (select coalesce(jsonb_object_agg(s, n), '{}') from (select coalesce(kind, 'course_group') s, count(*) n from public.course_groups group by 1) x),
    'reviews', (select jsonb_build_object('count', count(*), 'average_rating', round(avg(rating), 2)) from public.reviews),
    'careers', jsonb_build_object(
      'jobs', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status s, count(*) n from public.careers_jobs group by 1) x),
      'applications', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status s, count(*) n from public.careers_applications group by 1) x)),
    'hr', jsonb_build_object(
      'employees', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status s, count(*) n from public.hr_employees group by 1) x),
      'assets', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status s, count(*) n from public.hr_assets group by 1) x)),
    'website_enquiries', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status s, count(*) n from public.site_enquiries group by 1) x),
    'last_days', jsonb_build_object(
      'days', least(greatest(coalesce(p_days, 7), 1), 90),
      'new_students', (select count(*) from public.profiles where role = 'student' and created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))),
      'new_registrations', (select count(*) from public.registrations where created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))),
      'exams_submitted', (select count(*) from public.exam_attempts where submitted_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))),
      'certificates_issued', (select count(*) from public.certificates where issued_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))),
      'new_applications', (select count(*) from public.careers_applications where created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))),
      'new_enquiries', (select count(*) from public.site_enquiries where created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90)))
    )
  );
$$;

create or replace function public.mcp_course_stats(p_course uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'course', jsonb_build_object('id', c.id, 'title', c.title, 'course_code', c.course_code, 'slug', c.slug, 'status', c.status,
        'summary', c.summary, 'grading_mode', c.grading_mode, 'scoring_mode', c.scoring_mode, 'pass_pct', c.pass_pct,
        'exam_question_count', c.exam_question_count, 'exam_time_limit_min', c.exam_time_limit_min, 'max_attempts', c.max_attempts,
        'cooldown_hours', c.cooldown_hours, 'exam_access', c.exam_access, 'exam_opens_at', c.exam_opens_at, 'exam_closes_at', c.exam_closes_at),
    'modules', (select count(*) from public.modules m where m.course_id = c.id),
    'lessons', (select count(*) from public.lessons l join public.modules m on m.id = l.module_id where m.course_id = c.id),
    'questions', (select jsonb_build_object('active', count(*) filter (where is_active), 'easy', count(*) filter (where is_active and difficulty = 'easy'),
        'medium', count(*) filter (where is_active and difficulty = 'medium'), 'hard', count(*) filter (where is_active and difficulty = 'hard'))
        from public.questions q where q.course_id = c.id),
    'enrolled', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status::text s, count(*) n from public.enrollments e where e.course_id = c.id group by 1) x),
    'attempts', (select jsonb_build_object('total', count(*), 'submitted', count(*) filter (where submitted_at is not null),
        'passed', count(*) filter (where passed), 'students', count(distinct student_id),
        'average_score_pct', round(avg(score_pct) filter (where submitted_at is not null), 1),
        'highest_score_pct', max(score_pct), 'lowest_score_pct', min(score_pct) filter (where submitted_at is not null))
        from public.exam_attempts a where a.course_id = c.id),
    'certificates', (select jsonb_build_object('active', count(*) filter (where not revoked), 'revoked', count(*) filter (where revoked))
        from public.certificates x where x.course_id = c.id),
    'reviews', (select jsonb_build_object('count', count(*), 'average_rating', round(avg(rating), 2)) from public.reviews r where r.course_id = c.id)
  )
  from public.courses c where c.id = p_course;
$$;

-- one row per student: their best submitted attempt in the course, with certificate number when issued
create or replace function public.mcp_exam_results(p_course uuid, p_limit integer default 100)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by r.score_pct desc nulls last, r.student_name), '[]'::jsonb) from (
    select distinct on (a.student_id)
      a.student_id, p.full_name as student_name, a.attempt_no, a.score_pct, a.passed, a.grade_label, a.submitted_at,
      (select count(*) from public.exam_attempts z where z.student_id = a.student_id and z.course_id = a.course_id) as attempts_used,
      (select cert_id_string from public.certificates ce where ce.student_id = a.student_id and ce.course_id = a.course_id and not ce.revoked order by issued_at desc limit 1) as certificate
    from public.exam_attempts a join public.profiles p on p.id = a.student_id
    where a.course_id = p_course and a.submitted_at is not null
    order by a.student_id, a.score_pct desc nulls last
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) r;
$$;

create or replace function public.mcp_student_profile(p_student uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone, 'role', p.role,
        'status', p.status, 'created_at', p.created_at, 'archived_at', p.archived_at),
    'enrollments', (select coalesce(jsonb_agg(jsonb_build_object('course_id', e.course_id, 'course', c.title, 'status', e.status,
        'enrolled_at', e.enrolled_at, 'extra_attempts', e.extra_attempts) order by e.enrolled_at desc), '[]')
        from public.enrollments e join public.courses c on c.id = e.course_id where e.student_id = p.id),
    'exam_attempts', (select coalesce(jsonb_agg(jsonb_build_object('course', c.title, 'attempt_no', a.attempt_no, 'status', a.status,
        'score_pct', a.score_pct, 'passed', a.passed, 'grade_label', a.grade_label, 'submitted_at', a.submitted_at) order by a.created_at desc), '[]')
        from public.exam_attempts a join public.courses c on c.id = a.course_id where a.student_id = p.id),
    'assessment_marks', (select coalesce(jsonb_agg(jsonb_build_object('course', c.title, 'component', m.component, 'marks', m.marks)), '[]')
        from public.assessment_marks m join public.courses c on c.id = m.course_id where m.student_id = p.id),
    'certificates', (select coalesce(jsonb_agg(jsonb_build_object('certificate', ce.cert_id_string, 'course', c.title, 'score_pct', ce.score_pct,
        'issued_at', ce.issued_at, 'revoked', ce.revoked) order by ce.issued_at desc), '[]')
        from public.certificates ce join public.courses c on c.id = ce.course_id where ce.student_id = p.id),
    'workshops_and_events', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'kind', g.kind, 'code', g.code)), '[]')
        from public.course_group_members gm join public.course_groups g on g.id = gm.group_id where gm.student_id = p.id),
    'id_cards', (select coalesce(jsonb_agg(jsonb_build_object('card_number', i.card_number, 'card_type', i.card_type, 'issued_at', i.issued_at,
        'valid_until', i.valid_until)), '[]') from public.id_cards i where i.student_id = p.id),
    'study_hours', (select round(coalesce(sum(seconds), 0) / 3600.0, 1) from public.study_time s where s.student_id = p.id),
    'careers_applications', (select coalesce(jsonb_agg(jsonb_build_object('id', ap.id, 'job', j.title, 'status', ap.status, 'applied_at', ap.created_at)), '[]')
        from public.careers_applications ap join public.careers_jobs j on j.id = ap.job_id where ap.student_id = p.id)
  )
  from public.profiles p where p.id = p_student;
$$;

create or replace function public.mcp_workshop_stats(p_group uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'workshop', jsonb_build_object('id', g.id, 'name', g.name, 'kind', g.kind, 'code', g.code, 'organizer', g.organizer, 'venue', g.venue,
        'starts_on', g.starts_on, 'ends_on', g.ends_on, 'description', g.description),
    'members', (select count(*) from public.course_group_members gm where gm.group_id = g.id),
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'course_code', c.course_code)), '[]')
        from public.course_group_courses gc join public.courses c on c.id = gc.course_id where gc.group_id = g.id),
    'exams', (select jsonb_build_object('attempts', count(*), 'submitted', count(*) filter (where a.submitted_at is not null),
        'passed', count(*) filter (where a.passed), 'students_attempted', count(distinct a.student_id),
        'average_score_pct', round(avg(a.score_pct) filter (where a.submitted_at is not null), 1))
        from public.exam_attempts a
        where a.student_id in (select student_id from public.course_group_members where group_id = g.id)
          and a.course_id in (select course_id from public.course_group_courses where group_id = g.id)),
    'certificates', (select count(*) from public.certificates ce
        where not ce.revoked and ce.student_id in (select student_id from public.course_group_members where group_id = g.id)
          and ce.course_id in (select course_id from public.course_group_courses where group_id = g.id)),
    'reviews', (select jsonb_build_object('count', count(*), 'average_rating', round(avg(rating), 2)) from public.reviews r where r.group_id = g.id)
  )
  from public.course_groups g where g.id = p_group;
$$;

create or replace function public.mcp_workshop_members(p_group uuid, p_limit integer default 200)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('student_id', p.id, 'full_name', p.full_name, 'email', p.email, 'status', p.status,
      'best_score_pct', (select max(a.score_pct) from public.exam_attempts a where a.student_id = p.id and a.submitted_at is not null
         and a.course_id in (select course_id from public.course_group_courses where group_id = p_group)),
      'certificates', (select count(*) from public.certificates ce where ce.student_id = p.id and not ce.revoked
         and ce.course_id in (select course_id from public.course_group_courses where group_id = p_group))
    ) order by p.full_name), '[]'::jsonb)
  from (select pr.* from public.course_group_members gm join public.profiles pr on pr.id = gm.student_id
        where gm.group_id = p_group order by pr.full_name limit least(greatest(coalesce(p_limit, 200), 1), 500)) p;
$$;

create or replace function public.mcp_careers_pipeline(p_job uuid default null, p_limit integer default 100)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'title', j.title, 'kind', j.kind, 'status', j.status, 'openings', j.openings,
        'apply_ends_at', j.apply_ends_at,
        'applications', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status s, count(*) n from public.careers_applications a where a.job_id = j.id group by 1) x))
        order by j.created_at desc), '[]') from public.careers_jobs j where p_job is null or j.id = p_job),
    'applications', (select coalesce(jsonb_agg(r), '[]') from (
        select a.id, a.job_id, j.title as job, p.full_name as applicant, a.status, rd.name as current_round, a.created_at, a.updated_at
        from public.careers_applications a join public.careers_jobs j on j.id = a.job_id join public.profiles p on p.id = a.student_id
        left join public.careers_rounds rd on rd.id = a.current_round_id
        where p_job is null or a.job_id = p_job
        order by a.updated_at desc limit least(greatest(coalesce(p_limit, 100), 1), 300)) r)
  );
$$;

create or replace function public.mcp_hr_summary(p_from date default null, p_to date default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'employees_by_status', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status s, count(*) n from public.hr_employees group by 1) x),
    'employees_by_department', (select coalesce(jsonb_object_agg(d, n), '{}') from (select coalesce(nullif(department, ''), 'none') d, count(*) n from public.hr_employees where status = 'active' group by 1) x),
    'assets_by_status', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status s, count(*) n from public.hr_assets group by 1) x),
    'assets_currently_assigned', (select count(*) from public.hr_asset_assignments where returned_on is null),
    'open_onboarding_tasks', (select count(*) from public.hr_onboarding_tasks where not done),
    'attendance', jsonb_build_object('from', coalesce(p_from, current_date - 30), 'to', coalesce(p_to, current_date),
        'by_status', (select coalesce(jsonb_object_agg(s, n), '{}') from (select status s, count(*) n from public.hr_attendance
            where day between coalesce(p_from, current_date - 30) and coalesce(p_to, current_date) group by 1) x))
  );
$$;

do $$
declare f text;
begin
  foreach f in array array['mcp_overview(integer)', 'mcp_course_stats(uuid)', 'mcp_exam_results(uuid,integer)', 'mcp_student_profile(uuid)',
                           'mcp_workshop_stats(uuid)', 'mcp_workshop_members(uuid,integer)', 'mcp_careers_pipeline(uuid,integer)', 'mcp_hr_summary(date,date)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
