import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { AuthCard } from '../../layout/PublicShell';
import { Button, Field, PasswordInput } from '../../components/ui/kit';

export function ResetPassword() {
  const { updatePassword, isStaff } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Supabase parses the recovery token from the URL hash and emits a session.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    setError(null);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) return setError(error);
    navigate(isStaff ? '/admin' : '/app');
  };

  return (
    <AuthCard title="Choose a new password">
      {!ready ? (
        <p className="text-sm text-neutral-500">
          Open this page from the reset link in your email. If you did, give it a moment to verify…
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password">
            <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm password" error={error}>
            <PasswordInput required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy} className="w-full">
            Update password
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
