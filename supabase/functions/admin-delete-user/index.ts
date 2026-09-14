import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { adminClient, cors, HttpError, json, requireUser } from '../_shared/common.ts';

/**
 * Super-admin only: soft-delete (or restore) a user account.
 *
 * Soft delete = profiles.archived_at set + status forced to 'suspended'
 * (blocks every RLS-gated read/write via is_active_user()) + the auth user
 * is banned (blocks even a fresh login). Nothing is removed — enrollments,
 * exam attempts and certificates all stay exactly as they were.
 *
 * Guardrails: can't delete yourself, can't delete the last super_admin, and
 * deleting requires the caller's own current password as a step-up
 * confirmation (verified server-side, never trusted from the client alone).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const admin = adminClient();
    const caller = await requireUser(req, admin);
    const { data: me } = await admin.from('profiles').select('role, email').eq('id', caller.id).single();
    if (me?.role !== 'super_admin') throw new HttpError(403, 'Only a super admin can delete users.');

    const { user_id, confirm_password, restore } = await req.json();
    if (!user_id) throw new HttpError(400, 'user_id is required.');

    if (restore) {
      const { error: upErr } = await admin
        .from('profiles')
        .update({ archived_at: null, archived_by: null })
        .eq('id', user_id);
      if (upErr) throw new HttpError(500, upErr.message);
      await admin.auth.admin.updateUserById(user_id, { ban_duration: 'none' });
      return json({ restored: true });
    }

    if (user_id === caller.id) throw new HttpError(400, 'You cannot delete your own account.');

    // Step-up confirmation: verify the caller's own current password.
    if (!confirm_password?.trim()) throw new HttpError(400, 'Confirm your password to continue.');
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { error: pwErr } = await anon.auth.signInWithPassword({ email: me!.email, password: confirm_password });
    if (pwErr) throw new HttpError(401, 'Incorrect password.');

    const { data: target } = await admin.from('profiles').select('role, archived_at').eq('id', user_id).single();
    if (!target) throw new HttpError(404, 'User not found.');
    if (target.archived_at) return json({ already_deleted: true });

    if (target.role === 'super_admin') {
      const { count } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin')
        .is('archived_at', null)
        .neq('id', user_id);
      if (!count) throw new HttpError(400, 'Cannot delete the last active super admin.');
    }

    const { error: delErr } = await admin
      .from('profiles')
      .update({ archived_at: new Date().toISOString(), archived_by: caller.id, status: 'suspended' })
      .eq('id', user_id);
    if (delErr) throw new HttpError(500, delErr.message);

    // ~100 years: effectively permanent until explicitly restored.
    await admin.auth.admin.updateUserById(user_id, { ban_duration: '876000h' });

    return json({ deleted: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
