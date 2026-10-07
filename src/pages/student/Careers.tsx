import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, CalendarClock, MapPin, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, EmptyState, PageHeader, Spinner } from '../../components/ui/kit';
import { formatRemaining, useNow } from '../../components/ExamCountdown';
import { MyOffers } from './MyOffers';
import {
  APP_STATUS_LABEL,
  APP_STATUS_TONE,
  KIND_LABEL,
  MODE_LABEL,
  ROUND_STATUS_LABEL,
  ROUND_STATUS_TONE,
  fmtDateTime,
  windowState,
  type AppStatus,
  type JobKind,
  type RoundStatus,
  type WorkMode,
} from '../../lib/careers';

export interface StudentJob {
  id: string;
  title: string;
  slug: string;
  kind: JobKind;
  department: string;
  location: string;
  work_mode: WorkMode;
  openings: number;
  pay: string;
  summary: string;
  status: string;
  apply_starts_at: string | null;
  apply_ends_at: string | null;
}
interface MyApp {
  id: string;
  job_id: string;
  status: AppStatus;
  current_round_id: string | null;
  offer_note: string;
  created_at: string;
}
export interface MyRound {
  application_id: string;
  round_id: string;
  round_position: number;
  name: string;
  kind: string;
  description: string;
  status: RoundStatus;
  scheduled_at: string | null;
  interviewer: string;
  meet_link: string;
  exam_slug: string | null;
}

/** Live "opens in / closes in" line for a position. */
export function WindowLine({ job }: { job: Pick<StudentJob, 'status' | 'apply_starts_at' | 'apply_ends_at'> }) {
  const now = useNow();
  const state = windowState(job, now);
  const start = job.apply_starts_at ? new Date(job.apply_starts_at).getTime() : null;
  const end = job.apply_ends_at ? new Date(job.apply_ends_at).getTime() : null;
  if (state === 'upcoming' && start !== null)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <CalendarClock size={13} /> Applications open in {formatRemaining(start - now)}
      </span>
    );
  if (state === 'live')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
        <CalendarClock size={13} /> {end !== null ? `Closes in ${formatRemaining(end - now)}` : 'Open for applications'}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
      <CalendarClock size={13} /> Applications closed
    </span>
  );
}

/** Careers for students: open positions with their apply window, and where each of their own applications stands. */
export function Careers() {
  const { profile } = useAuth();
  const uid = profile?.id ?? '';

  const q = useQuery(async () => {
    const [jobs, apps, rounds] = await Promise.all([
      unwrap(
        supabase.from('careers_jobs').select('id, title, slug, kind, department, location, work_mode, openings, pay, summary, status, apply_starts_at, apply_ends_at').order('apply_ends_at', { ascending: true, nullsFirst: false }),
      ) as Promise<StudentJob[]>,
      unwrap(supabase.from('careers_applications').select('id, job_id, status, current_round_id, offer_note, created_at').eq('student_id', uid).order('created_at', { ascending: false })) as Promise<MyApp[]>,
      supabase.rpc('careers_my_rounds').then((r) => (r.data ?? []) as unknown as MyRound[]),
    ]);
    return { jobs, apps, rounds };
  }, [uid]);

  if (q.loading && !q.data) return <Spinner />;
  const { jobs, apps, rounds } = q.data ?? { jobs: [], apps: [], rounds: [] };
  const appliedIds = new Set(apps.map((a) => a.job_id));
  const jobOf = (id: string) => jobs.find((j) => j.id === id);
  const openJobs = jobs.filter((j) => j.status === 'open' && windowState(j) !== 'closed' && !appliedIds.has(j.id));

  return (
    <div>
      <PageHeader title="Careers" subtitle="Internships and jobs at EgireRobotics. Apply here and follow your application." />

      <MyOffers uid={uid} />

      {apps.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">My applications</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {apps.map((a) => {
              const job = jobOf(a.job_id);
              const mine = rounds.filter((r) => r.application_id === a.id);
              const next = mine.find((r) => r.status === 'scheduled' && r.scheduled_at && new Date(r.scheduled_at).getTime() > Date.now());
              return (
                <Link key={a.id} to={job ? `/app/careers/${job.slug}` : '/app/careers'}>
                  <GlassCard className="h-full p-5 transition-transform hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-neutral-900">{job?.title ?? 'Position'}</div>
                        <div className="mt-0.5 text-xs text-neutral-500">Applied {new Date(a.created_at).toLocaleDateString('en-GB')}</div>
                      </div>
                      <Badge tone={APP_STATUS_TONE[a.status]}>{APP_STATUS_LABEL[a.status]}</Badge>
                    </div>
                    {next && (
                      <div className="mt-3 rounded-xl bg-blue-50/80 px-3 py-2 text-xs text-blue-900">
                        Next: <span className="font-semibold">{next.name}</span> · {fmtDateTime(next.scheduled_at)}
                      </div>
                    )}
                    {!next && mine.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {mine.map((r) => (
                          <Badge key={r.round_id} tone={ROUND_STATUS_TONE[r.status]}>
                            {r.name}: {ROUND_STATUS_LABEL[r.status]}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {(a.status === 'offered' || a.status === 'hired') && a.offer_note && (
                      <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">{a.offer_note}</div>
                    )}
                    <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600">
                      Track progress <ArrowRight size={14} />
                    </div>
                  </GlassCard>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Open positions</h2>
        {!openJobs.length ? (
          <EmptyState icon={<Briefcase size={22} />} title="No open positions right now" description="When we open an internship or a job you will see a notification here and on your dashboard." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {openJobs.map((j) => (
              <Link key={j.id} to={`/app/careers/${j.slug}`}>
                <GlassCard className="h-full p-5 transition-transform hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-900">{j.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                        <span>{MODE_LABEL[j.work_mode]}</span>
                        {j.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} /> {j.location}
                          </span>
                        )}
                        {j.pay && (
                          <span className="inline-flex items-center gap-1">
                            <Wallet size={12} /> {j.pay}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge tone="blue">{KIND_LABEL[j.kind]}</Badge>
                  </div>
                  {j.summary && <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{j.summary}</p>}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <WindowLine job={j} />
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600">
                      View <ArrowRight size={14} />
                    </span>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
