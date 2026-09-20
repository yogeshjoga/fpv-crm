import { adminClient, cors, emailShell, HttpError, json, requireUser, sendEmail } from '../_shared/common.ts';

/**
 * Fans out a notification for one "Ask us" thread. Direction is inferred from
 * who's calling: a student notifies staff of a new question, staff notify the
 * student back when they reply. The actual message row is inserted by the
 * client (RLS allows that); this only handles the notification + email side,
 * which needs the service role like every other notification in this app.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const caller = await requireUser(req, admin);
    const { thread_id } = await req.json();
    if (!thread_id) throw new HttpError(400, 'thread_id is required.');

    const { data: thread } = await admin
      .from('support_threads')
      .select('id, subject, student_id, student:profiles!support_threads_student_id_fkey(full_name, email)')
      .eq('id', thread_id)
      .single();
    if (!thread) throw new HttpError(404, 'Thread not found.');

    const { data: me } = await admin.from('profiles').select('role, full_name, email').eq('id', caller.id).single();
    if (!me) throw new HttpError(404, 'Profile not found.');
    const iAmStaff = ['instructor', 'super_admin'].includes(me.role);

    const { data: org } = await admin
      .from('org_settings')
      .select('org_name, logo_url, verify_base_url, signatory_name, signatory_title, signatory_image_url, support_email')
      .single();
    const appUrl = String(org?.verify_base_url ?? '').replace(/\/+$/, '');
    const student = thread.student as unknown as { full_name: string; email: string } | null;

    if (iAmStaff) {
      await admin.from('notifications').insert({
        recipient_id: thread.student_id,
        title: `New reply — ${thread.subject}`,
        body: `${me.full_name || 'A staff member'} replied to your question.`,
        kind: 'ask_reply',
        link: '/app/ask',
      });
      if (student?.email) {
        await sendEmail({
          to: student.email,
          subject: `New reply — ${thread.subject}`,
          html: emailShell(
            `<p>Hi ${student.full_name || 'there'},</p>` +
              `<p>You have a new reply to your question &ldquo;<strong>${thread.subject}</strong>&rdquo;.</p>` +
              `<p><a href="${appUrl}/app/ask">Open the conversation</a></p>`,
            org,
          ),
        });
      }
      return json({ ok: true, notified: 'student' });
    }

    // Student direction: only the thread's own student may trigger this.
    if (thread.student_id !== caller.id) throw new HttpError(403, 'Forbidden.');
    const { data: staff } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .in('role', ['instructor', 'super_admin'])
      .eq('status', 'active');

    const askerName = me.full_name || 'A student';
    for (const s of staff ?? []) {
      await admin.from('notifications').insert({
        recipient_id: s.id,
        title: `New question — ${thread.subject}`,
        body: `${askerName} asked: ${thread.subject}`,
        kind: 'ask_new',
        link: '/admin/ask',
      });
      await sendEmail({
        to: s.email,
        subject: `New question — ${thread.subject}`,
        html: emailShell(
          `<p><strong>${askerName}</strong> asked a new question:</p>` +
            `<p>&ldquo;${thread.subject}&rdquo;</p>` +
            `<p><a href="${appUrl}/admin/ask">Open in admin</a></p>`,
          org,
        ),
      });
    }
    return json({ ok: true, notified: (staff ?? []).length });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
