import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { AuthCard } from '../../layout/PublicShell';
import { Button, Field, PasswordInput } from '../../components/ui/kit';

/** Forced password change for accounts created by an admin with a temp password. */
export function SetPassword() {
  const { isAuthed, profile, session, isStaff, updatePassword, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const home = isStaff ? '/admin' : '/app';

  if (!isAuthed) return <Navigate to="/login" replace />;
  if (profile && !profile.must_change_password) return <Navigate to={home} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setError('Use at least 8 characters.');
    if (pw !== pw2) return setError('Passwords do not match.');
    setBusy(true);
    setError(null);
    const { error } = await updatePassword(pw);
    if (error) {
      setBusy(false);
      return setError(error);
    }
    await supabase.from('profiles').update({ must_change_password: false }).eq('id', session!.user.id);
    await refreshProfile();
    setBusy(false);
    navigate(home, { replace: true });
  };

  return (
    <AuthCard title="Choose your password" subtitle="Set a new password to finish setting up your account">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password">
          <PasswordInput required value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label="Confirm new password" error={error}>
          <PasswordInput required value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        <Button type="submit" loading={busy} className="w-full">
          Save and continue
        </Button>
      </form>
    </AuthCard>
  );
}
