import { adminClient, cors, HttpError, json, requireUser } from '../_shared/common.ts';

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

    // ---- bulk CSV import (staff only) ------------------------------------
    if (payload.source === 'csv' && Array.isArray(payload.rows)) {
      const user = await requireUser(req, admin);
      const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single();
      if (!me || !['instructor', 'super_admin'].includes(me.role)) throw new HttpError(403, 'Forbidden.');

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
    const cleanEmail = String(email ?? '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) throw new HttpError(400, 'A valid email is required.');
    if (!String(full_name ?? '').trim()) throw new HttpError(400, 'Your name is required.');
    if (!form_slug) throw new HttpError(400, 'Missing form.');

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
