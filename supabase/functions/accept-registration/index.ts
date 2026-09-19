import {
  adminClient,
  cors,
  emailButton,
  emailKeyValueCard,
  emailShell,
  HttpError,
  json,
  randomPassword,
  requireUser,
  sendEmail,
} from '../_shared/common.ts';

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

    const { registration_id, course_ids, review_note, payment } = await req.json();
    if (!registration_id) throw new HttpError(400, 'registration_id is required.');

    const { data: reg } = await admin.from('registrations').select('*').eq('id', registration_id).single();
    if (!reg) throw new HttpError(404, 'Registration not found.');
    if (reg.status !== 'pending') throw new HttpError(409, 'This registration was already reviewed.');

    // persist any payment details sent with the accept, then enforce the gate
    const payStatus = payment?.status ?? reg.payment_status;
    if (payStatus === 'unpaid') throw new HttpError(402, 'Payment must be recorded (paid or waived) before accepting.');
    const payPatch: Record<string, unknown> = {};
    if (payment) {
      payPatch.payment_status = payStatus;
      payPatch.payment_amount = payment.amount ?? reg.payment_amount ?? null;
      payPatch.payment_ref = payment.ref ?? reg.payment_ref ?? null;
      payPatch.payment_method = payment.method ?? reg.payment_method ?? null;
      payPatch.paid_at = payStatus === 'paid' ? new Date().toISOString() : reg.paid_at ?? null;
      payPatch.paid_by = caller.id;
    }

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

    // issue + email the student ID card (idempotent — a no-op if this student already has one)
    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-id-card`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ student_id: profileId, course_id: courses[0] ?? null }),
      });
      if (!res.ok) console.error('generate-id-card failed', res.status, await res.text());
    } catch (e) {
      console.error('generate-id-card call failed', e);
    }

    await admin
      .from('registrations')
      .update({
        status: 'accepted',
        reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(),
        review_note: review_note ?? null,
        created_profile_id: profileId,
        ...payPatch,
      })
      .eq('id', registration_id);

    const { data: org } = await admin.from('org_settings').select('org_name, verify_base_url, logo_url').single();
    const appUrl = String(org?.verify_base_url ?? '').replace(/\/+$/, '');
    const orgName = org?.org_name ?? 'EgireRobotics';
    const logoUrl = org?.logo_url ?? null;

    await admin.from('notifications').insert({
      recipient_id: profileId,
      title: `Welcome to ${orgName}`,
      body: courses.length
        ? `Your account is active. You have access to ${courses.length} course${courses.length > 1 ? 's' : ''}.`
        : 'Your account is active.',
      kind: 'account_created',
      link: '/app',
    });

    const safeName = String(reg.full_name || 'there').replace(/</g, '&lt;');
    const firstName = safeName.split(' ')[0] || 'there';
    const coursesLine = courses.length
      ? `<p style="margin:0 0 16px;color:#444">You now have access to <strong>${courses.length}</strong> course${courses.length > 1 ? 's' : ''}.</p>`
      : '';
    const loginUrl = `${appUrl}/login`;

    let emailSent = false;
    let emailSkip: string | undefined;
    if (isNew && tempPassword) {
      const res = await sendEmail({
        to: email,
        subject: `Welcome to ${orgName} — your account is ready`,
        html: emailShell(
          `<h1 style="font-size:20px;margin:0 0 14px;color:#0a0a0a">Welcome to ${orgName} 🚁</h1>` +
            `<p style="margin:0 0 16px;color:#444">Hi ${firstName}, your registration has been accepted and your student account is ready.</p>` +
            coursesLine +
            `<p style="margin:0 0 4px;color:#444">Use these details to sign in:</p>` +
            emailKeyValueCard([
              { label: 'Email', value: email, mono: true },
              { label: 'Temporary password', value: tempPassword, mono: true, big: true },
            ]) +
            `<p style="margin:0 0 18px;color:#666;font-size:13px">For your security you'll be asked to set your own password the first time you sign in.</p>` +
            `<p style="margin:0 0 6px">${emailButton(loginUrl, 'Log in to your account')}</p>` +
            `<p style="margin:14px 0 0;color:#9a9a9a;font-size:12px">Or paste this link into your browser:<br/>${loginUrl}</p>`,
          logoUrl,
        ),
      });
      emailSent = res.sent;
      emailSkip = res.skipped;
    } else {
      // account already existed — confirm the updated access, no password
      const res = await sendEmail({
        to: email,
        subject: `Your ${orgName} access has been updated`,
        html: emailShell(
          `<h1 style="font-size:20px;margin:0 0 14px;color:#0a0a0a">Access updated</h1>` +
            `<p style="margin:0 0 16px;color:#444">Hi ${firstName}, your registration has been accepted.</p>` +
            coursesLine +
            `<p style="margin:0 0 18px;color:#444">Sign in with your existing password to get started.</p>` +
            `<p style="margin:0">${emailButton(loginUrl, 'Log in')}</p>`,
          logoUrl,
        ),
      });
      emailSent = res.sent;
      emailSkip = res.skipped;
    }

    return json({
      profile_id: profileId,
      email,
      granted_courses: courses.length,
      account_created: isNew,
      email_sent: emailSent,
      email_skip: emailSkip ?? null,
      // returned only when we couldn't email it, so the admin can pass it on
      temp_password: isNew && !emailSent ? tempPassword : null,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
