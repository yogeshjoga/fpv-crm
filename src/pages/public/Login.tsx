import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AuthCard } from '../../layout/PublicShell';
import { Button, Field, TextInput } from '../../components/ui/kit';

export function Login() {
  const { signIn, signInWithGoogle, isAuthed } = useAuth();
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

  if (isAuthed) return <Navigate to="/app" replace />;

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to continue your training">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" error={error}>
          <TextInput type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
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

      <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" /> OR <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <Button variant="secondary" className="w-full" onClick={() => signInWithGoogle()}>
        <img src="https://www.google.com/favicon.ico" alt="" className="h-4 w-4" /> Continue with Google
      </Button>

      <p className="mt-6 text-center text-sm text-neutral-500">
        New here?{' '}
        <Link to="/register" className="font-medium text-blue-600 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
