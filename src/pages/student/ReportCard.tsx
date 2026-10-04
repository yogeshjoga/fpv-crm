import { Link } from 'react-router-dom';
import { Award, CheckCircle2, ClipboardList, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, EmptyState, PageHeader, Spinner } from '../../components/ui/kit';
import type { Evaluation } from '../../lib/assessment';

interface CertRow {
  id: string;
  cert_id_string: string;
  cert_type: string | null;
  issued_at: string;
  report: (Evaluation & { merit_min?: number; course?: string }) | null;
  course: { title: string } | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The student's report card: every module with their marks, the pass mark and a clear
 * Cleared / Not cleared, then the overall result. It is the snapshot taken when the results
 * were finalised, so it always matches the certificate they received.
 */
export function ReportCard() {
  const { profile } = useAuth();
  const q = useQuery(
    () =>
      unwrap(
        supabase
          .from('certificates')
          .select('id, cert_id_string, cert_type, issued_at, report, course:courses(title)')
          .eq('student_id', profile!.id)
          .eq('revoked', false)
          .not('report', 'is', null)
          .order('issued_at', { ascending: false }),
      ) as unknown as Promise<CertRow[]>,
    [profile?.id],
  );

  if (q.loading && !q.data) return <Spinner />;
  const cards = (q.data ?? []).filter((c) => c.report);

  return (
    <div>
      <PageHeader title="Report card" subtitle="Your result in every module of the assessment" />

      {!cards.length ? (
        <EmptyState
          icon={<ClipboardList size={22} />}
          title="No report card yet"
          description="Your report card appears here once your instructors have finalised your results, after the viva, simulation, free flight and online exam."
        />
      ) : (
        <div className="space-y-6">
          {cards.map((c) => (
            <Card key={c.id} row={c} studentName={profile?.full_name || profile?.email || ''} />
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ row, studentName }: { row: CertRow; studentName: string }) {
  const r = row.report!;
  const cleared = r.clearedAll;
  const pct = r.max ? round2((r.total / r.max) * 100) : 0;

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/60 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Report card</div>
          <h2 className="mt-0.5 text-lg font-semibold text-neutral-900">{r.course ?? row.course?.title}</h2>
          <div className="mt-0.5 text-sm text-neutral-500">
            {studentName} · issued {new Date(row.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
        <Link to="/app/certificates" className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-white">
          <Award size={13} /> Certificate <span className="font-mono">{row.cert_id_string}</span>
        </Link>
      </div>

      <div className={`flex flex-wrap items-center gap-4 px-5 py-4 ${cleared ? 'bg-green-50/80' : 'bg-red-50/80'}`}>
        {cleared ? <CheckCircle2 size={34} className="shrink-0 text-green-600" /> : <XCircle size={34} className="shrink-0 text-red-600" />}
        <div className="min-w-0 flex-1">
          <div className={`text-lg font-semibold ${cleared ? 'text-green-800' : 'text-red-800'}`}>
            {cleared ? 'Cleared — you passed every module' : 'Not cleared'}
          </div>
          <p className={`text-sm ${cleared ? 'text-green-800/80' : 'text-red-800/80'}`}>
            {cleared
              ? `Certificate of ${row.cert_type ?? 'Merit'} awarded.`
              : `You did not clear: ${r.failed.join(', ')}. Every module has to be cleared on its own, so a high score in the other modules cannot make up for it. You received a Certificate of ${row.cert_type ?? 'Participation'}.`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold text-neutral-900">
            {r.total}
            <span className="text-base font-normal text-neutral-400"> / {r.max}</span>
          </div>
          <div className="text-xs text-neutral-500">{pct}% overall</div>
        </div>
      </div>

      <div className="overflow-x-auto p-5">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="pb-2 pr-4">Module</th>
              <th className="pb-2 pr-4">Your marks</th>
              <th className="pb-2 pr-4">Pass mark</th>
              <th className="w-[26%] pb-2 pr-4">Progress</th>
              <th className="pb-2">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/60">
            {r.modules.map((m) => {
              const share = m.max ? Math.min(100, (m.marks / m.max) * 100) : 0;
              const passAt = m.max ? Math.min(100, (m.pass / m.max) * 100) : 0;
              return (
                <tr key={m.key}>
                  <td className="py-3 pr-4 font-medium text-neutral-900">{m.label}</td>
                  <td className="py-3 pr-4">
                    <span className="text-base font-semibold text-neutral-900">{m.marks}</span>
                    <span className="text-neutral-400"> / {m.max}</span>
                  </td>
                  <td className="py-3 pr-4 text-neutral-600">
                    {m.pass}
                    <span className="text-xs text-neutral-400"> ({m.max ? Math.round((m.pass / m.max) * 1000) / 10 : 0}%)</span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="relative h-2.5 rounded-full bg-white/80">
                      <div className={`h-full rounded-full ${m.cleared ? 'bg-green-500' : 'bg-red-400'}`} style={{ width: `${share}%` }} />
                      <div className="absolute -top-1 w-0.5 bg-neutral-700" style={{ left: `${passAt}%`, height: '1.1rem' }} title={`Pass mark ${m.pass}`} />
                    </div>
                  </td>
                  <td className="py-3">
                    {m.cleared ? (
                      <Badge tone="green">Cleared</Badge>
                    ) : (
                      <div>
                        <Badge tone="red">Not cleared</Badge>
                        <div className="mt-0.5 text-[11px] text-red-600">{round2(m.pass - m.marks)} marks short</div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-white/80">
              <td className="pt-3 pr-4 font-semibold text-neutral-900">Total</td>
              <td className="pt-3 pr-4">
                <span className="text-base font-semibold text-neutral-900">{r.total}</span>
                <span className="text-neutral-400"> / {r.max}</span>
              </td>
              <td className="pt-3 pr-4 text-neutral-400">—</td>
              <td className="pt-3 pr-4 text-xs text-neutral-500">{pct}%</td>
              <td className="pt-3">
                <Badge tone={cleared ? 'green' : 'red'}>{cleared ? 'Cleared' : 'Not cleared'}</Badge>
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-4 text-xs text-neutral-400">
          The thin line on each bar marks the pass mark. To clear the assessment you must reach the pass mark in all {r.modules.length} modules.
        </p>
      </div>
    </GlassCard>
  );
}
