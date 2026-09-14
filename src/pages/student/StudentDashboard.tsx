import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Award, Clock, Flame } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { activityStrip, computeStreak } from '../../lib/streak';
import { GlassCard } from '../../components/ui/shared';
import { Badge, EmptyState, PageHeader, Spinner } from '../../components/ui/kit';

interface Row {
  id: string;
  status: string;
  course: { id: string; slug: string; title: string; summary: string; pass_pct: number } | null;
}

export function StudentDashboard() {
  const { profile } = useAuth();
  const uid = profile?.id ?? '';

  // Scope every query to the current user: staff RLS on these tables returns
  // every student's rows, which double-counts the stats and repeats course
  // cards when a staff account opens the student view.
  const enrollments = useQuery<Row[]>(
    () =>
      unwrap(
        supabase
          .from('enrollments')
          .select('id, status, course:courses(id, slug, title, summary, pass_pct)')
          .eq('student_id', uid)
          .order('enrolled_at', { ascending: false }),
      ) as Promise<Row[]>,
    [uid],
  );

  const pending = useQuery<{ id: string; course: { title: string } | null }[]>(
    () =>
      unwrap(
        supabase
          .from('enrollment_requests')
          .select('id, course:courses(title)')
          .eq('student_id', uid)
          .eq('status', 'pending'),
      ) as Promise<{ id: string; course: { title: string } | null }[]>,
    [uid],
  );

  const certs = useQuery<{ id: string }[]>(
    () => unwrap(supabase.from('certificates').select('id').eq('student_id', uid).eq('revoked', false)) as Promise<{ id: string }[]>,
    [uid],
  );

  const activity = useQuery<{ day: string }[]>(
    () => unwrap(supabase.from('study_time').select('day').eq('student_id', uid)) as Promise<{ day: string }[]>,
    [uid],
  );
  const days = activity.data?.map((r) => r.day) ?? [];
  const streak = computeStreak(days);
  const strip = activityStrip(days, 28);

  return (
    <div>
      <PageHeader
        title={`Hi ${profile?.full_name?.split(' ')[0] || 'there'} 👋`}
        subtitle="Your training at a glance"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<BookOpen size={18} />} label="Active courses" value={enrollments.data?.filter((e) => e.status === 'active').length ?? 0} />
        <Stat icon={<Clock size={18} />} label="Pending requests" value={pending.data?.length ?? 0} />
        <Stat icon={<Award size={18} />} label="Certificates" value={certs.data?.length ?? 0} />
        <Stat icon={<Flame size={18} />} label="Day streak" value={streak.current} tone={streak.current > 0 ? 'text-orange-500' : undefined} />
      </div>

      <GlassCard className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-neutral-900">
            <Flame size={17} className={streak.current > 0 ? 'text-orange-500' : 'text-neutral-400'} />
            Daily streak
          </div>
          <div className="text-xs text-neutral-500">
            Longest streak <span className="font-semibold text-neutral-800">{streak.longest}</span> day{streak.longest === 1 ? '' : 's'}
          </div>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {streak.current > 0
            ? streak.activeToday
              ? `You're on a ${streak.current}-day streak — you've already studied today. Keep it going!`
              : `You're on a ${streak.current}-day streak. Study something today to keep it alive.`
            : streak.totalActiveDays > 0
              ? 'Your streak reset — spend a little time in a course today to start a new one.'
              : 'Open a lesson today to start your first streak.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {strip.map((d) => (
            <div
              key={d.day}
              title={d.day}
              className={`h-4 w-4 rounded-[4px] ${d.active ? 'bg-orange-400' : 'bg-neutral-200/70'}`}
            />
          ))}
        </div>
        <div className="mt-1.5 text-[11px] text-neutral-400">Last 28 days · {streak.totalActiveDays} day{streak.totalActiveDays === 1 ? '' : 's'} active total</div>
      </GlassCard>

      <h2 className="mb-3 text-sm font-semibold text-neutral-700">My courses</h2>
      {enrollments.loading ? (
        <Spinner />
      ) : !enrollments.data?.length ? (
        <EmptyState
          icon={<BookOpen size={22} />}
          title="You’re not enrolled in any course yet"
          description="Browse the catalog and submit an enrollment form to get started."
          action={
            <Link to="/app/courses" className="inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white">
              Browse courses <ArrowRight size={15} />
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {enrollments.data.map((e) => (
            <GlassCard key={e.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-neutral-900">{e.course?.title}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{e.course?.summary}</p>
                </div>
                <Badge tone={e.status === 'completed' ? 'green' : e.status === 'active' ? 'blue' : 'neutral'}>{e.status}</Badge>
              </div>
              {e.course && (
                <Link
                  to={`/app/courses/${e.course.slug}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                >
                  Open course <ArrowRight size={14} />
                </Link>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: string }) {
  return (
    <GlassCard className="flex items-center gap-4 p-5">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 ${tone ?? 'text-blue-500'}`}>{icon}</div>
      <div>
        <div className="text-2xl font-semibold text-neutral-900">{value}</div>
        <div className="text-xs text-neutral-500">{label}</div>
      </div>
    </GlassCard>
  );
}
