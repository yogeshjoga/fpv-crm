import { adminClient, cors, emailShell, HttpError, json, requireUser, sendEmail } from '../_shared/common.ts';

/** Staff-only: fan a message out to an audience as in-app notifications + email. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const user = await requireUser(req, admin);
    const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (!me || !['instructor', 'super_admin'].includes(me.role)) throw new HttpError(403, 'Forbidden.');

    const { subject, body, audience_type, audience_ref } = await req.json();
    if (!subject?.trim()) throw new HttpError(400, 'Subject is required.');
    if (!['all_students', 'course', 'all_staff', 'users'].includes(audience_type))
      throw new HttpError(400, 'Unknown audience type.');

    // resolve recipients -> [{ id, email, full_name }]
    let recipients: { id: string; email: string; full_name: string }[] = [];
    if (audience_type === 'all_students') {
      const { data } = await admin.from('profiles').select('id, email, full_name').eq('role', 'student').eq('status', 'active');
      recipients = data ?? [];
    } else if (audience_type === 'all_staff') {
      const { data } = await admin.from('profiles').select('id, email, full_name').in('role', ['instructor', 'super_admin']);
      recipients = data ?? [];
    } else if (audience_type === 'course') {
      const courseId = audience_ref?.course_id;
      if (!courseId) throw new HttpError(400, 'course_id required.');
      const { data } = await admin
        .from('enrollments')
        .select('student:profiles!enrollments_student_id_fkey(id, email, full_name)')
        .eq('course_id', courseId)
        .neq('status', 'revoked');
      recipients = (data ?? []).map((r: { student: { id: string; email: string; full_name: string } }) => r.student).filter(Boolean);
    } else if (audience_type === 'users') {
      const ids: string[] = audience_ref?.ids ?? [];
      if (!ids.length) throw new HttpError(400, 'ids required.');
      const { data } = await admin.from('profiles').select('id, email, full_name').in('id', ids);
      recipients = data ?? [];
    }

    // de-dupe
    const seen = new Set<string>();
    recipients = recipients.filter((r) => r && !seen.has(r.id) && seen.add(r.id));
    if (!recipients.length) throw new HttpError(400, 'No recipients match that audience.');

    const { data: bc, error: bcErr } = await admin
      .from('broadcasts')
      .insert({ subject, body: body ?? '', audience_type, audience_ref: audience_ref ?? {}, sent_by: user.id, recipient_count: recipients.length })
      .select('id')
      .single();
    if (bcErr) throw new HttpError(500, bcErr.message);

    await admin.from('notifications').insert(
      recipients.map((r) => ({
        recipient_id: r.id,
        title: subject,
        body: body ?? '',
        kind: 'broadcast',
        broadcast_id: bc.id,
      })),
    );

    let emailSent = 0;
    const html = emailShell(
      (body ?? '')
        .split('\n')
        .map((l: string) => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`)
        .join(''),
    );
    for (const r of recipients) {
      const res = await sendEmail({ to: r.email, subject, html });
      if (res.sent) emailSent++;
    }
    await admin.from('broadcasts').update({ email_sent: emailSent }).eq('id', bc.id);

    return json({ broadcast_id: bc.id, recipient_count: recipients.length, email_sent: emailSent });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
