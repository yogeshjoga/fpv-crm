import { adminClient, cors, HttpError, json } from '../_shared/common.ts';

/**
 * Webhook for Google Forms (via an Apps Script onSubmit trigger).
 * Auth: ?secret=<org_settings.google_form_secret> or header x-webhook-secret.
 * Body: { full_name, email, phone?, answers? }  (Apps Script maps the form fields)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const url = new URL(req.url);
    const provided = url.searchParams.get('secret') ?? req.headers.get('x-webhook-secret') ?? '';

    const { data: org } = await admin.from('org_settings').select('google_form_secret').single();
    if (!org || !provided || provided !== org.google_form_secret) throw new HttpError(401, 'Invalid webhook secret.');

    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) throw new HttpError(400, 'A valid email is required.');

    const { data: dup } = await admin
      .from('registrations')
      .select('id')
      .ilike('email', email)
      .eq('status', 'pending')
      .maybeSingle();
    if (dup) {
      await admin
        .from('registrations')
        .update({
          full_name: String(body.full_name ?? '').trim() || undefined,
          phone: body.phone ? String(body.phone) : undefined,
          answers: body.answers ?? {},
        })
        .eq('id', dup.id);
      return json({ ok: true, updated: true });
    }

    const { error } = await admin.from('registrations').insert({
      source: 'google_form',
      full_name: String(body.full_name ?? '').trim(),
      email,
      phone: body.phone ? String(body.phone) : null,
      answers: body.answers ?? {},
    });
    if (error) throw new HttpError(500, error.message);
    return json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
