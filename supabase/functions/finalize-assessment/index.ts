import { adminClient, cors, HttpError, json, requireUser } from '../_shared/common.ts';

const STAFF_ROLES = ['instructor', 'coordinator', 'admin', 'super_admin'];
const round2 = (n: number) => Math.round(n * 100) / 100;

type Admin = ReturnType<typeof adminClient>;
type Course = Record<string, any>;

/**
 * Turns a student's online exam score and the instructor-entered viva / simulation / piloting
 * marks into one total, then issues the certificate: "Merit" at or above the course's merit
 * threshold, "Participation" below it. Called by staff, a few students at a time so each
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
    if (course.scoring_mode !== 'composite') throw new HttpError(400, 'This course does not use composite marks.');

    const results = [];
    for (const studentId of student_ids) {
      try {
        results.push({ student_id: studentId, ...(await finalizeOne(admin, course, studentId)) });
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

  const online = round2((Number(best!.score_pct ?? 0) / 100) * Number(course.marks_online));
  const viva = marks.get('viva')!;
  const simulation = marks.get('simulation')!;
  const piloting = marks.get('piloting')!;
  const total = round2(online + viva + simulation + piloting);
  const max = round2(Number(course.marks_online) + Number(course.marks_viva) + Number(course.marks_simulation) + Number(course.marks_piloting));
  const certType = total >= Number(course.merit_min_marks) ? 'Merit' : 'Participation';

  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-certificate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attempt_id: best!.id,
      student_id: studentId,
      course_id: course.id,
      score_pct: max ? round2((total / max) * 100) : 0,
      cert_type: certType,
      breakdown: { online, viva, simulation, piloting, total, max },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Certificate generation failed (${res.status})`);

  await admin.from('enrollments').update({ status: 'completed' }).eq('id', best!.enrollment_id);
  return { status: 'issued', cert_id_string: body.cert_id_string, cert_type: certType, total, max };
}
