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

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Staff with Write access to Course Groups (always a super admin): add people straight from their email address, with no registration form.
 * Each email either matches an existing student account or gets a new one (temporary password,
 * emailed). Everyone is then put into the chosen course groups (batches) and enrolled in every course
 * those groups hold, plus any extra courses picked.
 * Body: { people: [{ email, full_name? }], group_ids?: string[], course_ids?: string[] }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const caller = await requireUser(req, admin);
    const { data: me } = await admin.from('profiles').select('role').eq('id', caller.id).single();
    if (!me || !['instructor', 'coordinator', 'admin', 'super_admin'].includes(me.role)) throw new HttpError(403, 'Forbidden.');
    // Same rule as the app: everyone but a super admin needs Write on Course Groups.
    if (me.role !== 'super_admin') {
      const { data: access } = await admin.from('role_module_access').select('access_level').eq('role', me.role).eq('module_key', 'course-groups').maybeSingle();
      if ((access?.access_level ?? 'read') !== 'write') throw new HttpError(403, 'You need Write access to Course Groups to add people.');
    }

    const body = await req.json();
    const people: { email?: string; full_name?: string }[] = Array.isArray(body.people) ? body.people : [];
    const groupIds: string[] = (Array.isArray(body.group_ids) ? body.group_ids : []).filter((g: unknown) => typeof g === 'string' && UUID.test(g));
    const extraCourseIds: string[] = (Array.isArray(body.course_ids) ? body.course_ids : []).filter((c: unknown) => typeof c === 'string' && UUID.test(c));
    if (!people.length) throw new HttpError(400, 'Add at least one email address.');
    if (people.length > 100) throw new HttpError(400, 'Add at most 100 people at a time.');
    if (groupIds.length > 50 || extraCourseIds.length > 50) throw new HttpError(400, 'Too many groups or courses selected.');

    // courses to grant: everything the chosen groups hold, plus the extras
    const { data: groups } = groupIds.length ? await admin.from('course_groups').select('id, name').in('id', groupIds) : { data: [] };
    const validGroupIds = (groups ?? []).map((g) => g.id);
    const { data: groupCourses } = validGroupIds.length
      ? await admin.from('course_group_courses').select('course_id').in('group_id', validGroupIds)
      : { data: [] };
    const { data: extraCourses } = extraCourseIds.length ? await admin.from('courses').select('id').in('id', extraCourseIds) : { data: [] };
    const courseIds = [...new Set([...(groupCourses ?? []).map((c) => c.course_id), ...(extraCourses ?? []).map((c) => c.id)])];

    const { data: org } = await admin
      .from('org_settings')
      .select('org_name, verify_base_url, logo_url, signatory_name, signatory_title, signatory_image_url, support_email')
      .single();
    const appUrl = String(org?.verify_base_url ?? '').replace(/\/+$/, '');
    const orgName = org?.org_name ?? 'EgireRobotics';
    const loginUrl = `${appUrl}/login`;

    const results: { email: string; outcome: 'created' | 'existing' | 'skipped'; note?: string; email_sent?: boolean; temp_password?: string }[] = [];
    const seen = new Set<string>();

    for (const person of people) {
      const email = String(person.email ?? '').trim().toLowerCase();
      const fullName = String(person.full_name ?? '').trim().slice(0, 120);
      if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.push({ email: email || '(blank)', outcome: 'skipped', note: 'Not a valid email address.' });
        continue;
      }
      if (seen.has(email)) continue;
      seen.add(email);

      const { data: existing } = await admin.from('profiles').select('id, role, status, archived_at, full_name').eq('email', email).maybeSingle();
      let profileId: string;
      let outcome: 'created' | 'existing' = 'existing';
      let tempPassword: string | null = null;

      if (existing) {
        if (existing.archived_at || existing.status === 'suspended') {
          results.push({ email, outcome: 'skipped', note: 'This account is suspended or deleted. Restore it from Users first.' });
          continue;
        }
        if (existing.role !== 'student') {
          results.push({ email, outcome: 'skipped', note: `This email belongs to a ${existing.role.replace('_', ' ')} account, not a student.` });
          continue;
        }
        profileId = existing.id;
        if (existing.status !== 'active') await admin.from('profiles').update({ status: 'active' }).eq('id', profileId);
      } else {
        tempPassword = randomPassword();
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (cErr || !created.user) {
          results.push({ email, outcome: 'skipped', note: cErr?.message ?? 'Could not create the account.' });
          continue;
        }
        profileId = created.user.id;
        outcome = 'created';
        await admin.from('profiles').upsert({ id: profileId, email, full_name: fullName }, { onConflict: 'id' });
        await admin.from('profiles').update({ role: 'student', status: 'active', full_name: fullName, must_change_password: true }).eq('id', profileId);
      }

      for (const gid of validGroupIds) {
        await admin.from('course_group_members').upsert({ group_id: gid, student_id: profileId, added_by: caller.id }, { onConflict: 'group_id,student_id' });
      }
      if (courseIds.length) {
        await admin.from('enrollments').upsert(
          courseIds.map((course_id) => ({ student_id: profileId, course_id, status: 'active' as const, enrolled_by: caller.id })),
          { onConflict: 'student_id,course_id' },
        );
      }

      const groupNames = (groups ?? []).map((g) => g.name).join(', ');
      await admin.from('notifications').insert({
        recipient_id: profileId,
        title: outcome === 'created' ? `Welcome to ${orgName}` : `You have new course access`,
        body: courseIds.length
          ? `You now have access to ${courseIds.length} course${courseIds.length > 1 ? 's' : ''}${groupNames ? ` (${groupNames})` : ''}.`
          : 'Your account is active.',
        kind: 'account_created',
        link: '/app',
      });

      const result: (typeof results)[number] = { email, outcome };
      if (outcome === 'created' && tempPassword) {
        const first = esc(fullName.split(' ')[0] || 'there');
        const sent = await sendEmail({
          to: email,
          subject: `Welcome to ${orgName} — your account is ready`,
          html: emailShell(
            `<h1 style="font-size:20px;margin:0 0 14px;color:#0a0a0a">Welcome to ${esc(orgName)} 🚁</h1>` +
              `<p style="margin:0 0 16px;color:#444">Hi ${first}, your student account is ready.</p>` +
              (courseIds.length
                ? `<p style="margin:0 0 16px;color:#444">You now have access to <strong>${courseIds.length}</strong> course${courseIds.length > 1 ? 's' : ''}.</p>`
                : '') +
              `<p style="margin:0 0 4px;color:#444">Use these details to sign in:</p>` +
              emailKeyValueCard([
                { label: 'Email', value: email, mono: true },
                { label: 'Temporary password', value: tempPassword, mono: true, big: true },
              ]) +
              `<p style="margin:0 0 18px;color:#666;font-size:13px">For your security you'll be asked to set your own password the first time you sign in.</p>` +
              `<p style="margin:0 0 6px">${emailButton(loginUrl, 'Log in to your account')}</p>`,
            org,
          ),
        });
        result.email_sent = sent.sent;
        // handed back only when the email could not go out, so the admin can pass it on
        if (!sent.sent) result.temp_password = tempPassword;
      }
      results.push(result);
    }

    return json({
      created: results.filter((r) => r.outcome === 'created').length,
      existing: results.filter((r) => r.outcome === 'existing').length,
      skipped: results.filter((r) => r.outcome === 'skipped').length,
      granted_courses: courseIds.length,
      results,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
