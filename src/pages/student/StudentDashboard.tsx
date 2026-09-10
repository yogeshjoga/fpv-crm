import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Award, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
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

  return (
    <div>
      <PageHeader
        title={`Hi ${profile?.full_name?.split(' ')[0] || 'there'} 👋`}
        subtitle="Your training at a glance"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat icon={<BookOpen size={18} />} label="Active courses" value={enrollments.data?.filter((e) => e.status === 'active').length ?? 0} />
        <Stat icon={<Clock size={18} />} label="Pending requests" value={pending.data?.length ?? 0} />
        <Stat icon={<Award size={18} />} label="Certificates" value={certs.data?.length ?? 0} />
      </div>

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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <GlassCard className="flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 text-blue-500">{icon}</div>
      <div>
        <div className="text-2xl font-semibold text-neutral-900">{value}</div>
        <div className="text-xs text-neutral-500">{label}</div>
      </div>
    </GlassCard>
  );
}
