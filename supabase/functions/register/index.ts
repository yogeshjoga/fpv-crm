import { adminClient, clientIp, cors, HttpError, json, rateLimit, requireUser, verifyCaptcha } from '../_shared/common.ts';

const STAFF_ROLES = ['instructor', 'coordinator', 'admin', 'super_admin'];

/**
 * Public registration intake.
 *  - single submit from our public form: { form_slug, full_name, email, phone?, answers? }
 *  - bulk CSV import (staff JWT required): { source: 'csv', rows: [{ full_name, email, phone?, answers?, course_id? }] }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const payload = await req.json();

    // Public endpoint: refuse oversized payloads so the form can't be used to stuff the database.
    if (JSON.stringify(payload).length > 60_000) throw new HttpError(413, 'That submission is too large.');

    // ---- bulk CSV import (staff only) ------------------------------------
    if (payload.source === 'csv' && Array.isArray(payload.rows)) {
      const user = await requireUser(req, admin);
      const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single();
      if (!me || !STAFF_ROLES.includes(me.role)) throw new HttpError(403, 'Forbidden.');

      if (payload.rows.length > 2000) throw new HttpError(413, 'Import at most 2000 rows at a time.');
      let inserted = 0;
      let skipped = 0;
      for (const r of payload.rows) {
        const email = String(r.email ?? '').trim().toLowerCase();
        if (!email || !email.includes('@')) {
          skipped++;
          continue;
        }
        const dup = await pendingExists(admin, email);
        if (dup) {
          skipped++;
          continue;
        }
        const { error } = await admin.from('registrations').insert({
          source: 'csv',
          full_name: String(r.full_name ?? '').trim(),
          email,
          phone: r.phone ? String(r.phone) : null,
          answers: r.answers ?? {},
          requested_course_id: r.course_id ?? null,
        });
        if (error) skipped++;
        else inserted++;
      }
      return json({ ok: true, inserted, skipped });
    }

    // ---- single public form submission ---------------------------------
    const { form_slug, full_name, email, phone, answers } = payload;

    // Bots fill every field; the hidden "website" box is never shown to people. Pretend it worked.
    if (typeof payload.website === 'string' && payload.website.trim()) return json({ ok: true });

    // Slow a single caller down: a few submissions per address and per email, then HTTP 429.
    const ip = clientIp(req);
    await rateLimit(admin, 'register-ip', ip, 8, 10 * 60);
    await rateLimit(admin, 'register-email', String(email ?? '').trim().toLowerCase(), 3, 60 * 60);
    await verifyCaptcha(payload.captcha, ip);

    const cleanEmail = String(email ?? '').trim().toLowerCase();
    if (!cleanEmail || cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new HttpError(400, 'A valid email is required.');
    if (!String(full_name ?? '').trim()) throw new HttpError(400, 'Your name is required.');
    if (String(full_name).length > 120) throw new HttpError(400, 'That name is too long.');
    if (phone && String(phone).length > 30) throw new HttpError(400, 'That phone number is too long.');
    if (!form_slug || String(form_slug).length > 100) throw new HttpError(400, 'Missing form.');
    if (answers !== undefined && answers !== null && (typeof answers !== 'object' || Array.isArray(answers))) throw new HttpError(400, 'Invalid answers.');

    const { data: form } = await admin
      .from('enrollment_forms')
      .select('id, course_id, is_public, is_open, opens_at, closes_at')
      .eq('slug', form_slug)
      .maybeSingle();
    if (!form || !form.is_public || !form.is_open) throw new HttpError(404, 'This registration form is not available.');
    const now = Date.now();
    if ((form.opens_at && new Date(form.opens_at).getTime() > now) || (form.closes_at && new Date(form.closes_at).getTime() < now))
      throw new HttpError(403, 'This registration form is closed.');

    if (await pendingExists(admin, cleanEmail)) return json({ ok: true, duplicate: true });

    // Flood guard: a normal class registers a few dozen people; hundreds in ten minutes is abuse.
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count: recent } = await admin
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'registration_form')
      .gte('created_at', since);
    if ((recent ?? 0) >= 300) throw new HttpError(429, 'Registration is very busy right now. Please try again in a few minutes.');

    const { error } = await admin.from('registrations').insert({
      source: 'registration_form',
      form_id: form.id,
      full_name: String(full_name).trim(),
      email: cleanEmail,
      phone: phone ? String(phone) : null,
      answers: answers ?? {},
      requested_course_id: form.course_id ?? null,
    });
    if (error) throw new HttpError(500, error.message);
    return json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});

async function pendingExists(admin: ReturnType<typeof adminClient>, email: string): Promise<boolean> {
  const { data } = await admin
    .from('registrations')
    .select('id')
    .ilike('email', email)
    .eq('status', 'pending')
    .maybeSingle();
  return !!data;
}
