import { adminClient, cors, HttpError, json } from '../_shared/common.ts';
import { decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

/**
 * Webhook for Google Forms (via an Apps Script onSubmit trigger).
 * Auth: ?secret=<org_settings.google_form_secret> or header x-webhook-secret.
 * Body: { full_name, email, phone?, answers?, files?: [{ q, name, mime, data(base64) }] }
 * File-upload answers are stored in our own `enrollment-uploads` bucket so the
 * review screen can preview them without depending on Google Drive sharing.
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

    const answers: Record<string, unknown> = { ...(body.answers ?? {}) };
    const files: { q: string; name: string; mime?: string; data: string }[] = Array.isArray(body.files) ? body.files : [];

    const { data: dup } = await admin
      .from('registrations')
      .select('id')
      .ilike('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    let regId = dup?.id as string | undefined;

    if (regId) {
      await admin
        .from('registrations')
        .update({
          full_name: String(body.full_name ?? '').trim() || undefined,
          phone: body.phone ? String(body.phone) : undefined,
          answers,
        })
        .eq('id', regId);
    } else {
      const { data: created, error } = await admin
        .from('registrations')
        .insert({
          source: 'google_form',
          full_name: String(body.full_name ?? '').trim(),
          email,
          phone: body.phone ? String(body.phone) : null,
          answers,
        })
        .select('id')
        .single();
      if (error || !created) throw new HttpError(500, error?.message ?? 'insert failed');
      regId = created.id;
    }

    // store uploaded files, then patch the answers with our own paths
    let patched = false;
    for (const f of files) {
      if (!f?.data || !f?.name) continue;
      try {
        const bytes = decodeBase64(f.data);
        const safeName = String(f.name).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
        const path = `google-form/${regId}/${Date.now()}-${safeName}`;
        const up = await admin.storage
          .from('enrollment-uploads')
          .upload(path, bytes, { contentType: f.mime || 'application/octet-stream', upsert: true });
        if (up.error) {
          console.error('file upload failed', up.error.message);
          continue;
        }
        answers[f.q || safeName] = { __file: path, name: safeName, mime: f.mime || '' };
        patched = true;
      } catch (err) {
        console.error('file decode/upload error', err);
      }
    }
    if (patched) await admin.from('registrations').update({ answers }).eq('id', regId);

    return json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
