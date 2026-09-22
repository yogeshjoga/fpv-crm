import { useMemo, useState } from 'react';
import { Activity, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, EmptyState, Modal, PageHeader, Spinner, TextInput } from '../../components/ui/kit';

interface StudentRow {
  id: string;
  full_name: string;
  email: string;
  status: 'pending' | 'active' | 'suspended';
}

interface EnrollmentRow {
  student_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'revoked';
  course: { title: string } | null;
}

interface AttemptRow {
  student_id: string;
  course_id: string;
  attempt_no: number;
  status: 'in_progress' | 'submitted' | 'expired';
  score_pct: number | null;
  passed: boolean | null;
  submitted_at: string | null;
  course: { title: string } | null;
}

interface StudyDay {
  student_id: string;
  day: string;
  seconds: number;
}

export function StudentActivity() {
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<StudentRow | null>(null);

  const q = useQuery<{
    students: StudentRow[];
    enrollments: EnrollmentRow[];
    attempts: AttemptRow[];
    studyDays: StudyDay[];
  }>(async () => {
    const [students, enrollments, attempts, studyDays] = await Promise.all([
      unwrap(
        supabase.from('profiles').select('id, full_name, email, status').eq('role', 'student').is('archived_at', null).order('full_name'),
      ) as Promise<StudentRow[]>,
      unwrap(supabase.from('enrollments').select('student_id, course_id, status, course:courses(title)')) as Promise<EnrollmentRow[]>,
      unwrap(
        supabase
          .from('exam_attempts')
          .select('student_id, course_id, attempt_no, status, score_pct, passed, submitted_at, course:courses(title)')
          .order('submitted_at', { ascending: false }),
      ) as Promise<AttemptRow[]>,
      unwrap(supabase.from('study_time').select('student_id, day, seconds')) as Promise<StudyDay[]>,
    ]);
    return { students, enrollments, attempts, studyDays };
  }, []);

  // Last-active date per student is the most recent day they logged any study time —
  // there's no separate login-tracking table, so this day-bucketed counter (already
  // written by increment_study_time on every active admin/student page) is the closest
  // real signal we have.
  const lastActiveByStudent = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of q.data?.studyDays ?? []) {
      const cur = map.get(d.student_id);
      if (!cur || d.day > cur) map.set(d.student_id, d.day);
    }
    return map;
  }, [q.data]);

  const summaryFor = (studentId: string) => {
    const enrollments = (q.data?.enrollments ?? []).filter((e) => e.student_id === studentId);
    const attempts = (q.data?.attempts ?? []).filter((a) => a.student_id === studentId);
    const submitted = attempts.filter((a) => a.status === 'submitted');
    return {
      enrollments,
      attempts,
      activeCourses: enrollments.filter((e) => e.status === 'active').length,
      completedCourses: enrollments.filter((e) => e.status === 'completed').length,
      attemptCount: submitted.length,
      passedCount: submitted.filter((a) => a.passed).length,
      bestScore: submitted.length ? Math.max(...submitted.map((a) => Number(a.score_pct ?? 0))) : null,
      lastActive: lastActiveByStudent.get(studentId) ?? null,
    };
  };

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return (q.data?.students ?? []).filter((p) => p.full_name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s));
  }, [q.data, search]);

  return (
    <div>
      <PageHeader
        title="Student Activity"
        subtitle="Course progress, exam results and last-active date for every student, in one place"
        actions={<TextInput placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />}
      />

      {q.loading ? (
        <Spinner />
      ) : !rows.length ? (
        <EmptyState icon={<Activity size={22} />} title="No students yet" />
      ) : (
        <GlassCard className="divide-y divide-white/50 p-2">
          {rows.map((p) => {
            const s = summaryFor(p.id);
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-[180px]">
                  <div className="font-medium text-neutral-900">{p.full_name || '—'}</div>
                  <div className="text-xs text-neutral-500">{p.email}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <Badge tone="blue">
                    {s.activeCourses} active · {s.completedCourses} completed
                  </Badge>
                  <Badge tone={s.passedCount ? 'green' : 'neutral'}>
                    {s.attemptCount} attempt{s.attemptCount === 1 ? '' : 's'}
                    {s.bestScore != null ? ` · best ${s.bestScore}%` : ''}
                  </Badge>
                </div>
                <div className="text-xs text-neutral-500">
                  {s.lastActive ? `Active ${new Date(s.lastActive).toLocaleDateString()}` : 'No activity recorded'}
                </div>
                <button
                  onClick={() => setViewing(p)}
                  title="View full activity"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-white"
                >
                  <Eye size={13} /> View
                </button>
              </div>
            );
          })}
        </GlassCard>
      )}

      {viewing && <StudentDetailModal student={viewing} summary={summaryFor(viewing.id)} onClose={() => setViewing(null)} />}
    </div>
  );
}

interface StudentSummary {
  enrollments: EnrollmentRow[];
  attempts: AttemptRow[];
  lastActive: string | null;
}

function StudentDetailModal({ student, summary, onClose }: { student: StudentRow; summary: StudentSummary; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={student.full_name || student.email} wide>
      <div className="space-y-4">
        <div className="text-sm text-neutral-500">{student.email}</div>

        <div className="rounded-2xl border border-white/60 bg-white/40 p-4">
          <div className="mb-2 text-sm font-medium text-neutral-700">Course progress &amp; enrollment</div>
          {!summary.enrollments.length ? (
            <p className="text-sm text-neutral-400">No enrollments yet.</p>
          ) : (
            <div className="space-y-1.5">
              {summary.enrollments.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-800">{e.course?.title ?? 'Unknown course'}</span>
                  <Badge tone={e.status === 'active' ? 'blue' : e.status === 'completed' ? 'green' : 'red'}>{e.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/40 p-4">
          <div className="mb-2 text-sm font-medium text-neutral-700">Exam attempts &amp; scores</div>
          {!summary.attempts.length ? (
            <p className="text-sm text-neutral-400">No exam attempts yet.</p>
          ) : (
            <div className="space-y-1.5">
              {summary.attempts.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-800">
                    {a.course?.title ?? 'Unknown course'} · attempt {a.attempt_no}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-neutral-500">
                      {a.status === 'submitted' ? `${Number(a.score_pct ?? 0)}%` : a.status}
                    </span>
                    {a.status === 'submitted' && <Badge tone={a.passed ? 'green' : 'red'}>{a.passed ? 'passed' : 'failed'}</Badge>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-sm text-neutral-500">
          Last active: {summary.lastActive ? new Date(summary.lastActive).toLocaleDateString() : 'no activity recorded'}
        </div>
      </div>
    </Modal>
  );
}
