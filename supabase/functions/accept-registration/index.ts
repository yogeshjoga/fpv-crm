import { adminClient, cors, HttpError, json, randomPassword, requireUser, sendEmail } from '../_shared/common.ts';

/**
 * Staff: accept a registration -> create (or reuse) the student account,
 * grant the chosen courses, email temp credentials, mark it accepted.
 * Body: { registration_id, course_ids: string[], review_note? }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const caller = await requireUser(req, admin);
    const { data: me } = await admin.from('profiles').select('role').eq('id', caller.id).single();
    if (!me || !['instructor', 'super_admin'].includes(me.role)) throw new HttpError(403, 'Forbidden.');

    const { registration_id, course_ids, review_note } = await req.json();
    if (!registration_id) throw new HttpError(400, 'registration_id is required.');

    const { data: reg } = await admin.from('registrations').select('*').eq('id', registration_id).single();
    if (!reg) throw new HttpError(404, 'Registration not found.');
    if (reg.status !== 'pending') throw new HttpError(409, 'This registration was already reviewed.');

    const email = String(reg.email).trim().toLowerCase();
    const courses: string[] = Array.isArray(course_ids) && course_ids.length
      ? course_ids
      : reg.requested_course_id
        ? [reg.requested_course_id]
        : [];

    // reuse an existing account with this email if there is one
    const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();

    let profileId: string;
    let tempPassword: string | null = null;
    let isNew = false;

    if (existing) {
      profileId = existing.id;
      await admin.from('profiles').update({ status: 'active', full_name: reg.full_name || undefined }).eq('id', profileId);
    } else {
      tempPassword = randomPassword();
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: reg.full_name ?? '' },
      });
      if (cErr || !created.user) throw new HttpError(400, cErr?.message ?? 'Could not create the account.');
      profileId = created.user.id;
      isNew = true;
      await admin.from('profiles').upsert({ id: profileId, email, full_name: reg.full_name ?? '' }, { onConflict: 'id' });
      await admin
        .from('profiles')
        .update({ role: 'student', status: 'active', full_name: reg.full_name ?? '', phone: reg.phone, must_change_password: true })
        .eq('id', profileId);
    }

    // grant courses
    for (const cid of courses) {
      await admin
        .from('enrollments')
        .upsert({ student_id: profileId, course_id: cid, status: 'active', enrolled_by: caller.id }, { onConflict: 'student_id,course_id' });
    }

    await admin
      .from('registrations')
      .update({
        status: 'accepted',
        reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(),
        review_note: review_note ?? null,
        created_profile_id: profileId,
      })
      .eq('id', registration_id);

    const { data: org } = await admin.from('org_settings').select('org_name, verify_base_url').single();
    const appUrl = String(org?.verify_base_url ?? '').replace(/\/+$/, '');
    const orgName = org?.org_name ?? 'EgireRobotics';

    await admin.from('notifications').insert({
      recipient_id: profileId,
      title: `Welcome to ${orgName}`,
      body: courses.length
        ? `Your account is active. You have access to ${courses.length} course${courses.length > 1 ? 's' : ''}.`
        : 'Your account is active.',
      kind: 'account_created',
      link: '/app',
    });

    let emailSent = false;
    if (isNew && tempPassword) {
      const res = await sendEmail({
        to: email,
        subject: `Your ${orgName} account is ready`,
        html:
          `<div style='font-family:system-ui,Arial,sans-serif;max-width:520px'>` +
          `<p>Hi ${(reg.full_name || 'there').replace(/</g, '&lt;')},</p>` +
          `<p>Your registration has been accepted. Sign in with:</p>` +
          `<p><strong>Email:</strong> ${email}<br/><strong>Temporary password:</strong> <code>${tempPassword}</code></p>` +
          `<p>You'll be asked to choose a new password on first sign-in.</p>` +
          `<p><a href='${appUrl}/login'>Sign in</a></p>` +
          `<p style='color:#888;font-size:13px'>${orgName}</p></div>`,
      });
      emailSent = res.sent;
    }

    return json({
      profile_id: profileId,
      email,
      granted_courses: courses.length,
      account_created: isNew,
      email_sent: emailSent,
      // returned only when we couldn't email it, so the admin can pass it on
      temp_password: isNew && !emailSent ? tempPassword : null,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
