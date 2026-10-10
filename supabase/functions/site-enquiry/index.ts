import { adminClient, clientIp, cors, emailKeyValueCard, emailShell, HttpError, json, rateLimit, sendEmail, verifyCaptcha } from '../_shared/common.ts';

// emailKeyValueCard escapes its values, so text a visitor typed cannot become markup in the email sent to staff.
const oneLine = (s: unknown) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();

const KINDS: Record<string, string> = {
  student: 'Student or parent',
  college: 'College or university',
  demo: 'Free demo session',
  general: 'General enquiry',
};

/**
 * Public enquiry intake for the marketing website.
 * Body: { kind, full_name, phone?, email?, organisation?, interest?, message?, consent, source_page?, website?, captcha? }
 *  - `website` is a honeypot: real visitors never fill it, so a filled value is dropped silently.
 *  - The row is written with the service role; the table itself is closed to the public.
 *  - Admins get an in-app notification and an email. Nothing is emailed to the visitor, so this endpoint
 *    cannot be used to send mail to someone else.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const raw = await req.text();
    if (raw.length > 12_000) throw new HttpError(413, 'That message is too long.');
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'Invalid request.');
    }

    // Bots fill every field. Pretend it worked so they learn nothing.
    if (String(body.website ?? '').trim()) return json({ ok: true });

    const admin = adminClient();
    const ip = clientIp(req);
    await rateLimit(admin, 'site-enquiry-ip', ip, 6, 10 * 60);
    await verifyCaptcha(body.captcha, ip);

    const kind = String(body.kind ?? '');
    if (!KINDS[kind]) throw new HttpError(400, 'Please choose what the enquiry is about.');

    const fullName = oneLine(body.full_name).slice(0, 120);
    if (!fullName) throw new HttpError(400, 'Please enter your name.');

    const email = String(body.email ?? '').trim().toLowerCase().slice(0, 200) || null;
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Please enter a valid email address.');

    // Phone numbers are typed many ways (+91 85001-26104, (0891) 123 4567): keep the digits and a leading +.
    const phoneRaw = String(body.phone ?? '').trim();
    const digits = phoneRaw.replace(/\D/g, '');
    const phone = phoneRaw ? `${phoneRaw.startsWith('+') ? '+' : ''}${digits}` : null;
    if (phone && (digits.length < 7 || digits.length > 15)) throw new HttpError(400, 'Please enter a valid phone number.');
    if (!phone && !email) throw new HttpError(400, 'Please give a phone number or an email so we can reach you.');

    if (body.consent !== true) throw new HttpError(400, 'Please agree to be contacted about this enquiry.');

    const organisation = oneLine(body.organisation).slice(0, 200);
    if (kind === 'college' && !organisation) throw new HttpError(400, 'Please enter your college or university.');
    const interest = oneLine(body.interest).slice(0, 200);
    const message = String(body.message ?? '').trim().slice(0, 2000);
    const sourcePage = oneLine(body.source_page).slice(0, 200);

    // The same person re-submitting repeatedly is limited separately from the network they are on.
    await rateLimit(admin, 'site-enquiry-contact', phone ?? email ?? ip, 3, 60 * 60);

    const { data: row, error } = await admin
      .from('site_enquiries')
      .insert({ kind, full_name: fullName, email, phone, organisation, interest, message, source_page: sourcePage })
      .select('id')
      .single();
    if (error || !row) {
      console.error('enquiry insert failed', error?.message);
      throw new HttpError(500, 'We could not save your enquiry. Please call us instead.');
    }

    // Notifying staff is best effort: the enquiry is already saved, so a mail problem must not fail the visitor.
    try {
      const { data: org } = await admin
        .from('org_settings')
        .select('org_name, logo_url, verify_base_url, signatory_name, signatory_title, signatory_image_url, support_email')
        .single();
      const appUrl = String(org?.verify_base_url ?? '').replace(/\/+$/, '');
      const { data: staff } = await admin.from('profiles').select('id, email').in('role', ['admin', 'super_admin']).eq('status', 'active');

      const title = `New enquiry: ${fullName}`;
      const summary = [KINDS[kind], interest, organisation].filter(Boolean).join(' · ');
      for (const s of staff ?? []) {
        await admin.from('notifications').insert({
          recipient_id: s.id,
          title,
          body: summary,
          kind: 'enquiry_new',
          link: '/admin/enquiries',
        });
        if (s.email) {
          await sendEmail({
            to: s.email,
            subject: `New website enquiry: ${oneLine(fullName)}`,
            html: emailShell(
              `<p>A new enquiry has arrived from the website.</p>` +
                emailKeyValueCard(
                  [
                    { label: 'Type', value: KINDS[kind] },
                    { label: 'Name', value: fullName },
                    ...(phone ? [{ label: 'Phone', value: phone }] : []),
                    ...(email ? [{ label: 'Email', value: email }] : []),
                    ...(organisation ? [{ label: 'College / organisation', value: organisation }] : []),
                    ...(interest ? [{ label: 'Interested in', value: interest }] : []),
                    ...(message ? [{ label: 'Message', value: message }] : []),
                  ],
                ) +
                `<p><a href="${appUrl}/admin/enquiries">Open the enquiries inbox</a></p>`,
              org,
            ),
          });
        }
      }
    } catch (e) {
      console.error('enquiry notification failed', (e as Error)?.message);
    }

    return json({ ok: true });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('site-enquiry error', (e as Error)?.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
