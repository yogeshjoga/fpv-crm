import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { GlassCard } from './ui/shared';
import { Badge, Button, Field, TextInput, useToast } from './ui/kit';

interface Enrolling {
  factorId: string;
  qr: string;
  secret: string;
}

/** Turn two-step verification (an authenticator app) on or off for the signed-in person. */
export function MfaSetup() {
  const toast = useToast();
  const { refreshMfa } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null); // the verified factor, when on
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactorId(data?.totp.find((f) => f.status === 'verified')?.id ?? null);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      // an abandoned, never-verified set-up would block a new one with the same name
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
      if (error) throw error;
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start the set-up', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!enrolling) return;
    if (!/^\d{6}$/.test(code.trim())) return toast('Enter the 6-digit code from the app', 'error');
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.factorId, code: code.trim() });
      if (error) throw error;
      setEnrolling(null);
      toast('Two-step verification is on');
      await load();
      await refreshMfa();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That code did not work', 'error');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    setEnrolling(null);
  };

  const turnOff = async () => {
    if (!factorId) return;
    if (!window.confirm('Turn off two-step verification? Your account will only need a password again.')) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Two-step verification is off');
    await load();
    await refreshMfa();
  };

  return (
    <GlassCard className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-full ${factorId ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
            {factorId ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold text-neutral-900">
              Two-step verification {!loading && <Badge tone={factorId ? 'green' : 'amber'}>{factorId ? 'On' : 'Off'}</Badge>}
            </div>
            <p className="mt-1 max-w-xl text-sm text-neutral-500">
              Sign-in then needs a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy). A stolen password alone can no longer open an admin account or change anything.
            </p>
          </div>
        </div>
        {!loading && !enrolling && (factorId ? (
          <Button variant="secondary" onClick={turnOff} loading={busy}>
            Turn off
          </Button>
        ) : (
          <Button onClick={start} loading={busy}>
            Turn on
          </Button>
        ))}
      </div>

      {enrolling && (
        <div className="mt-5 grid gap-5 rounded-2xl border border-white/70 bg-white/60 p-5 sm:grid-cols-[180px_1fr]">
          <img src={enrolling.qr} alt="QR code to scan with your authenticator app" className="h-44 w-44 rounded-xl bg-white p-2" />
          <div className="space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-600">
              <li>Open your authenticator app and scan the code.</li>
              <li>Cannot scan? Type this key instead: <span className="select-all break-all font-mono text-xs text-neutral-900">{enrolling.secret}</span></li>
              <li>Enter the 6-digit code it shows.</li>
            </ol>
            <Field label="6-digit code">
              <TextInput inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
            </Field>
            <p className="text-xs text-amber-700">Keep the key somewhere safe. If you lose your phone and the key, a super admin has to reset your sign-in from the Supabase dashboard.</p>
            <div className="flex gap-2">
              <Button onClick={confirm} loading={busy}>
                Verify and turn on
              </Button>
              <Button variant="ghost" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
