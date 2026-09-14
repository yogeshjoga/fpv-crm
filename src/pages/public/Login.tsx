import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AuthCard } from '../../layout/PublicShell';
import { Button, Field, PasswordInput, TextInput } from '../../components/ui/kit';

export function Login() {
  const { signIn, isAuthed, profile, isStaff } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) return setError(error);
    // navigation happens via the <Navigate> below once auth state propagates
  };

  if (isAuthed && profile) {
    if (profile.must_change_password) return <Navigate to="/set-password" replace />;
    return <Navigate to={isStaff ? '/admin' : '/app'} replace />;
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to continue your training">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" error={error}>
          <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <div className="text-right">
          <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Want to join a course?{' '}
        <Link to="/register" className="font-medium text-blue-600 hover:underline">
          Register here
        </Link>
      </p>
    </AuthCard>
  );
}
