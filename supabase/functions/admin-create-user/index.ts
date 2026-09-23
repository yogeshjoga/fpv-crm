import { adminClient, cors, emailButton, emailShell, HttpError, json, requireUser, sendEmail } from '../_shared/common.ts';

/** Super-admin only: create a staff (or student) account and send a set-password link. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const caller = await requireUser(req, admin);
    const { data: me } = await admin.from('profiles').select('role').eq('id', caller.id).single();
    if (me?.role !== 'super_admin') throw new HttpError(403, 'Only a super admin can add users.');

    const { email, full_name, role, department, designation, joined_on } = await req.json();
    if (!email?.trim()) throw new HttpError(400, 'Email is required.');
    const wantRole = ['student', 'instructor', 'admin', 'super_admin'].includes(role) ? role : 'instructor';

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: email.trim(),
      email_confirm: true,
      user_metadata: { full_name: full_name ?? '' },
    });
    if (cErr || !created.user) throw new HttpError(400, cErr?.message ?? 'Could not create the user.');
    const uid = created.user.id;

    // the on-auth-user trigger inserts the profile; make sure it exists, then elevate
    await admin.from('profiles').upsert({ id: uid, email: email.trim(), full_name: full_name ?? '' }, { onConflict: 'id' });
    await admin.from('profiles').update({ role: wantRole, status: 'active', full_name: full_name ?? '' }).eq('id', uid);

    if (wantRole !== 'student') {
      await admin.from('staff_details').upsert(
        {
          profile_id: uid,
          department: department ?? '',
          designation: designation ?? '',
          joined_on: joined_on || null,
        },
        { onConflict: 'profile_id' },
      );
    }

    // build a set-password link
    let inviteLink: string | null = null;
    const { data: link } = await admin.auth.admin.generateLink({ type: 'recovery', email: email.trim() });
    inviteLink = link?.properties?.action_link ?? null;

    const { data: org } = await admin
      .from('org_settings')
      .select('org_name, logo_url, signatory_name, signatory_title, signatory_image_url, support_email')
      .single();
    const orgName = org?.org_name ?? 'EgireRobotics';
    const firstName = String(full_name ?? 'there').replace(/</g, '&lt;').split(' ')[0] || 'there';

    const emailRes = await sendEmail({
      to: email.trim(),
      subject: `Your ${orgName} account`,
      html: emailShell(
        `<h1 style="font-size:20px;margin:0 0 14px;color:#0a0a0a">Your ${orgName} account</h1>` +
          `<p style="margin:0 0 16px;color:#444">Hi ${firstName}, an account has been created for you (${wantRole.replace('_', ' ')}). ` +
          `Set your password to sign in:</p>` +
          `<p style="margin:0">${emailButton(inviteLink ?? '', 'Set my password')}</p>`,
        org,
      ),
    });

    return json({
      user_id: uid,
      email_sent: emailRes.sent,
      // surface the link when email could not be sent so the admin can share it manually
      invite_link: emailRes.sent ? null : inviteLink,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
