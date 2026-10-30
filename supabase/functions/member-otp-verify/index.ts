import { adminClient, clientIp, cors, HttpError, json, rateLimit } from '../_shared/common.ts';
import { hashCode, likeExact, normaliseEmail, sameHash, STAFF_ROLES } from '../_shared/member.ts';

/**
 * Checks the code mailed by member-otp-send and opens a session for the website.
 * Body: { email, code }
 * Returns { ok, token_hash, new_user }. The browser then calls supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
 *  - A new person is created here, with app_metadata.provisioned = true, so the database's sign-up guard still protects every other door.
 *  - An address that already belongs to a CRM student signs into that same account.
 *  - Staff and suspended accounts are refused.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const raw = await req.text();
    if (raw.length > 2_000) throw new HttpError(413, 'That request is too large.');
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'Invalid request.');
    }
    const admin = adminClient();
    const ip = clientIp(req);
    await rateLimit(admin, 'member-otp-verify-ip', ip, 30, 10 * 60);
    const email = normaliseEmail(body.email);
    const code = String(body.code ?? '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Please enter the 6-digit code.');
    await rateLimit(admin, 'member-otp-verify-email', email, 12, 10 * 60);

    const bad = new HttpError(400, 'That code is not right or has expired. Please ask for a new one.');
    const { data: row } = await admin
      .from('member_login_codes')
      .select('id, code_hash, attempts, expires_at, consumed_at')
      .eq('email', email)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) throw bad;
    if (row.attempts >= 5) throw new HttpError(429, 'Too many wrong codes. Please ask for a new one.');
    await admin.from('member_login_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id);
    if (!sameHash(row.code_hash, await hashCode(email, code))) throw bad;
    await admin.from('member_login_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);

    const { data: prof } = await admin.from('profiles').select('id, role, status, archived_at').ilike('email', likeExact(email)).maybeSingle();
    if (prof && STAFF_ROLES.includes(prof.role)) throw new HttpError(400, 'Staff accounts sign in through the CRM.');
    if (prof && (prof.archived_at || prof.status === 'suspended')) throw new HttpError(400, 'This account cannot sign in. Please contact us.');

    let isNew = false;
    if (!prof) {
      const { error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { provisioned: true, source: 'email_otp' },
      });
      if (error) {
        console.error('createUser failed', error.message);
        throw new HttpError(500, 'We could not create your account. Please try again.');
      }
      isNew = true;
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error('generateLink failed', linkError?.message);
      throw new HttpError(500, 'We could not sign you in. Please try again.');
    }
    return json({ ok: true, token_hash: tokenHash, new_user: isNew });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('member-otp-verify error', (e as Error)?.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
