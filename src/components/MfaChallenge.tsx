import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { GlassCard } from './ui/shared';
import { Button, Checkbox, Field, TextInput } from './ui/kit';
import { trustThisDevice } from '../lib/trustedDevice';

/** Asks for the 6-digit code from the authenticator app. Shown instead of the app until it is entered. */
export function MfaChallenge() {
  const { refreshMfa, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code from your authenticator app.');
    setBusy(true);
    setError(null);
    try {
      const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
      if (fErr) throw fErr;
      const factor = factors.totp.find((f) => f.status === 'verified') ?? factors.totp[0];
      if (!factor) throw new Error('No authenticator is set up for this account.');
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
      if (vErr) throw vErr;
      if (remember) {
        const { data: s } = await supabase.auth.getSession();
        if (s.session) await trustThisDevice(s.session.access_token);
      }
      await refreshMfa();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work. Try again.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <GlassCard className="w-full max-w-sm p-7">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <ShieldCheck size={22} />
        </div>
        <h1 className="font-display text-xl font-semibold text-neutral-900">Two-step verification</h1>
        <p className="mt-1 text-sm text-neutral-500">Open your authenticator app and enter the 6-digit code for EgireRobotics.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Code" error={error ?? undefined}>
            <TextInput
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />
          </Field>
          <Checkbox label="Don't ask again on this device for 30 days" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Button type="submit" loading={busy} className="w-full">
            Verify and continue
          </Button>
        </form>
        <button onClick={() => void signOut()} className="mt-4 w-full text-center text-xs text-neutral-500 hover:text-neutral-800">
          Sign out
        </button>
      </GlassCard>
    </div>
  );
}
