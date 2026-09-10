import { Link } from 'react-router-dom';
import { Award, Download, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, EmptyState, PageHeader, Spinner, useToast } from '../../components/ui/kit';

interface Cert {
  id: string;
  cert_id_string: string;
  score_pct: number;
  issued_at: string;
  pdf_path: string | null;
  revoked: boolean;
  course: { title: string } | null;
}

export function StudentCertificates() {
  const toast = useToast();
  const { profile } = useAuth();
  const uid = profile?.id ?? '';
  const q = useQuery<Cert[]>(
    () =>
      unwrap(
        supabase
          .from('certificates')
          .select('id, cert_id_string, score_pct, issued_at, pdf_path, revoked, course:courses(title)')
          .eq('student_id', uid)
          .order('issued_at', { ascending: false }),
      ) as Promise<Cert[]>,
    [uid],
  );

  const openPdf = async (path: string) => {
    const { data, error } = await supabase.storage.from('certificates').createSignedUrl(path, 120);
    if (error || !data) return toast('Could not open the certificate', 'error');
    window.open(data.signedUrl, '_blank');
  };

  return (
    <div>
      <PageHeader title="My certificates" subtitle="Download or share your verifiable certificates" />
      {q.loading ? (
        <Spinner />
      ) : !q.data?.length ? (
        <EmptyState icon={<Award size={22} />} title="No certificates yet" description="Pass a course exam to earn one." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((c) => (
            <GlassCard key={c.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 font-semibold text-neutral-900">
                  <Award size={18} className="text-amber-500" /> {c.course?.title}
                </div>
                {c.revoked ? <Badge tone="red">revoked</Badge> : <Badge tone="green">valid</Badge>}
              </div>
              <div className="mt-3 space-y-1 text-sm text-neutral-500">
                <div>
                  ID <span className="font-mono text-neutral-800">{c.cert_id_string}</span>
                </div>
                <div>Score {Number(c.score_pct)}%</div>
                <div>Issued {new Date(c.issued_at).toLocaleDateString()}</div>
              </div>
              <div className="mt-4 flex gap-2">
                {c.pdf_path && (
                  <button
                    onClick={() => openPdf(c.pdf_path!)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white"
                  >
                    <Download size={14} /> PDF
                  </button>
                )}
                <Link
                  to={`/verify/${c.cert_id_string}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-white"
                >
                  <ShieldCheck size={14} /> Verify page
                </Link>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
