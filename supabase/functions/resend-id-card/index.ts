import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { adminClient, cors, emailShell, HttpError, json, requireUser, sendEmail } from '../_shared/common.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Staff: re-send an already-generated ID card PDF to its student, unchanged.
 * Body: { id_card_id }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const caller = await requireUser(req, admin);
    const { data: me } = await admin.from('profiles').select('role').eq('id', caller.id).single();
    if (!me || !['instructor', 'super_admin'].includes(me.role)) throw new HttpError(403, 'Forbidden.');

    const { id_card_id } = await req.json();
    if (!id_card_id) throw new HttpError(400, 'id_card_id is required.');

    const { data: card } = await admin.from('id_cards').select('*').eq('id', id_card_id).single();
    if (!card) throw new HttpError(404, 'ID card not found.');

    const [{ data: org }, { data: student }] = await Promise.all([
      admin.from('org_settings').select('org_name, logo_url, signatory_name, signatory_title, signatory_image_url, support_email').single(),
      admin.from('profiles').select('full_name, email').eq('id', card.student_id).single(),
    ]);
    if (!student) throw new HttpError(404, 'Student not found.');

    const dl = await admin.storage.from('id-cards').download(card.pdf_path);
    if (dl.error || !dl.data) throw new HttpError(500, `Storage: ${dl.error?.message ?? 'could not read the card PDF'}`);
    const pdfBytes = new Uint8Array(await dl.data.arrayBuffer());

    const orgName = org?.org_name ?? 'EgireRobotics';
    const typeLabel = card.card_type === 'coordinator' ? 'coordinator' : card.card_type === 'volunteer' ? 'volunteer' : 'student';
    const validUntil = card.valid_until
      ? new Date(card.valid_until).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : null;

    const res = await sendEmail({
      to: student.email,
      subject: `Your ${orgName} ${typeLabel} ID card (resent)`,
      html: emailShell(
        `<h1 style="font-size:20px;margin:0 0 12px;color:#0a0a0a">Hi ${esc(student.full_name || 'there')} 🪪</h1>` +
          `<p style="margin:0 0 16px;color:#444">Here's your ${typeLabel} ID card <strong>${esc(card.card_number)}</strong> again — front and back on one PDF.</p>` +
          (validUntil ? `<p style="margin:0 0 16px;color:#444">It's valid until ${validUntil}.</p>` : ''),
        org,
      ),
      attachments: [{ filename: `${card.card_number}.pdf`, content: encodeBase64(pdfBytes) }],
    });

    if (!res.sent) throw new HttpError(502, `Could not send the email (${res.skipped ?? 'unknown error'}).`);

    await admin.from('id_cards').update({ last_emailed_at: new Date().toISOString() }).eq('id', id_card_id);

    return json({ sent: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
