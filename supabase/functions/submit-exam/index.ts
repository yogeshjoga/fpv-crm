import { adminClient, cors, HttpError, json, requireUser } from '../_shared/common.ts';

interface AnswerIn {
  question_id: string;
  selected_option_ids: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const user = await requireUser(req, admin);
    const { attempt_id, answers } = (await req.json()) as { attempt_id: string; answers: AnswerIn[] };
    if (!attempt_id) throw new HttpError(400, 'attempt_id is required.');

    const { data: attempt } = await admin.from('exam_attempts').select('*').eq('id', attempt_id).single();
    if (!attempt || attempt.student_id !== user.id) throw new HttpError(403, 'Attempt not found.');
    if (attempt.status !== 'in_progress') throw new HttpError(409, 'This attempt was already submitted.');

    const { data: course } = await admin.from('courses').select('*').eq('id', attempt.course_id).single();
    if (!course) throw new HttpError(404, 'Course not found.');

    const questionIds = attempt.question_ids_json as string[];
    const { data: options } = await admin
      .from('question_options')
      .select('id, question_id, is_correct')
      .in('question_id', questionIds);

    const correctByQ = new Map<string, Set<string>>();
    for (const o of options ?? []) {
      if (!correctByQ.has(o.question_id)) correctByQ.set(o.question_id, new Set());
      if (o.is_correct) correctByQ.get(o.question_id)!.add(o.id);
    }

    const answerMap = new Map<string, string[]>();
    for (const a of answers ?? []) answerMap.set(a.question_id, a.selected_option_ids ?? []);

    let correctCount = 0;
    const answerRows = questionIds.map((qid) => {
      const correct = correctByQ.get(qid) ?? new Set<string>();
      const selected = new Set(answerMap.get(qid) ?? []);
      const isCorrect =
        selected.size === correct.size && [...selected].every((id) => correct.has(id)) && correct.size > 0;
      if (isCorrect) correctCount++;
      return { attempt_id, question_id: qid, selected_option_ids_json: [...selected], is_correct: isCorrect };
    });

    const total = questionIds.length;
    const scorePct = total ? Math.round((correctCount / total) * 10000) / 100 : 0;
    const passed = scorePct >= course.pass_pct;
    const now = Date.now();

    await admin.from('exam_attempt_answers').insert(answerRows);

    // count attempts used, including this one
    const { count: usedCount } = await admin
      .from('exam_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', user.id)
      .eq('course_id', course.id)
      .neq('status', 'in_progress');
    const attemptsUsed = (usedCount ?? 0) + 1;

    const patch: Record<string, unknown> = {
      status: 'submitted',
      submitted_at: new Date(now).toISOString(),
      score_pct: scorePct,
      passed,
    };
    let locked = false;
    let cooldownUntil: string | undefined;
    if (!passed) {
      if (attemptsUsed >= course.max_attempts) {
        locked = true;
        patch.locked = true;
      } else {
        cooldownUntil = new Date(now + course.cooldown_hours * 3600_000).toISOString();
        patch.cooldown_until = cooldownUntil;
      }
    }
    await admin.from('exam_attempts').update(patch).eq('id', attempt_id);

    let certId: string | undefined;
    if (passed) {
      await admin.from('enrollments').update({ status: 'completed' }).eq('id', attempt.enrollment_id);
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-certificate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ attempt_id, student_id: user.id, course_id: course.id, score_pct: scorePct }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) certId = body.cert_id_string;
      else console.error('generate-certificate failed', res.status, body);
    }

    return json({
      score_pct: scorePct,
      passed,
      correct_count: correctCount,
      total,
      cert_id_string: certId,
      cooldown_until: cooldownUntil,
      locked,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
