import { adminClient, cors, HttpError, json, requireUser } from '../_shared/common.ts';
import { evaluate, type Scheme } from '../_shared/assessment.ts';

const STAFF_ROLES = ['instructor', 'coordinator', 'admin', 'super_admin'];
const round2 = (n: number) => Math.round(n * 100) / 100;

type Admin = ReturnType<typeof adminClient>;
type Course = Record<string, any>;

/**
 * Staff-only. For 100-mark assessments this turns a student's online exam score and the instructor-entered viva / simulation / free flight
 * marks into a result, then issues the certificate. Every module has its own pass mark and must be
 * cleared on its own; a student who fails any one cannot get Merit however high the total is.
 * "Merit" = every module cleared and the merit total reached, otherwise "Participation". Called by staff, a few students at a time so each
 * request stays inside the function time limit (every certificate renders a PDF and emails it).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const user = await requireUser(req, admin);
    const { data: me } = await admin.from('profiles').select('role, status').eq('id', user.id).single();
    if (!me || me.status !== 'active' || !STAFF_ROLES.includes(me.role)) throw new HttpError(403, 'Only staff can finalise results.');

    const { course_id, student_ids } = (await req.json().catch(() => ({}))) as { course_id?: string; student_ids?: string[] };
    if (!course_id) throw new HttpError(400, 'course_id is required.');
    if (!Array.isArray(student_ids) || student_ids.length < 1 || student_ids.length > 8) {
      throw new HttpError(400, 'Send between 1 and 8 student_ids per request.');
    }

    const { data: course } = await admin.from('courses').select('*').eq('id', course_id).single();
    if (!course) throw new HttpError(404, 'Course not found.');
    const composite = course.scoring_mode === 'composite';

    const results = [];
    for (const studentId of student_ids) {
      try {
        results.push({ student_id: studentId, ...(await (composite ? finalizeOne(admin, course, studentId) : issueOnPass(admin, course, studentId))) });
      } catch (e) {
        results.push({ student_id: studentId, status: 'error', message: (e as Error).message });
      }
    }
    return json({ results });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});

/**
 * Ordinary (single exam) courses: the admin issues the certificate for a student who has passed. Nothing is
 * sent automatically after the exam unless the course is set to "auto".
 */
async function issueOnPass(admin: Admin, course: Course, studentId: string) {
  const { data: existing } = await admin
    .from('certificates')
    .select('cert_id_string')
    .eq('student_id', studentId)
    .eq('course_id', course.id)
    .eq('revoked', false)
    .maybeSingle();
  if (existing) return { status: 'already_issued', cert_id_string: existing.cert_id_string };

  const { data: attempts } = await admin
    .from('exam_attempts')
    .select('id, enrollment_id, score_pct, passed')
    .eq('student_id', studentId)
    .eq('course_id', course.id)
    .eq('passed', true)
    .neq('status', 'in_progress');
  const best = (attempts ?? []).reduce<{ id: string; enrollment_id: string; score_pct: number | null } | null>(
    (m, a) => (!m || Number(a.score_pct ?? 0) > Number(m.score_pct ?? 0) ? a : m),
    null,
  );
  if (!best) return { status: 'not_passed' };

  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-certificate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ attempt_id: best.id, student_id: studentId, course_id: course.id, score_pct: Number(best.score_pct ?? 0) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Certificate generation failed (${res.status})`);
  await admin.from('enrollments').update({ status: 'completed' }).eq('id', best.enrollment_id);
  return { status: 'issued', cert_id_string: body.cert_id_string };
}

async function finalizeOne(admin: Admin, course: Course, studentId: string) {
  const { data: existing } = await admin
    .from('certificates')
    .select('cert_id_string, cert_type')
    .eq('student_id', studentId)
    .eq('course_id', course.id)
    .eq('revoked', false)
    .maybeSingle();
  if (existing) return { status: 'already_issued', cert_id_string: existing.cert_id_string, cert_type: existing.cert_type };

  // Online exam: the best finished attempt (an expired attempt counts as 0).
  const { data: attempts } = await admin
    .from('exam_attempts')
    .select('id, enrollment_id, score_pct, status')
    .eq('student_id', studentId)
    .eq('course_id', course.id)
    .neq('status', 'in_progress');
  const best = (attempts ?? []).reduce<{ id: string; enrollment_id: string; score_pct: number | null } | null>(
    (m, a) => (!m || Number(a.score_pct ?? 0) > Number(m.score_pct ?? 0) ? a : m),
    null,
  );

  const { data: markRows } = await admin.from('assessment_marks').select('component, marks').eq('course_id', course.id).eq('student_id', studentId);
  const marks = new Map((markRows ?? []).map((m) => [m.component as string, Number(m.marks)]));

  const missing: string[] = [];
  if (!best) missing.push('online exam');
  for (const c of ['viva', 'simulation', 'piloting']) if (!marks.has(c)) missing.push(c);
  if (missing.length) return { status: 'incomplete', missing };

  const scheme: Scheme = {
    max: {
      online: Number(course.marks_online),
      viva: Number(course.marks_viva),
      simulation: Number(course.marks_simulation),
      piloting: Number(course.marks_piloting),
    },
    pass: {
      online: Number(course.pass_marks_online),
      viva: Number(course.pass_marks_viva),
      simulation: Number(course.pass_marks_simulation),
      piloting: Number(course.pass_marks_piloting),
    },
    meritMin: Number(course.merit_min_marks),
  };
  // The online mark is judged unrounded (74.99% must not round up into a pass), shown rounded.
  const onlineRaw = (Number(best!.score_pct ?? 0) / 100) * scheme.max.online;
  const ev = evaluate(scheme, { online: onlineRaw, viva: Number(marks.get('viva')), simulation: Number(marks.get('simulation')), piloting: Number(marks.get('piloting')) })!;
  const byKey = Object.fromEntries(ev.modules.map((m) => [m.key, m.marks])) as Record<string, number>;
  const certType = ev.result;
  const total = ev.total;
  const max = ev.max;
  // Snapshot kept on the certificate: this is the report card the student sees.
  const report = { ...ev, merit_min: scheme.meritMin, course: course.title, finalized_at: new Date().toISOString() };

  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-certificate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attempt_id: best!.id,
      student_id: studentId,
      course_id: course.id,
      score_pct: max ? round2((total / max) * 100) : 0,
      cert_type: certType,
      breakdown: { online: byKey.online, viva: byKey.viva, simulation: byKey.simulation, piloting: byKey.piloting, total, max },
      report,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Certificate generation failed (${res.status})`);

  await admin.from('enrollments').update({ status: 'completed' }).eq('id', best!.enrollment_id);
  return { status: 'issued', cert_id_string: body.cert_id_string, cert_type: certType, total, max, cleared_all: ev.clearedAll, failed: ev.failed };
}
