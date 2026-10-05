import { useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, Checkbox, EmptyState, Modal, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';
import { ResetExamModal } from './ResetExamModal';
import type { Tables } from '../../lib/database.types';

type Course = Tables<'courses'>;

interface Row {
  studentId: string;
  name: string;
  email: string;
  used: number;
  extra: number;
  allowed: number;
  best: number | null;
  inProgress: boolean;
  locked: boolean;
  certified: boolean;
  waitUntil: string | null;
}

/** Admin: give individual students more attempts at a course's exam. */
export function ExamAttempts({ course }: { course: Course }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [onlyOut, setOnlyOut] = useState(false);
  const [amount, setAmount] = useState<Record<string, number>>({});
  const [skipWait, setSkipWait] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const q = useQuery(async () => {
    const [enrolled, attempts, certs] = await Promise.all([
      unwrap(
        supabase
          .from('enrollments')
          .select('student_id, status, extra_attempts, student:profiles!enrollments_student_id_fkey(full_name, email)')
          .eq('course_id', course.id)
          .neq('status', 'revoked'),
      ) as Promise<{ student_id: string; status: string; extra_attempts: number; student: { full_name: string; email: string } | null }[]>,
      unwrap(
        supabase.from('exam_attempts').select('student_id, status, score_pct, locked, cooldown_until').eq('course_id', course.id),
      ) as Promise<{ student_id: string; status: string; score_pct: number | null; locked: boolean; cooldown_until: string | null }[]>,
      unwrap(supabase.from('certificates').select('student_id').eq('course_id', course.id).eq('revoked', false)) as Promise<{ student_id: string }[]>,
    ]);
    return { enrolled, attempts, certs };
  }, [course.id]);

  const rows = useMemo<Row[]>(() => {
    if (!q.data) return [];
    const certified = new Set(q.data.certs.map((c) => c.student_id));
    return q.data.enrolled
      .map((e) => {
        const mine = q.data!.attempts.filter((a) => a.student_id === e.student_id);
        const finished = mine.filter((a) => a.status !== 'in_progress');
        const best = finished.length ? Math.max(...finished.map((a) => Number(a.score_pct ?? 0))) : null;
        const wait = finished.map((a) => a.cooldown_until).filter((d): d is string => !!d && new Date(d) > new Date()).sort().pop() ?? null;
        return {
          studentId: e.student_id,
          name: e.student?.full_name || e.student?.email || 'Student',
          email: e.student?.email ?? '',
          used: finished.length,
          extra: e.extra_attempts ?? 0,
          allowed: Math.max(0, course.max_attempts + (e.extra_attempts ?? 0)),
          best,
          inProgress: mine.some((a) => a.status === 'in_progress'),
          locked: mine.some((a) => a.locked),
          certified: certified.has(e.student_id),
          waitUntil: wait,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q.data, course.max_attempts]);

  const outOfAttempts = (r: Row) => !r.certified && !r.inProgress && r.used >= r.allowed;
  const shown = rows.filter((r) => {
    const s = search.trim().toLowerCase();
    if (s && !r.name.toLowerCase().includes(s) && !r.email.toLowerCase().includes(s)) return false;
    return !onlyOut || outOfAttempts(r);
  });
  const outCount = rows.filter(outOfAttempts).length;

  const give = async (r: Row, extra: number) => {
    setBusy(r.studentId);
    const { error } = await supabase.rpc('grant_exam_attempts', { p_student_id: r.studentId, p_course_id: course.id, p_extra: extra, p_skip_wait: skipWait });
    setBusy(null);
    if (error) return toast(error.message, 'error');
    const total = Math.max(0, r.allowed + extra);
    toast(extra > 0 ? `${r.name} now has ${total} attempts in total` : `${r.name} is now allowed ${total} attempt${total === 1 ? '' : 's'} in total`);
    q.refetch();
  };

  const giveAllOut = async () => {
    setBulkBusy(true);
    let done = 0;
    let failed = 0;
    for (const r of rows.filter(outOfAttempts)) {
      const { error } = await supabase.rpc('grant_exam_attempts', { p_student_id: r.studentId, p_course_id: course.id, p_extra: 1, p_skip_wait: skipWait });
      if (error) failed++;
      else done++;
    }
    setBulkBusy(false);
    setBulk(false);
    toast(failed ? `Gave an extra attempt to ${done}, ${failed} failed` : `Gave an extra attempt to ${done} student${done === 1 ? '' : 's'}`, failed ? 'error' : undefined);
    q.refetch();
  };

  if (q.loading && !q.data) return <Spinner />;
  if (q.error) return <p className="text-sm text-red-600">{q.error}</p>;

  const status = (r: Row) => {
    if (r.certified) return <Badge tone="green">Passed</Badge>;
    if (r.inProgress) return <Badge tone="blue">Taking it now</Badge>;
    if (r.used >= r.allowed) return <Badge tone="red">No attempts left</Badge>;
    if (r.waitUntil) return <Badge tone="amber">Waiting</Badge>;
    return <Badge tone="neutral">{r.used === 0 ? 'Not started' : 'Can retry'}</Badge>;
  };

  return (
    <div className="space-y-4">
      <GlassCard className="p-5">
        <h2 className="font-semibold text-neutral-900">Extra attempts</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Everyone gets <strong>{course.max_attempts}</strong> attempt{course.max_attempts === 1 ? '' : 's'} by default (change it under Settings). Give a student more here (or take some away, down to zero): the student is notified. An extra attempt can be used even after a scheduled exam window has
          closed. Taking attempts away never deletes attempts already used; use Reset exam for that. Their best score counts.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[14rem] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <TextInput className="pl-9" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Checkbox label={`Only students out of attempts (${outCount})`} checked={onlyOut} onChange={(e) => setOnlyOut(e.target.checked)} />
          <Checkbox label="Let them start right away (skip waiting time)" checked={skipWait} onChange={(e) => setSkipWait(e.target.checked)} />
          <Button variant="secondary" disabled={!outCount} onClick={() => setBulk(true)}>
            Give +1 to all {outCount} out of attempts
          </Button>
          <Button variant="secondary" className="text-red-600" onClick={() => setResetOpen(true)}>
            <Trash2 size={15} /> Reset exam…
          </Button>
        </div>
      </GlassCard>

      {!shown.length ? (
        <EmptyState title="No students to show" description={rows.length ? 'Try a different search.' : 'Nobody is enrolled in this course yet.'} />
      ) : (
        <GlassCard className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/60 text-xs uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Attempts used</th>
                <th className="px-4 py-3 font-medium">Best</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Give or take away</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.studentId} className="border-b border-white/40 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{r.name}</div>
                    <div className="text-xs text-neutral-400">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.used} / {r.allowed}
                    {r.extra > 0 && <span className="ml-1.5 text-xs text-blue-600">(+{r.extra} extra)</span>}
                    {r.extra < 0 && <span className="ml-1.5 text-xs text-red-600">({r.extra} fewer)</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-neutral-600">{r.best === null ? '—' : `${r.best}%`}</td>
                  <td className="px-4 py-3">{status(r)}</td>
                  <td className="px-4 py-3">
                    {r.certified ? (
                      <span className="text-xs text-neutral-400">Already passed</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <Select value={amount[r.studentId] ?? 1} onChange={(e) => setAmount((p) => ({ ...p, [r.studentId]: Number(e.target.value) }))}>
                            {[1, 2, 3, 5].map((n) => (
                              <option key={n} value={n}>
                                +{n}
                              </option>
                            ))}
                            {[-1, -2, -3].map((n) => (
                              <option key={n} value={n}>
                                − {Math.abs(n)}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Button
                          variant="secondary"
                          loading={busy === r.studentId}
                          className={(amount[r.studentId] ?? 1) < 0 ? 'text-red-600' : ''}
                          onClick={() => give(r, amount[r.studentId] ?? 1)}
                        >
                          {(amount[r.studentId] ?? 1) < 0 ? 'Take away' : 'Give'}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      {resetOpen && (
        <ResetExamModal
          course={course}
          composite={course.scoring_mode === 'composite'}
          students={rows.map((r) => ({ id: r.studentId, name: r.name, email: r.email }))}
          onClose={() => setResetOpen(false)}
          onDone={() => q.refetch()}
        />
      )}

      <Modal open={bulk} onClose={() => setBulk(false)} title="Give everyone one more attempt?">
        <p className="text-sm text-neutral-600">
          {outCount} student{outCount === 1 ? '' : 's'} {outCount === 1 ? 'has' : 'have'} used every attempt. Each will get one more and a notification.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setBulk(false)}>
            Cancel
          </Button>
          <Button onClick={giveAllOut} loading={bulkBusy}>
            Give +1 to {outCount}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
