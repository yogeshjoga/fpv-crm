import { adminClient, cors, HttpError, json, requireUser, shuffle } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const user = await requireUser(req, admin);
    const { course_slug, course_id } = await req.json().catch(() => ({}));

    // profile must be active
    const { data: profile } = await admin.from('profiles').select('status').eq('id', user.id).single();
    if (profile?.status !== 'active') throw new HttpError(403, 'Your account is not active.');

    // course
    const courseQuery = admin.from('courses').select('*');
    const { data: course } = course_id
      ? await courseQuery.eq('id', course_id).single()
      : await courseQuery.eq('slug', course_slug).single();
    if (!course) throw new HttpError(404, 'Course not found.');

    // enrollment
    const { data: enrollment } = await admin
      .from('enrollments')
      .select('id, status')
      .eq('student_id', user.id)
      .eq('course_id', course.id)
      .maybeSingle();
    if (!enrollment || enrollment.status === 'revoked') throw new HttpError(403, 'You are not enrolled in this course.');

    // already certified?
    const { data: existingCert } = await admin
      .from('certificates')
      .select('id')
      .eq('student_id', user.id)
      .eq('course_id', course.id)
      .eq('revoked', false)
      .maybeSingle();
    if (existingCert) throw new HttpError(409, 'You have already passed this course.');

    // attempts so far
    const { data: attempts } = await admin
      .from('exam_attempts')
      .select('*')
      .eq('student_id', user.id)
      .eq('course_id', course.id)
      .order('attempt_no', { ascending: false });

    const latest = attempts?.[0];
    const now = Date.now();

    // resume an in-progress, unexpired attempt
    if (latest && latest.status === 'in_progress' && new Date(latest.expires_at).getTime() > now) {
      const questions = await buildQuestionSet(admin, latest.question_ids_json as string[]);
      return json({
        attempt_id: latest.id,
        expires_at: latest.expires_at,
        time_limit_min: course.exam_time_limit_min,
        questions,
      });
    }

    // expire a stale in-progress attempt (counts as a used attempt)
    if (latest && latest.status === 'in_progress') {
      await admin
        .from('exam_attempts')
        .update({
          status: 'expired',
          submitted_at: new Date().toISOString(),
          score_pct: 0,
          passed: false,
          cooldown_until: new Date(now + course.cooldown_hours * 3600_000).toISOString(),
        })
        .eq('id', latest.id);
      attempts!.unshift({ ...latest, status: 'expired' });
    }

    const used = (attempts ?? []).filter((a) => a.status !== 'in_progress').length;
    const freshLatest = attempts?.find((a) => a.status !== 'in_progress');

    if (freshLatest?.locked || used >= course.max_attempts) {
      if (freshLatest && !freshLatest.locked) await admin.from('exam_attempts').update({ locked: true }).eq('id', freshLatest.id);
      throw new HttpError(403, 'You have used all attempts. Ask an instructor to reset your exam.');
    }
    if (freshLatest?.cooldown_until && new Date(freshLatest.cooldown_until).getTime() > now) {
      throw new HttpError(429, `Next attempt available after ${new Date(freshLatest.cooldown_until).toLocaleString()}.`);
    }

    // pick questions
    const { data: pool } = await admin
      .from('questions')
      .select('id')
      .eq('course_id', course.id)
      .eq('is_active', true);
    if (!pool || pool.length === 0) throw new HttpError(400, 'This course has no exam questions yet.');

    const pickCount = Math.min(course.exam_question_count, pool.length);
    const pickedIds = shuffle(pool.map((q) => q.id)).slice(0, pickCount);

    const expiresAt = new Date(now + course.exam_time_limit_min * 60_000).toISOString();
    const { data: attempt, error: insErr } = await admin
      .from('exam_attempts')
      .insert({
        enrollment_id: enrollment.id,
        student_id: user.id,
        course_id: course.id,
        attempt_no: used + 1,
        status: 'in_progress',
        started_at: new Date(now).toISOString(),
        expires_at: expiresAt,
        question_ids_json: pickedIds,
      })
      .select('id, expires_at, question_ids_json')
      .single();

    if (insErr) {
      // race (e.g. double-invoke): fall back to the existing in-progress attempt
      const { data: race } = await admin
        .from('exam_attempts')
        .select('id, expires_at, question_ids_json')
        .eq('student_id', user.id)
        .eq('course_id', course.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!race) throw new HttpError(500, insErr.message);
      return json({
        attempt_id: race.id,
        expires_at: race.expires_at,
        time_limit_min: course.exam_time_limit_min,
        questions: await buildQuestionSet(admin, race.question_ids_json as string[]),
      });
    }

    const questions = await buildQuestionSet(admin, attempt.question_ids_json as string[]);
    return json({ attempt_id: attempt.id, expires_at: attempt.expires_at, time_limit_min: course.exam_time_limit_min, questions });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});

async function buildQuestionSet(admin: ReturnType<typeof adminClient>, ids: string[]) {
  const { data: qs } = await admin.from('questions').select('id, prompt, type').in('id', ids);
  const { data: opts } = await admin.from('question_options').select('id, question_id, label').in('question_id', ids);
  const byQ = new Map<string, { id: string; label: string }[]>();
  for (const o of opts ?? []) {
    const arr = byQ.get(o.question_id) ?? [];
    arr.push({ id: o.id, label: o.label });
    byQ.set(o.question_id, arr);
  }
  // preserve the drawn order
  const order = new Map(ids.map((id, i) => [id, i]));
  return (qs ?? [])
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((q) => ({ id: q.id, prompt: q.prompt, type: q.type, options: shuffle(byQ.get(q.id) ?? []) }));
}
