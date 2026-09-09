import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { AuthCard } from '../../layout/PublicShell';
import { Button, Field, TextInput } from '../../components/ui/kit';

export function Register() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'confirm' | 'in' | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    setError(null);
    const { error, needsConfirmation } = await signUp(email, password, fullName);
    setBusy(false);
    if (error) return setError(error);
    if (needsConfirmation) return setDone('confirm');
    setDone('in');
    setTimeout(() => navigate('/awaiting-activation'), 1200);
  };

  if (done) {
    return (
      <AuthCard title="Account created">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="text-green-500" size={40} />
          {done === 'confirm' ? (
            <p className="text-sm text-neutral-600">
              We sent a confirmation link to <span className="font-medium">{email}</span>. Confirm your email, then sign in —
              an administrator will activate your account before you can start a course.
            </p>
          ) : (
            <p className="text-sm text-neutral-600">Taking you to your account…</p>
          )}
          <Link to="/login" className="mt-2 text-sm font-medium text-blue-600 hover:underline">
            Go to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="Register to enroll in EgireRobotics FPV courses">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <TextInput required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Pilot" />
        </Field>
        <Field label="Email">
          <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" hint="At least 8 characters" error={error}>
          <TextInput type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <Button type="submit" loading={busy} className="w-full">
          Create account
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" /> OR <div className="h-px flex-1 bg-neutral-200" />
      </div>
      <Button variant="secondary" className="w-full" onClick={() => signInWithGoogle()}>
        <img src="https://www.google.com/favicon.ico" alt="" className="h-4 w-4" /> Continue with Google
      </Button>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
