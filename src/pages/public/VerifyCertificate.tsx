import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BadgeCheck, Search, ShieldX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, Field, TextInput, Spinner } from '../../components/ui/kit';
import { CertificatePreview } from '../../components/CertificatePreview';

type Result =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'not-found' }
  | {
      state: 'found';
      valid: boolean;
      revoked: boolean;
      student_name: string;
      course_title: string;
      cert_type: string;
      issued_at: string;
      score_pct: number;
      cert_id_string: string;
      org_name: string;
      verify_base_url: string;
      cert_background_url: string | null;
    };

export function VerifyCertificate() {
  const { certId } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(certId ?? '');
  const [result, setResult] = useState<Result>({ state: 'idle' });

  const lookup = useCallback(async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setResult({ state: 'loading' });
    const { data, error } = await supabase.rpc('verify_certificate', { p_cert_id: trimmed });
    if (error || !data || data.length === 0) {
      setResult({ state: 'not-found' });
      return;
    }
    setResult({ state: 'found', ...data[0] });
  }, []);

  useEffect(() => {
    if (certId) lookup(certId);
  }, [certId, lookup]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/verify/${encodeURIComponent(input.trim())}`);
    lookup(input);
  };

  return (
    <div className="w-full max-w-3xl rounded-[2rem] border border-white/70 bg-white/60 p-8 shadow-[0_8px_40px_rgb(0,0,0,0.06)] backdrop-blur-2xl">
      <h1 className="font-display text-2xl font-semibold text-neutral-900">Certificate verification</h1>
      <p className="mt-1.5 text-sm text-neutral-500">
        Enter a certificate ID (for example <span className="font-mono">EGR-FPV-2026-000123</span>) to confirm it was
        genuinely issued by us and see the certificate itself — no account needed.
      </p>

      <form onSubmit={submit} className="mt-6 flex items-end gap-2">
        <div className="flex-1">
          <Field label="Certificate ID">
            <TextInput value={input} onChange={(e) => setInput(e.target.value)} placeholder="EGR-…" className="font-mono" />
          </Field>
        </div>
        <Button type="submit">
          <Search size={16} /> Verify
        </Button>
      </form>

      <div className="mt-6">
        {result.state === 'loading' && <Spinner label="Checking…" />}

        {result.state === 'not-found' && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
            <ShieldX size={20} /> No certificate found with that ID.
          </div>
        )}

        {result.state === 'found' && (
          <div className="space-y-4">
            <div
              className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                result.valid ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {result.valid ? <BadgeCheck size={20} /> : <ShieldX size={20} />}
              {result.valid
                ? 'Valid certificate — genuinely issued by us'
                : result.revoked
                  ? 'This certificate has been revoked'
                  : 'Certificate invalid'}
            </div>

            <CertificatePreview
              data={{
                certId: result.cert_id_string,
                studentName: result.student_name,
                courseTitle: result.course_title,
                certType: result.cert_type || 'Participation',
                scorePct: result.score_pct,
                issuedAt: result.issued_at,
                orgName: result.org_name || 'EgireRobotics',
                verifyBaseUrl: result.verify_base_url || 'egirerobotics.com',
                backgroundUrl: result.cert_background_url,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
