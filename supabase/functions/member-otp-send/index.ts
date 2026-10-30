import { adminClient, clientIp, cors, emailKeyValueCard, emailShell, HttpError, json, rateLimit, sendEmail } from '../_shared/common.ts';
import { hashCode, likeExact, memberCaptcha, normaliseEmail, STAFF_ROLES } from '../_shared/member.ts';

/**
 * Sends a 6-digit sign-in code to a person's email, for the public website.
 * Body: { email, website?, captcha? }
 *  - `website` is a honeypot: a filled value is dropped silently.
 *  - Rate limited per network and per address; the code lives 10 minutes and allows 5 tries (see member-otp-verify).
 *  - Only a keyed hash of the code is stored.
 *  - Staff and suspended accounts cannot use this door: they sign in through the CRM.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const raw = await req.text();
    if (raw.length > 4_000) throw new HttpError(413, 'That request is too large.');
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'Invalid request.');
    }
    if (String(body.website ?? '').trim()) return json({ ok: true });

    const admin = adminClient();
    const ip = clientIp(req);
    await rateLimit(admin, 'member-otp-ip', ip, 8, 10 * 60);
    await memberCaptcha(body.captcha, ip);
    const email = normaliseEmail(body.email);
    await rateLimit(admin, 'member-otp-email', email, 4, 60 * 60);

    const { data: prof } = await admin.from('profiles').select('role, status, archived_at').ilike('email', likeExact(email)).maybeSingle();
    if (prof && STAFF_ROLES.includes(prof.role)) throw new HttpError(400, 'Staff accounts sign in through the CRM.');
    if (prof && (prof.archived_at || prof.status === 'suspended')) throw new HttpError(400, 'This account cannot sign in. Please contact us.');

    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    await admin.from('member_login_codes').delete().eq('email', email);
    await admin.from('member_login_codes').delete().lt('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    const { error } = await admin.from('member_login_codes').insert({
      email,
      code_hash: await hashCode(email, code),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) {
      console.error('code insert failed', error.message);
      throw new HttpError(500, 'Something went wrong. Please try again.');
    }

    const { data: org } = await admin
      .from('org_settings')
      .select('org_name, logo_url, signatory_name, signatory_title, signatory_image_url, support_email')
      .single();
    const sent = await sendEmail({
      to: email,
      subject: `Your EGIRE Robotics sign-in code: ${code}`,
      html: emailShell(
        `<p>Use this code to sign in to the EGIRE Robotics website. It works for 10 minutes.</p>` +
          emailKeyValueCard([{ label: 'Your sign-in code', value: code, mono: true, big: true }]) +
          `<p style="color:#777;font-size:13px">If you did not ask for this, you can ignore this email. Nobody can sign in without the code.</p>`,
        org,
      ),
    });
    if (!sent.sent) {
      console.error('code email not sent', sent.skipped);
      throw new HttpError(503, 'We could not send the email right now. Please try again in a minute.');
    }
    return json({ ok: true });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('member-otp-send error', (e as Error)?.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
