import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { AuthCard } from '../../layout/PublicShell';
import { Button, Field, TextInput } from '../../components/ui/kit';

export function ForgotPassword() {
  const { sendReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sendReset(email);
    setBusy(false);
    if (error) return setError(error);
    setSent(true);
  };

  return (
    <AuthCard title="Reset your password" subtitle={sent ? undefined : 'We’ll email you a reset link'}>
      {sent ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck className="text-green-500" size={40} />
          <p className="text-sm text-neutral-600">
            If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way.
          </p>
          <Link to="/login" className="mt-2 text-sm font-medium text-blue-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" error={error}>
            <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Button type="submit" loading={busy} className="w-full">
            Send reset link
          </Button>
          <p className="text-center text-sm text-neutral-500">
            <Link to="/login" className="font-medium text-blue-600 hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
