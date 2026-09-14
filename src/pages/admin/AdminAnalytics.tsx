import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Clock, GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { EmptyState, PageHeader, Spinner, TextInput } from '../../components/ui/kit';

interface StudyRow {
  student_id: string;
  course_id: string;
  day: string;
  seconds: number;
  student: { full_name: string; email: string } | null;
  course: { title: string } | null;
}
interface StaffRow {
  staff_id: string;
  day: string;
  seconds: number;
  staff: { full_name: string; email: string; role: string } | null;
}

/** "7384" -> "2h 3m" (falls back to "45s" under a minute). */
function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.round(totalSeconds)}s`;
}

export function AdminAnalytics() {
  const [search, setSearch] = useState('');

  const q = useQuery(async () => {
    const [studyRows, staffRows] = await Promise.all([
      unwrap(
        supabase
          .from('study_time')
          .select('student_id, course_id, day, seconds, student:profiles!study_time_student_id_fkey(full_name, email), course:courses(title)'),
      ) as Promise<StudyRow[]>,
      unwrap(
        supabase
          .from('staff_activity_time')
          .select('staff_id, day, seconds, staff:profiles!staff_activity_time_staff_id_fkey(full_name, email, role)'),
      ) as Promise<StaffRow[]>,
    ]);
    return { studyRows, staffRows };
  }, []);

  const byStudentCourse = useMemo(() => {
    const map = new Map<string, { name: string; email: string; course: string; seconds: number; lastActive: string }>();
    for (const r of q.data?.studyRows ?? []) {
      const key = `${r.student_id}:${r.course_id}`;
      const prev = map.get(key);
      if (prev) {
        prev.seconds += r.seconds;
        if (r.day > prev.lastActive) prev.lastActive = r.day;
      } else {
        map.set(key, {
          name: r.student?.full_name || r.student?.email || 'Unknown',
          email: r.student?.email ?? '',
          course: r.course?.title ?? 'Unknown course',
          seconds: r.seconds,
          lastActive: r.day,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.seconds - a.seconds);
  }, [q.data]);

  const byStaff = useMemo(() => {
    const map = new Map<string, { name: string; email: string; role: string; seconds: number; lastActive: string }>();
    for (const r of q.data?.staffRows ?? []) {
      const prev = map.get(r.staff_id);
      if (prev) {
        prev.seconds += r.seconds;
        if (r.day > prev.lastActive) prev.lastActive = r.day;
      } else {
        map.set(r.staff_id, {
          name: r.staff?.full_name || r.staff?.email || 'Unknown',
          email: r.staff?.email ?? '',
          role: r.staff?.role ?? '',
          seconds: r.seconds,
          lastActive: r.day,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.seconds - a.seconds);
  }, [q.data]);

  const filteredStudents = useMemo(() => {
    const s = search.toLowerCase();
    return byStudentCourse.filter((r) => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s) || r.course.toLowerCase().includes(s));
  }, [byStudentCourse, search]);

  const chartData = byStaff.slice(0, 8).map((s) => ({ name: s.name.split(' ')[0] || s.name, minutes: Math.round(s.seconds / 60) }));

  if (q.loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Time students spend in each course, and staff activity in the admin panel"
      />

      <GlassCard className="mb-6 p-5">
        <div className="mb-4 flex items-center gap-2 font-semibold text-neutral-900">
          <Clock size={17} /> Staff activity — total time in the admin panel
        </div>
        {!byStaff.length ? (
          <p className="text-sm text-neutral-400">No activity recorded yet — this starts counting from today.</p>
        ) : (
          <>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    formatter={(v: number) => [`${v} min`, 'Active time']}
                    contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }}
                  />
                  <Bar dataKey="minutes" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 divide-y divide-white/50 text-sm">
              {byStaff.map((s) => (
                <div key={s.email} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium text-neutral-900">{s.name}</span>{' '}
                    <span className="text-xs text-neutral-400">({s.role})</span>
                  </div>
                  <div className="flex items-center gap-4 text-neutral-500">
                    <span>Last active {new Date(s.lastActive).toLocaleDateString()}</span>
                    <span className="font-medium text-neutral-900">{fmtDuration(s.seconds)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-neutral-900">
            <GraduationCap size={17} /> Student time per course
          </div>
          <TextInput placeholder="Search student or course…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        </div>
        {!filteredStudents.length ? (
          <EmptyState
            icon={<GraduationCap size={22} />}
            title="No study time recorded yet"
            description="This fills in as students spend time on a course's lessons — it starts counting from today, nothing retroactive."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Course</th>
                  <th className="px-3 py-2">Time spent</th>
                  <th className="px-3 py-2">Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/50">
                {filteredStudents.map((r) => (
                  <tr key={`${r.email}:${r.course}`}>
                    <td className="px-3 py-2.5 font-medium text-neutral-900">{r.name}</td>
                    <td className="px-3 py-2.5 text-neutral-600">{r.course}</td>
                    <td className="px-3 py-2.5 text-neutral-900">{fmtDuration(r.seconds)}</td>
                    <td className="px-3 py-2.5 text-neutral-500">{new Date(r.lastActive).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
