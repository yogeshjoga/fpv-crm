import { adminClient, cors, HttpError, json, requireUser } from '../_shared/common.ts';

/**
 * Staff: re-send a student's ID card. This regenerates it first (from the
 * card's own saved type/workshop/validity/fee) rather than re-mailing the
 * stored file unchanged — admins were repeatedly confused when "resend"
 * kept delivering a stale design from before a template change, since
 * nothing about the button name suggested it wouldn't pick up updates.
 * To change the type/workshop/dates themselves, use Regenerate instead.
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

    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-id-card`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        student_id: card.student_id,
        course_id: card.course_id,
        card_type: card.card_type,
        workshop_name: card.workshop_name,
        workshop_location: card.workshop_location,
        fee_paid: card.fee_paid,
        valid_from: card.valid_from,
        valid_until: card.valid_until,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new HttpError(res.status, body.error ?? 'Could not rebuild and resend the card.');

    return json({ sent: true, ...body });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
