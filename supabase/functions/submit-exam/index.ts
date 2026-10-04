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
    // An admin can give this student extra attempts on top of the course's allowance.
    const { data: enr } = await admin.from('enrollments').select('extra_attempts').eq('student_id', user.id).eq('course_id', course.id).maybeSingle();
    course.max_attempts = Number(course.max_attempts) + Number(enr?.extra_attempts ?? 0);

    // The time limit is enforced here, not just in the browser. The page auto-submits when time
    // runs out, so allow two minutes for a slow connection; beyond that the attempt is expired
    // (used up, scored 0) exactly like an abandoned one — it cannot be finished hours later.
    const GRACE_MS = 120_000;
    if (Date.now() - new Date(attempt.expires_at).getTime() > GRACE_MS) {
      const { count: finished } = await admin
        .from('exam_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', user.id)
        .eq('course_id', course.id)
        .neq('status', 'in_progress');
      const exhausted = (finished ?? 0) + 1 >= course.max_attempts;
      await admin
        .from('exam_attempts')
        .update({
          status: 'expired',
          submitted_at: new Date().toISOString(),
          score_pct: 0,
          passed: false,
          locked: exhausted,
          cooldown_until: exhausted ? null : new Date(Date.now() + course.cooldown_hours * 3600_000).toISOString(),
        })
        .eq('id', attempt_id);
      throw new HttpError(409, 'The time limit for this exam ran out before it was submitted, so the attempt has closed.');
    }

    const questionIds = attempt.question_ids_json as string[];
    const { data: options } = await admin
      .from('question_options')
      .select('id, question_id, is_correct')
      .in('question_id', questionIds);
    const { data: pointsRows } = await admin.from('questions').select('id, points').in('id', questionIds);

    const correctByQ = new Map<string, Set<string>>();
    for (const o of options ?? []) {
      if (!correctByQ.has(o.question_id)) correctByQ.set(o.question_id, new Set());
      if (o.is_correct) correctByQ.get(o.question_id)!.add(o.id);
    }
    const pointsByQ = new Map<string, number>();
    for (const q of pointsRows ?? []) pointsByQ.set(q.id, q.points ?? 1);

    const answerMap = new Map<string, string[]>();
    for (const a of answers ?? []) answerMap.set(a.question_id, a.selected_option_ids ?? []);

    let correctCount = 0;
    let earnedPoints = 0;
    let totalPoints = 0;
    const answerRows = questionIds.map((qid) => {
      const correct = correctByQ.get(qid) ?? new Set<string>();
      const selected = new Set(answerMap.get(qid) ?? []);
      const isCorrect =
        selected.size === correct.size && [...selected].every((id) => correct.has(id)) && correct.size > 0;
      const points = pointsByQ.get(qid) ?? 1;
      totalPoints += points;
      if (isCorrect) {
        correctCount++;
        earnedPoints += points;
      }
      return { attempt_id, question_id: qid, selected_option_ids_json: [...selected], is_correct: isCorrect };
    });

    const total = questionIds.length;
    const scorePct = totalPoints ? Math.round((earnedPoints / totalPoints) * 10000) / 100 : 0;

    // Courses with show_review get every wrong question back with the correct answer and
    // its explanation, so the student can learn from the attempt. Right answers are never
    // echoed back, which keeps the exam pool from leaking beyond what the student missed.
    let review:
      | { question_id: string; prompt: string; type: string; your_answers: string[]; correct_answers: string[]; explanation: string }[]
      | undefined;
    const wrong = answerRows.filter((r) => !r.is_correct);
    if (course.show_review && wrong.length) {
      const wrongIds = wrong.map((r) => r.question_id);
      const { data: qRows } = await admin.from('questions').select('id, prompt, type, explanation').in('id', wrongIds);
      const { data: optRows } = await admin
        .from('question_options')
        .select('id, question_id, label, is_correct, position')
        .in('question_id', wrongIds)
        .order('position');
      const qById = new Map((qRows ?? []).map((q) => [q.id, q]));
      const optsByQ = new Map<string, { id: string; label: string; is_correct: boolean }[]>();
      for (const o of optRows ?? []) {
        const arr = optsByQ.get(o.question_id) ?? [];
        arr.push(o);
        optsByQ.set(o.question_id, arr);
      }
      review = wrong
        .filter((r) => qById.has(r.question_id))
        .map((r) => {
          const q = qById.get(r.question_id)!;
          const opts = optsByQ.get(r.question_id) ?? [];
          const picked = new Set(r.selected_option_ids_json);
          return {
            question_id: r.question_id,
            prompt: q.prompt,
            type: q.type,
            your_answers: opts.filter((o) => picked.has(o.id)).map((o) => o.label),
            correct_answers: opts.filter((o) => o.is_correct).map((o) => o.label),
            explanation: q.explanation ?? '',
          };
        });
    }

    let gradeLabel: string | null = null;
    let passed: boolean;
    if (course.grading_mode === 'tiered') {
      if (scorePct >= 80) gradeLabel = 'Grade 1';
      else if (scorePct >= 70) gradeLabel = 'Grade 2';
      else if (scorePct >= 50) gradeLabel = 'Grade 3';
      else if (scorePct >= 35) gradeLabel = 'Grade 4';
      else gradeLabel = 'Failed';
      passed = gradeLabel !== 'Failed';
    } else {
      passed = scorePct >= course.pass_pct;
    }
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
      grade_label: gradeLabel,
    };
    // Composite courses: the online exam is only one component of the final mark. Passing it
    // never issues a certificate — the total (online + viva + simulation + piloting) decides
    // that later, when an instructor finalises results.
    const composite = course.scoring_mode === 'composite';
    const examMarks = composite ? Math.round(((scorePct / 100) * Number(course.marks_online)) * 100) / 100 : undefined;
    let locked = false;
    let cooldownUntil: string | undefined;
    if (composite) {
      if (attemptsUsed >= course.max_attempts) {
        locked = true;
        patch.locked = true;
      }
    } else if (!passed) {
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
    if (passed && !composite) {
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
      grade_label: gradeLabel,
      correct_count: correctCount,
      wrong_count: total - correctCount,
      total,
      review,
      cert_id_string: certId,
      cooldown_until: cooldownUntil,
      locked,
      composite,
      exam_marks: examMarks,
      exam_max: composite ? Number(course.marks_online) : undefined,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
