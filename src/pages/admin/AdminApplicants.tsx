import { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, PageHeader, Select, Spinner, TextInput } from '../../components/ui/kit';
import { CareersNav } from '../../components/CareersNav';
import { APP_STATUS_LABEL, APP_STATUS_TONE, ROUND_STATUS_LABEL, fmtDateTime, type AppStatus, type RoundStatus } from '../../lib/careers';
import { ApplicationDetail, type AppRow, type JobLite } from './CareerApplications';
import type { RoundRow } from './AdminCareerJob';

const STAGES: AppStatus[] = ['applied', 'in_review', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn'];

const DOT: Record<RoundStatus | 'none', string> = {
  passed: 'bg-green-500',
  failed: 'bg-red-500',
  no_show: 'bg-red-400',
  scheduled: 'bg-blue-500',
  completed: 'bg-blue-300',
  pending: 'bg-neutral-300',
  none: 'bg-neutral-200',
};

/** Everyone who applied, across all positions, with where each application stands in the process. */
export function AdminApplicants() {
  const { canWrite } = useAdminAccess();
  const ro = !canWrite('careers');
  const [status, setStatus] = useState<'all' | AppStatus>('all');
  const [jobId, setJobId] = useState('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useQuery(async () => {
    const [apps, jobs, rounds] = await Promise.all([
      unwrap(
        supabase
          .from('careers_applications')
          .select(
            'id, job_id, student_id, status, answers, resume_path, current_round_id, offer_note, created_at, student:profiles!careers_applications_student_id_fkey(full_name, email, phone), careers_application_rounds(id, round_id, status, scheduled_at, interviewer, meet_link, score, feedback)',
          )
          .order('created_at', { ascending: false }),
      ) as unknown as Promise<AppRow[]>,
      unwrap(supabase.from('careers_jobs').select('id, title, kind, jd, form_fields').order('title')) as unknown as Promise<JobLite[]>,
      unwrap(supabase.from('careers_rounds').select('*').order('position')) as unknown as Promise<RoundRow[]>,
    ]);
    return { apps, jobs, rounds };
  }, []);

  const apps = q.data?.apps ?? [];
  const jobs = q.data?.jobs ?? [];
  const jobOf = (id: string | undefined) => jobs.find((j) => j.id === id);
  const roundsOf = (id: string | undefined) => (q.data?.rounds ?? []).filter((r) => r.job_id === id);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: apps.length };
    for (const s of STAGES) c[s] = 0;
    for (const a of apps) c[a.status] += 1;
    return c;
  }, [apps]);

  const rows = apps.filter((a) => {
    if (status !== 'all' && a.status !== status) return false;
    if (jobId !== 'all' && a.job_id !== jobId) return false;
    const s = search.trim().toLowerCase();
    return !s || `${a.student?.full_name ?? ''} ${a.student?.email ?? ''} ${jobOf(a.job_id)?.title ?? ''}`.toLowerCase().includes(s);
  });
  const open = apps.find((a) => a.id === openId) ?? null;

  if (q.loading && !q.data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Applicants" subtitle="Everyone who applied, across every position, and where each application stands" />
      <CareersNav />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(status === s ? 'all' : s)}
            className={`rounded-2xl border px-3 py-3 text-left transition-colors ${status === s ? 'border-neutral-900 bg-white' : 'border-white/70 bg-white/50 hover:bg-white/80'}`}
          >
            <div className="text-2xl font-semibold text-neutral-900">{counts[s]}</div>
            <div className="text-xs text-neutral-500">{APP_STATUS_LABEL[s]}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <TextInput className="!pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find an applicant or position…" />
        </div>
        <Select value={jobId} onChange={(e) => setJobId(e.target.value)} className="!w-auto">
          <option value="all">All positions</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </Select>
        <span className="text-sm text-neutral-500">
          {rows.length} of {apps.length}
        </span>
      </div>

      {!rows.length ? (
        <EmptyState icon={<Users size={22} />} title={apps.length ? 'No applicants match' : 'No applications yet'} description="Applications appear here as students apply to your positions." />
      ) : (
        <div className="space-y-3">
          {rows.map((a) => {
            const job = jobOf(a.job_id);
            const rounds = roundsOf(a.job_id);
            const current = a.careers_application_rounds
              .map((r) => ({ r, round: rounds.find((x) => x.id === r.round_id) }))
              .filter((x) => x.round)
              .sort((x, y) => (y.round?.position ?? 0) - (x.round?.position ?? 0))[0];
            return (
              <GlassCard key={a.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button className="min-w-0 text-left" onClick={() => setOpenId(a.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-neutral-900">{a.student?.full_name || a.student?.email || 'Applicant'}</span>
                      <Badge tone={APP_STATUS_TONE[a.status]}>{APP_STATUS_LABEL[a.status]}</Badge>
                    </div>
                    <div className="mt-0.5 text-sm text-neutral-600">{job?.title ?? 'Position'}</div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {a.student?.email} · applied {new Date(a.created_at).toLocaleDateString('en-GB')}
                      {current?.round && ` · ${current.round.name}: ${ROUND_STATUS_LABEL[current.r.status]}${current.r.scheduled_at && current.r.status === 'scheduled' ? ` (${fmtDateTime(current.r.scheduled_at)})` : ''}`}
                    </div>
                  </button>
                  <div className="flex items-center gap-4">
                    {rounds.length > 0 && (
                      <div className="flex items-center gap-1.5" aria-label="Interview progress">
                        {rounds.map((r) => {
                          const ar = a.careers_application_rounds.find((x) => x.round_id === r.id);
                          return <span key={r.id} title={`${r.name}: ${ar ? ROUND_STATUS_LABEL[ar.status] : 'Not started'}`} className={`h-2.5 w-7 rounded-full ${DOT[ar?.status ?? 'none']}`} />;
                        })}
                      </div>
                    )}
                    <Button variant="secondary" onClick={() => setOpenId(a.id)}>
                      Open
                    </Button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {open && jobOf(open.job_id) && (
        <ApplicationDetail key={open.id} app={open} job={jobOf(open.job_id)!} rounds={roundsOf(open.job_id)} ro={ro} onClose={() => setOpenId(null)} onChanged={() => q.refetch()} />
      )}
    </div>
  );
}
