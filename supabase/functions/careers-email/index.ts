import { adminClient, cors, emailButton, emailShell, HttpError, json, rateLimit, requireStrongUser, sendEmail } from '../_shared/common.ts';

const STAFF_ROLES = ['instructor', 'coordinator', 'admin', 'super_admin'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text from the HR person -> email paragraphs. Blank line = new paragraph, "- " lines stay as bullet lines. */
function toHtml(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#333">${p
          .split('\n')
          .map((line) => esc(line.replace(/^\s*[-•*]\s+/, '• ')))
          .join('<br/>')}</p>`,
    )
    .join('');
}

/**
 * HR: email a candidate about their application (interview schedule, status update, or a custom note).
 * The recipient is always the applicant on record, never an address from the request, so this cannot be used to send
 * mail to arbitrary people. The HR person reviews and edits the text before it is sent.
 * Body: { application_id, subject, message }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const caller = await requireStrongUser(req, admin);
    const { data: me } = await admin.from('profiles').select('role, status, archived_at').eq('id', caller.id).single();
    if (!me || me.status !== 'active' || me.archived_at || !STAFF_ROLES.includes(me.role)) throw new HttpError(403, 'Forbidden.');
    if (me.role !== 'super_admin') {
      const { data: access } = await admin.from('role_module_access').select('access_level').eq('role', me.role).eq('module_key', 'careers').maybeSingle();
      if ((access?.access_level ?? 'read') !== 'write') throw new HttpError(403, 'You need Write access to Careers to email candidates.');
    }
    await rateLimit(admin, 'careers-email', caller.id, 60, 3600);

    const { application_id, subject, message } = await req.json();
    if (typeof application_id !== 'string' || !UUID.test(application_id)) throw new HttpError(400, 'application_id is required.');
    const subj = String(subject ?? '').trim();
    const body = String(message ?? '').trim();
    if (subj.length < 3 || subj.length > 200) throw new HttpError(400, 'Give the email a subject (up to 200 characters).');
    if (body.length < 10 || body.length > 6000) throw new HttpError(400, 'The message must be between 10 and 6000 characters.');

    const { data: app } = await admin.from('careers_applications').select('id, student_id').eq('id', application_id).maybeSingle();
    if (!app) throw new HttpError(404, 'Application not found.');
    const { data: person } = await admin.from('profiles').select('email').eq('id', app.student_id).single();
    if (!person?.email) throw new HttpError(409, 'This applicant has no email address.');

    const { data: org } = await admin
      .from('org_settings')
      .select('org_name, verify_base_url, logo_url, signatory_name, signatory_title, signatory_image_url, support_email')
      .single();
    const appUrl = String(org?.verify_base_url ?? '').replace(/\/+$/, '');

    const html = emailShell(
      toHtml(body) + (appUrl ? `<p style="margin:18px 0 0">${emailButton(`${appUrl}/app/careers`, 'Open my applications')}</p>` : ''),
      org,
    );
    const res = await sendEmail({ to: person.email, subject: subj, html });

    await admin.from('careers_events').insert({
      application_id,
      actor: caller.id,
      kind: 'email',
      note: `${res.sent ? 'Email sent' : 'Email NOT sent'}: ${subj}`.slice(0, 300),
      visible_to_student: false,
    });
    return json({ sent: res.sent, skipped: res.skipped ?? null });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
