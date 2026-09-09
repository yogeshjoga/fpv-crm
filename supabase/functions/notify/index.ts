import { adminClient, cors, HttpError, json, requireUser, sendEmail } from '../_shared/common.ts';

/** Sends account / enrollment notification emails. Callable by staff or service role. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    // allow service-role calls to skip user lookup
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
    let isServiceRole = jwt !== '' && jwt === (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    if (!isServiceRole) {
      try {
        isServiceRole = JSON.parse(atob(jwt.split('.')[1])).role === 'service_role';
      } catch {
        /* not service role */
      }
    }
    if (!isServiceRole) {
      const caller = await requireUser(req, admin);
      const { data: p } = await admin.from('profiles').select('role').eq('id', caller.id).single();
      if (!p || !['instructor', 'super_admin'].includes(p.role)) throw new HttpError(403, 'Forbidden.');
    }

    const { kind, user_id, course_id } = await req.json();
    const { data: org } = await admin.from('org_settings').select('org_name, support_email, verify_base_url').single();
    const { data: user } = await admin.from('profiles').select('full_name, email').eq('id', user_id).single();
    if (!user) throw new HttpError(404, 'User not found.');

    let course: { title: string } | null = null;
    if (course_id) {
      const { data } = await admin.from('courses').select('title').eq('id', course_id).single();
      course = data;
    }

    const appUrl = (org?.verify_base_url ?? '').replace(/\/$/, '');
    const templates: Record<string, { subject: string; html: string }> = {
      account_activated: {
        subject: `Your ${org?.org_name} account is active`,
        html: `<p>Hi ${user.full_name || 'there'},</p><p>Your account has been activated. You can now sign in and enroll in courses.</p><p><a href="${appUrl}/login">Sign in</a></p>`,
      },
      enrollment_approved: {
        subject: `You're enrolled${course ? ` in ${course.title}` : ''}`,
        html: `<p>Hi ${user.full_name || 'there'},</p><p>Your enrollment${course ? ` in <strong>${course.title}</strong>` : ''} has been approved. Open the course to start learning.</p><p><a href="${appUrl}/app/courses">Go to my courses</a></p>`,
      },
      attempts_locked: {
        subject: `Exam attempts exhausted${course ? ` — ${course.title}` : ''}`,
        html: `<p>Hi ${user.full_name || 'there'},</p><p>You've used all your exam attempts${course ? ` for <strong>${course.title}</strong>` : ''}. Contact ${org?.support_email} to request a reset.</p>`,
      },
    };

    const tpl = templates[kind];
    if (!tpl) throw new HttpError(400, `Unknown notification kind: ${kind}`);

    const result = await sendEmail({ to: user.email, subject: tpl.subject, html: `<div style="font-family:system-ui,Arial,sans-serif">${tpl.html}</div>` });
    return json({ ok: true, ...result });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
