import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, ClipboardCheck, Download, Eye, FileSpreadsheet, FileText, Search, Settings2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { invokeFn } from '../../lib/functions';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';
import { exportMarkSheet, type SheetFormat, type SheetPart } from '../../lib/markSheet';
import { evaluate, type Scheme } from '../../lib/assessment';
import { ReportCardView } from '../student/ReportCard';
import type { Tables } from '../../lib/database.types';

type Course = Tables<'courses'>;
type Component = 'viva' | 'simulation' | 'piloting';

const round2 = (n: number) => Math.round(n * 100) / 100;

const MODULE_ROWS = [
  { label: 'Online exam', max: 'marks_online', pass: 'pass_marks_online' },
  { label: 'Viva', max: 'marks_viva', pass: 'pass_marks_viva' },
  { label: 'Simulation', max: 'marks_simulation', pass: 'pass_marks_simulation' },
  { label: 'Free flight (real FPV piloting)', max: 'marks_piloting', pass: 'pass_marks_piloting' },
] as const;
const num = (v: number | string | null | undefined) => Number(v ?? 0);

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function accessSummary(c: Course) {
  if (c.exam_access === 'closed') return 'Closed — students cannot start the online exam';
  if (c.exam_access === 'scheduled') {
    const from = c.exam_opens_at ? new Date(c.exam_opens_at).toLocaleString() : 'now';
    const to = c.exam_closes_at ? new Date(c.exam_closes_at).toLocaleString() : 'no end';
    return `Scheduled: ${from} to ${to}`;
  }
  return 'Open — students can start the online exam any time';
}

export function AdminExams() {
  const { profile } = useAuth();
  const { canWrite } = useAdminAccess();
  const canMark = canWrite('exams');
  // Exam rules are an admin decision; instructors with write access only enter marks.
  const canConfigure = profile?.role === 'admin' || profile?.role === 'super_admin';
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'settings' | 'marks' | null>(null);

  const q = useQuery(() => unwrap(supabase.from('courses').select('*').order('title')) as Promise<Course[]>, []);

  const courses = useMemo(
    () =>
      [...(q.data ?? [])].sort(
        (a, b) => Number(b.scoring_mode === 'composite') - Number(a.scoring_mode === 'composite') || a.title.localeCompare(b.title),
      ),
    [q.data],
  );
  const selected = courses.find((c) => c.id === params.get('course')) ?? courses[0];
  const composite = selected?.scoring_mode === 'composite';
  const activeTab = composite ? tab ?? (canConfigure ? 'settings' : 'marks') : 'settings';

  if (q.loading && !q.data) return <Spinner />;
  if (!selected) return <EmptyState icon={<ClipboardCheck size={22} />} title="No courses yet" description="Create a course first, then configure its exam here." />;

  return (
    <div>
      <PageHeader
        title="Exams"
        subtitle="Exam rules, scoring and student marks — all in one place"
        actions={
          <Select value={selected.id} onChange={(e) => setParams({ course: e.target.value })} className="w-80">
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.scoring_mode === 'composite' ? ' — 100-mark assessment' : ''}
              </option>
            ))}
          </Select>
        }
      />

      {composite && (
        <div className="mb-5 inline-flex rounded-full border border-white/60 bg-white/50 p-1 text-sm">
          {(
            [
              ['settings', 'Settings', Settings2],
              ['marks', 'Student marks', ClipboardCheck],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition-colors ${
                activeTab === key ? 'bg-[#1a1a1a] text-white' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'marks' && composite ? (
        <MarksPanel key={selected.id} course={selected} canMark={canMark} canExport={canConfigure} />
      ) : (
        <SettingsPanel key={selected.id} course={selected} canConfigure={canConfigure} onSaved={() => q.refetch()} />
      )}
    </div>
  );
}

/* ─────────────────────────────── settings ─────────────────────────────── */

function SettingsPanel({ course, canConfigure, onSaved }: { course: Course; canConfigure: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(() => ({
    exam_access: course.exam_access as string,
    opens: toLocalInput(course.exam_opens_at),
    closes: toLocalInput(course.exam_closes_at),
    exam_time_limit_min: course.exam_time_limit_min,
    exam_question_count: course.exam_question_count,
    max_attempts: course.max_attempts,
    cooldown_hours: course.cooldown_hours,
    pass_pct: course.pass_pct,
    allow_backtrack: course.allow_backtrack,
    show_review: course.show_review,
    scoring_mode: course.scoring_mode as string,
    marks_online: num(course.marks_online),
    marks_viva: num(course.marks_viva),
    marks_simulation: num(course.marks_simulation),
    marks_piloting: num(course.marks_piloting),
    merit_min_marks: num(course.merit_min_marks),
    pass_marks_online: num(course.pass_marks_online),
    pass_marks_viva: num(course.pass_marks_viva),
    pass_marks_simulation: num(course.pass_marks_simulation),
    pass_marks_piloting: num(course.pass_marks_piloting),
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const isComposite = f.scoring_mode === 'composite';
  const totalMarks = round2(f.marks_online + f.marks_viva + f.marks_simulation + f.marks_piloting);
  const ro = !canConfigure;

  const save = async () => {
    if (f.exam_access === 'scheduled' && !f.opens && !f.closes) return toast('Pick an opening and/or closing time', 'error');
    if (f.opens && f.closes && new Date(f.closes) <= new Date(f.opens)) return toast('The closing time must be after the opening time', 'error');
    if (f.exam_time_limit_min < 1) return toast('Time limit must be at least 1 minute', 'error');
    if (f.exam_question_count < 1) return toast('The exam needs at least 1 question', 'error');
    if (f.max_attempts < 1) return toast('Allow at least 1 attempt', 'error');
    if (f.cooldown_hours < 0) return toast('Cooldown cannot be negative', 'error');
    if (isComposite) {
      if ([f.marks_online, f.marks_viva, f.marks_simulation, f.marks_piloting].some((m) => m < 0)) return toast('Marks cannot be negative', 'error');
      if (totalMarks <= 0) return toast('The marks must add up to more than 0', 'error');
      if (f.merit_min_marks > totalMarks) return toast(`The Merit mark can't be more than the total (${totalMarks})`, 'error');
      for (const m of MODULE_ROWS) {
        const pass = f[m.pass];
        if (pass < 0 || pass > f[m.max]) return toast(`${m.label}: the pass mark must be between 0 and ${f[m.max]}`, 'error');
      }
    }
    setSaving(true);
    const { error } = await supabase
      .from('courses')
      .update({
        exam_access: f.exam_access,
        exam_opens_at: f.exam_access === 'scheduled' && f.opens ? new Date(f.opens).toISOString() : null,
        exam_closes_at: f.exam_access === 'scheduled' && f.closes ? new Date(f.closes).toISOString() : null,
        exam_time_limit_min: f.exam_time_limit_min,
        exam_question_count: f.exam_question_count,
        max_attempts: f.max_attempts,
        cooldown_hours: f.cooldown_hours,
        pass_pct: f.pass_pct,
        allow_backtrack: f.allow_backtrack,
        show_review: f.show_review,
        scoring_mode: f.scoring_mode,
        marks_online: f.marks_online,
        marks_viva: f.marks_viva,
        marks_simulation: f.marks_simulation,
        marks_piloting: f.marks_piloting,
        merit_min_marks: f.merit_min_marks,
        pass_marks_online: f.pass_marks_online,
        pass_marks_viva: f.pass_marks_viva,
        pass_marks_simulation: f.pass_marks_simulation,
        pass_marks_piloting: f.pass_marks_piloting,
      })
      .eq('id', course.id);
    setSaving(false);
    if (error) return toast(error.message, 'error');
    toast('Exam settings saved');
    onSaved();
  };

  const numberField = (label: string, k: 'exam_time_limit_min' | 'exam_question_count' | 'max_attempts' | 'cooldown_hours' | 'pass_pct', hint?: string) => (
    <Field label={label} hint={hint}>
      <TextInput type="number" min={0} disabled={ro} value={f[k]} onChange={(e) => set(k, Number(e.target.value))} />
    </Field>
  );
  const checkbox = (label: string, hint: string, k: 'allow_backtrack' | 'show_review') => (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/60 bg-white/40 p-3">
      <input type="checkbox" className="mt-1 h-4 w-4" disabled={ro} checked={f[k]} onChange={(e) => set(k, e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-neutral-900">{label}</span>
        <span className="block text-xs text-neutral-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-5">
      {ro && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
          Only admins can change exam settings. You can still enter student marks from the “Student marks” tab.
        </div>
      )}

      <GlassCard className="p-5">
        <h2 className="font-semibold text-neutral-900">Online exam availability</h2>
        <p className="mt-0.5 text-xs text-neutral-500">{accessSummary({ ...course, exam_access: f.exam_access })}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Who can start the online exam">
            <Select disabled={ro} value={f.exam_access} onChange={(e) => set('exam_access', e.target.value)}>
              <option value="open">Open — any time</option>
              <option value="closed">Closed — nobody can start</option>
              <option value="scheduled">Scheduled — only between set times</option>
            </Select>
          </Field>
          {numberField('Exam duration (minutes)', 'exam_time_limit_min', 'Applies to attempts started from now on')}
          {f.exam_access === 'scheduled' && (
            <>
              <Field label="Opens at" hint="Leave empty to open immediately">
                <TextInput type="datetime-local" disabled={ro} value={f.opens} onChange={(e) => set('opens', e.target.value)} />
              </Field>
              <Field label="Closes at" hint="Leave empty for no end time">
                <TextInput type="datetime-local" disabled={ro} value={f.closes} onChange={(e) => set('closes', e.target.value)} />
              </Field>
            </>
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="font-semibold text-neutral-900">Attempts and questions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {numberField('Attempts allowed', 'max_attempts', '1 = a single attempt, no retake')}
          {numberField('Questions per exam', 'exam_question_count')}
          {numberField('Wait between attempts (hours)', 'cooldown_hours', 'Only matters with more than 1 attempt')}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {checkbox('Allow going back to earlier questions', 'Untick for forward-only: once a student moves on, they cannot return.', 'allow_backtrack')}
          {checkbox('Show wrong answers after submitting', 'Students see each question they missed with the correct answer and an explanation.', 'show_review')}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="font-semibold text-neutral-900">Scoring and certificates</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="How the result is decided">
            <Select disabled={ro} value={f.scoring_mode} onChange={(e) => set('scoring_mode', e.target.value)}>
              <option value="exam_only">Online exam only — certificate when the pass mark is reached</option>
              <option value="composite">Total marks — online exam + viva + simulation + piloting</option>
            </Select>
          </Field>
          {!isComposite && numberField('Pass mark (%)', 'pass_pct', 'A certificate is issued automatically when a student reaches this')}
        </div>

        {isComposite && (
          <>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/60 bg-white/40">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                    <th className="px-4 py-2.5">Module</th>
                    <th className="px-4 py-2.5">Total marks</th>
                    <th className="px-4 py-2.5">Pass mark</th>
                    <th className="px-4 py-2.5">= % needed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/50">
                  {MODULE_ROWS.map((m) => (
                    <tr key={m.max}>
                      <td className="px-4 py-2 font-medium text-neutral-900">{m.label}</td>
                      <td className="px-4 py-2">
                        <div className="w-24">
                          <TextInput type="number" min={0} step="0.5" disabled={ro} value={f[m.max]} onChange={(e) => set(m.max, Number(e.target.value))} />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="w-24">
                          <TextInput type="number" min={0} step="0.25" disabled={ro} value={f[m.pass]} onChange={(e) => set(m.pass, Number(e.target.value))} />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-neutral-500">{f[m.max] ? Math.round((f[m.pass] / f[m.max]) * 1000) / 10 : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canConfigure && (
              <button
                type="button"
                className="mt-2 text-xs font-medium text-blue-600 hover:underline"
                onClick={() =>
                  setF((p) => ({
                    ...p,
                    pass_marks_online: round2(p.marks_online * 0.75),
                    pass_marks_viva: Math.min(8, p.marks_viva),
                    pass_marks_simulation: round2(p.marks_simulation * 0.8),
                    pass_marks_piloting: round2(p.marks_piloting * 0.8),
                  }))
                }
              >
                Reset to the standard pass marks (Online exam 75%, Viva 8 marks, Simulation 80%, Free flight 80%)
              </button>
            )}
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
              <strong>Every module must be cleared.</strong> A student who falls below the pass mark in <em>any one</em> module has not cleared the assessment — however high the
              total is. Clearing everything is what earns a Merit certificate; otherwise the student gets a Participation certificate.
            </div>
            <div className={`mt-3 text-sm ${totalMarks === 100 ? 'text-green-700' : 'text-amber-700'}`}>
              Total: <span className="font-semibold">{totalMarks}</span> marks{totalMarks !== 100 && ' (usually 100)'}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Merit certificate also needs a total of (marks)" hint="On top of clearing every module. With the standard pass marks anyone who clears them all already scores 75.25 or more.">
                <TextInput type="number" min={0} step="0.5" disabled={ro} value={f.merit_min_marks} onChange={(e) => set('merit_min_marks', Number(e.target.value))} />
              </Field>
            </div>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-neutral-500">
              <li>Passing the online exam does <strong>not</strong> issue a certificate by itself.</li>
              <li>Instructors enter viva, simulation and free flight marks per student in the “Student marks” tab.</li>
              <li>When a student’s four modules are complete, an admin issues the certificate: it is emailed with a module-by-module report card, and the student sees it under Report card.</li>
            </ul>
          </>
        )}
      </GlassCard>

      {canConfigure && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>
            Save exam settings
          </Button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── student marks ───────────────────────────── */

interface EnrolledStudent {
  student_id: string;
  student: { full_name: string; email: string } | null;
}

const COMPONENTS: { key: Component; label: string; field: 'marks_viva' | 'marks_simulation' | 'marks_piloting' }[] = [
  { key: 'viva', label: 'Viva', field: 'marks_viva' },
  { key: 'simulation', label: 'Simulation', field: 'marks_simulation' },
  { key: 'piloting', label: 'Real piloting', field: 'marks_piloting' },
];

function MarksPanel({ course, canMark, canExport }: { course: Course; canMark: boolean; canExport: boolean }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [issuing, setIssuing] = useState<string | null>(null);
  // Printable / Excel mark sheets for rounds examined offline (pen and paper first).
  const [sheetOpen, setSheetOpen] = useState(false);
  // Shows what a student will see on their report card, before the certificate is issued.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheet, setSheet] = useState<{ part: SheetPart; format: SheetFormat; withMarks: boolean; withEmail: boolean }>({
    part: 'viva',
    format: 'pdf',
    withMarks: false,
    withEmail: true,
  });

  const q = useQuery(async () => {
    const [enrolled, marks, attempts, certs] = await Promise.all([
      unwrap(
        supabase
          .from('enrollments')
          .select('student_id, student:profiles!enrollments_student_id_fkey(full_name, email)')
          .eq('course_id', course.id)
          .neq('status', 'revoked'),
      ) as unknown as Promise<EnrolledStudent[]>,
      unwrap(supabase.from('assessment_marks').select('student_id, component, marks').eq('course_id', course.id)) as Promise<
        { student_id: string; component: Component; marks: number }[]
      >,
      unwrap(supabase.from('exam_attempts').select('student_id, score_pct').eq('course_id', course.id).neq('status', 'in_progress')) as Promise<
        { student_id: string; score_pct: number | null }[]
      >,
      unwrap(supabase.from('certificates').select('student_id, cert_id_string, cert_type').eq('course_id', course.id).eq('revoked', false)) as Promise<
        { student_id: string; cert_id_string: string; cert_type: string | null }[]
      >,
    ]);
    return { enrolled, marks, attempts, certs };
  }, [course.id]);

  const onlineMax = num(course.marks_online);
  const maxTotal = round2(onlineMax + num(course.marks_viva) + num(course.marks_simulation) + num(course.marks_piloting));
  const merit = num(course.merit_min_marks);
  // Pass marks per module. A student must reach every one of them; total never makes up for a miss.
  const scheme: Scheme = {
    max: { online: onlineMax, viva: num(course.marks_viva), simulation: num(course.marks_simulation), piloting: num(course.marks_piloting) },
    pass: {
      online: num(course.pass_marks_online),
      viva: num(course.pass_marks_viva),
      simulation: num(course.pass_marks_simulation),
      piloting: num(course.pass_marks_piloting),
    },
    meritMin: merit,
  };

  const rows = useMemo(() => {
    if (!q.data) return [];
    const marksBy = new Map<string, Partial<Record<Component, number>>>();
    for (const m of q.data.marks) marksBy.set(m.student_id, { ...marksBy.get(m.student_id), [m.component]: num(m.marks) });
    const bestBy = new Map<string, number>();
    for (const a of q.data.attempts) bestBy.set(a.student_id, Math.max(bestBy.get(a.student_id) ?? 0, num(a.score_pct)));
    const certBy = new Map(q.data.certs.map((c) => [c.student_id, c]));

    return q.data.enrolled
      .map((e) => {
        const m = marksBy.get(e.student_id) ?? {};
        const best = bestBy.get(e.student_id);
        const onlineRaw = best === undefined ? undefined : (best / 100) * onlineMax;
        const online = onlineRaw === undefined ? undefined : round2(onlineRaw);
        const missing = [
          ...(online === undefined ? ['online exam'] : []),
          ...COMPONENTS.filter((c) => m[c.key] === undefined).map((c) => c.label.toLowerCase()),
        ];
        const sum = round2((online ?? 0) + (m.viva ?? 0) + (m.simulation ?? 0) + (m.piloting ?? 0));
        const ev =
          onlineRaw !== undefined && m.viva !== undefined && m.simulation !== undefined && m.piloting !== undefined
            ? evaluate(scheme, { online: onlineRaw, viva: m.viva, simulation: m.simulation, piloting: m.piloting })
            : null;
        return {
          id: e.student_id,
          name: e.student?.full_name || e.student?.email || 'Student',
          email: e.student?.email ?? '',
          marks: m,
          online,
          onlineRaw,
          ev,
          missing,
          complete: missing.length === 0,
          sum,
          cert: certBy.get(e.student_id),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, course]);

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => !s || r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s));
  }, [rows, search]);

  const ready = rows.filter((r) => r.complete && !r.cert);
  const readyMerit = ready.filter((r) => r.ev?.result === "Merit").length;
  const notCleared = rows.filter((r) => r.ev && !r.ev.clearedAll).length;
  const issued = rows.filter((r) => r.cert).length;

  const saveMark = async (studentId: string, component: Component, value: number | null): Promise<boolean> => {
    const { error } =
      value === null
        ? await supabase.from('assessment_marks').delete().eq('course_id', course.id).eq('student_id', studentId).eq('component', component)
        : await supabase
            .from('assessment_marks')
            .upsert({ course_id: course.id, student_id: studentId, component, marks: value }, { onConflict: 'course_id,student_id,component' });
    if (error) {
      toast(error.message, 'error');
      return false;
    }
    q.refetch();
    return true;
  };

  const issue = async (ids: string[]) => {
    setIssuing(ids.length === 1 ? ids[0] : 'all');
    let done = 0;
    const problems: string[] = [];
    const nameOf = (id: string) => rows.find((r) => r.id === id)?.name ?? 'Student';
    for (let i = 0; i < ids.length; i += 5) {
      try {
        const res = await invokeFn<{ results: { student_id: string; status: string; message?: string; missing?: string[] }[] }>('finalize-assessment', {
          course_id: course.id,
          student_ids: ids.slice(i, i + 5),
        });
        for (const r of res.results) {
          if (r.status === 'issued') done++;
          else if (r.status === 'error') problems.push(`${nameOf(r.student_id)}: ${r.message}`);
          else if (r.status === 'incomplete') problems.push(`${nameOf(r.student_id)}: still missing ${r.missing?.join(', ')}`);
        }
      } catch (e) {
        problems.push((e as Error).message);
        break;
      }
    }
    setIssuing(null);
    if (done) toast(`${done} certificate${done > 1 ? 's' : ''} issued and emailed`);
    if (problems.length) toast(problems.slice(0, 3).join(' · '), 'error');
    q.refetch();
  };

  const issueAll = () => {
    const msg = `Issue ${ready.length} certificate${ready.length > 1 ? 's' : ''} now (${readyMerit} Merit — cleared every module, ${ready.length - readyMerit} Participation — did not clear every module)?\n\nEach student is emailed their certificate and a module-by-module report card. This cannot be undone without revoking the certificate.`;
    if (confirm(msg)) issue(ready.map((r) => r.id));
  };

  // One click: every student with every mark, the total and the Merit/Participation result.
  const [excelBusy, setExcelBusy] = useState(false);
  const quickExcel = async () => {
    setExcelBusy(true);
    try {
      await exportMarkSheet('xlsx', {
        course: course.title,
        part: 'all',
        max: { viva: num(course.marks_viva), simulation: num(course.marks_simulation), piloting: num(course.marks_piloting), online: onlineMax },
        withMarks: true,
        withEmail: true,
        scheme,
        students: rows.map((r) => ({ name: r.name, email: r.email, viva: r.marks.viva, simulation: r.marks.simulation, piloting: r.marks.piloting, online: r.online, onlineRaw: r.onlineRaw })),
      });
      toast(`Excel sheet for ${rows.length} students downloaded`);
    } catch (e) {
      toast((e as Error).message || 'Could not create the Excel sheet', 'error');
    } finally {
      setExcelBusy(false);
    }
  };

  const downloadSheet = async () => {
    setSheetBusy(true);
    try {
      await exportMarkSheet(sheet.format, {
        course: course.title,
        part: sheet.part,
        max: { viva: num(course.marks_viva), simulation: num(course.marks_simulation), piloting: num(course.marks_piloting), online: onlineMax },
        withMarks: sheet.withMarks,
        withEmail: sheet.withEmail,
        students: rows.map((r) => ({ name: r.name, email: r.email, viva: r.marks.viva, simulation: r.marks.simulation, piloting: r.marks.piloting, online: r.online, onlineRaw: r.onlineRaw })),
      });
      toast(`${sheet.format === 'pdf' ? 'PDF' : 'Excel'} sheet for ${rows.length} students downloaded`);
      setSheetOpen(false);
    } catch (e) {
      toast((e as Error).message || 'Could not create the sheet', 'error');
    } finally {
      setSheetBusy(false);
    }
  };

  if (q.loading && !q.data) return <Spinner />;

  return (
    <div>
      <GlassCard className="mb-4 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-600">
          <span>
            <span className="font-semibold text-neutral-900">{rows.length}</span> students
          </span>
          <span>
            <span className="font-semibold text-neutral-900">{ready.length}</span> ready for certificates
          </span>
          <span>
            <span className="font-semibold text-neutral-900">{issued}</span> issued
          </span>
          {notCleared > 0 && (
            <span>
              <span className="font-semibold text-red-600">{notCleared}</span> not cleared every module
            </span>
          )}
          <span className="text-neutral-500">
            Out of {maxTotal} · Merit from {merit}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <Button variant="secondary" onClick={() => setSheetOpen(true)} disabled={!rows.length}>
              <Download size={15} /> PDF / blank sheet
            </Button>
          )}
          {canMark && (
            <Button onClick={issueAll} disabled={!ready.length} loading={issuing === 'all'}>
              <Award size={15} /> Issue {ready.length || ''} certificate{ready.length === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      </GlassCard>

      <div className="mb-3 text-xs text-neutral-500">
        Online exam: {accessSummary(course)}. Enter the viva, simulation and piloting marks here as each round happens; the online exam score fills in
        by itself when a student submits.
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-72 max-w-full">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <TextInput placeholder="Find a student…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canExport && (
          <Button variant="secondary" onClick={quickExcel} loading={excelBusy} disabled={!rows.length}>
            <FileSpreadsheet size={15} /> Export Excel
          </Button>
        )}
      </div>

      {!rows.length ? (
        <EmptyState icon={<ClipboardCheck size={22} />} title="No students enrolled" description="Enroll students in this course (or add it to a course group) to enter their marks." />
      ) : (
        <GlassCard className="overflow-x-auto p-2">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="px-3 py-3">Student</th>
                {COMPONENTS.map((c) => (
                  <th key={c.key} className="px-3 py-3">
                    {c.label} <span className="normal-case text-neutral-300">/ {num(course[c.field])}</span>
                    <div className="text-[10px] normal-case tracking-normal text-neutral-400">pass {scheme.pass[c.key]}</div>
                  </th>
                ))}
                <th className="px-3 py-3">
                  Online <span className="normal-case text-neutral-300">/ {onlineMax}</span>
                  <div className="text-[10px] normal-case tracking-normal text-neutral-400">pass {scheme.pass.online}</div>
                </th>
                <th className="px-3 py-3">
                  Total <span className="normal-case text-neutral-300">/ {maxTotal}</span>
                </th>
                <th className="px-3 py-3">Result</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-neutral-900">{r.name}</div>
                    <div className="text-xs text-neutral-500">{r.email}</div>
                  </td>
                  {COMPONENTS.map((c) => (
                    <td key={c.key} className="px-3 py-2">
                      <MarkInput
                        initial={r.marks[c.key]}
                        max={num(course[c.field])}
                        pass={scheme.pass[c.key]}
                        disabled={!canMark || !!r.cert}
                        onSave={(v) => saveMark(r.id, c.key, v)}
                      />
                    </td>
                  ))}
                  <td
                    className={`px-3 py-2 ${r.onlineRaw !== undefined && r.onlineRaw + 1e-9 < scheme.pass.online ? 'font-semibold text-red-600' : 'text-neutral-700'}`}
                    title={r.onlineRaw !== undefined && r.onlineRaw + 1e-9 < scheme.pass.online ? `Below the pass mark (${scheme.pass.online})` : undefined}
                  >
                    {r.online === undefined ? <span className="text-neutral-300">—</span> : r.online}
                  </td>
                  <td className={`px-3 py-2 font-semibold ${r.complete ? 'text-neutral-900' : 'text-neutral-400'}`}>{r.sum}</td>
                  <td className="px-3 py-2">
                    {r.cert ? (
                      <div>
                        <Badge tone={(r.cert.cert_type ?? '').toLowerCase() === 'merit' ? 'green' : 'blue'}>{r.cert.cert_type ?? 'Issued'}</Badge>
                        <div className="mt-0.5 font-mono text-[10px] text-neutral-400">{r.cert.cert_id_string}</div>
                      </div>
                    ) : r.complete ? (
<div>
                        <Badge tone="amber">Ready · {r.ev?.result ?? 'Participation'}</Badge>
                        {r.ev && !r.ev.clearedAll && <div className="mt-0.5 text-[11px] font-medium text-red-600">Not cleared: {r.ev.failed.join(', ')}</div>}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">Waiting: {r.missing.join(', ')}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {r.ev && (
                        <Button variant="ghost" onClick={() => setPreviewId(r.id)} title="See this student's report card">
                          <Eye size={14} /> Preview
                        </Button>
                      )}
                      {canMark && r.complete && !r.cert && (
                        <Button variant="secondary" onClick={() => issue([r.id])} loading={issuing === r.id}>
                          Issue
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}
      <p className="mt-3 text-xs text-neutral-400">
        Marks save when you leave a box or press Enter. Clear a box to remove its mark. Marks lock once a certificate is issued — revoke it in Certificates to
        correct them.
      </p>

      {previewId &&
        (() => {
          const r = rows.find((x) => x.id === previewId);
          if (!r?.ev) return null;
          return (
            <Modal open onClose={() => setPreviewId(null)} title="Report card preview" wide>
              <ReportCardView
                course={course.title}
                studentName={r.name}
                issuedAt={new Date().toISOString()}
                certId={r.cert?.cert_id_string}
                certType={r.ev.result}
                report={r.ev}
                preview={r.cert ? 'Preview — current marks' : 'Preview — not issued yet'}
              />
              <p className="mt-3 text-xs text-neutral-500">
                Built from the marks and pass marks as they are right now. The student only sees their report card after you issue the certificate.
              </p>
            </Modal>
          );
        })()}

      {canExport && sheetOpen && (
        <Modal open onClose={() => setSheetOpen(false)} title="Export a mark sheet">
          <div className="space-y-5">
            <p className="text-sm text-neutral-600">
              A list of all {rows.length} students for instructors who examine offline — write the marks on paper, then enter them here afterwards.
            </p>

            <Field label="Sheet for">
              <Select value={sheet.part} onChange={(e) => setSheet((p) => ({ ...p, part: e.target.value as SheetPart }))}>
                <option value="viva">Viva (out of {num(course.marks_viva)})</option>
                <option value="simulation">Simulation (out of {num(course.marks_simulation)})</option>
                <option value="piloting">Real FPV piloting (out of {num(course.marks_piloting)})</option>
                <option value="all">All three parts together</option>
              </Select>
            </Field>

            <div>
              <div className="mb-1.5 text-sm font-medium text-neutral-700">File type</div>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['pdf', 'PDF', 'Print it and fill in by hand', FileText],
                    ['xlsx', 'Excel (.xlsx)', 'Edit or type in a spreadsheet', FileSpreadsheet],
                  ] as const
                ).map(([key, label, hint, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={sheet.format === key}
                    onClick={() => setSheet((p) => ({ ...p, format: key }))}
                    className={`rounded-2xl border p-3 text-left transition-colors ${
                      sheet.format === key ? 'border-neutral-900 bg-white' : 'border-white/60 bg-white/40 hover:bg-white/70'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                      <Icon size={16} /> {label}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">{hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/60 bg-white/50 p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={sheet.withMarks}
                  onChange={(e) => setSheet((p) => ({ ...p, withMarks: e.target.checked }))}
                />
                <span>
                  <span className="block text-sm font-medium text-neutral-900">Include marks entered so far</span>
                  <span className="block text-xs text-neutral-500">Leave unticked for a blank sheet with empty boxes to write in.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/60 bg-white/50 p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={sheet.withEmail}
                  onChange={(e) => setSheet((p) => ({ ...p, withEmail: e.target.checked }))}
                />
                <span>
                  <span className="block text-sm font-medium text-neutral-900">Show email addresses</span>
                  <span className="block text-xs text-neutral-500">Helps tell apart students with the same name.</span>
                </span>
              </label>
            </div>

            {sheet.format === 'pdf' && (
              <p className="text-xs text-neutral-400">PDF supports English letters only; names in other scripts will show as “?”. Use Excel for those.</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button onClick={downloadSheet} loading={sheetBusy}>
                <Download size={15} /> Download {sheet.format === 'pdf' ? 'PDF' : 'Excel'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MarkInput({
  initial,
  max,
  pass,
  disabled,
  onSave,
}: {
  initial: number | undefined;
  max: number;
  /** A saved mark below this shows in red: that module is not cleared. */
  pass?: number;
  disabled: boolean;
  onSave: (value: number | null) => Promise<boolean>;
}) {
  const [val, setVal] = useState(initial === undefined ? '' : String(initial));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    setVal(initial === undefined ? '' : String(initial));
  }, [initial]);

  const commit = async () => {
    const trimmed = val.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && (Number.isNaN(value) || value < 0 || value > max)) return setState('error');
    if ((value ?? undefined) === initial) return setState('idle');
    setState('saving');
    setState((await onSave(value)) ? 'saved' : 'error');
  };

  const below = pass !== undefined && initial !== undefined && initial + 1e-9 < pass;
  const ring = state === 'error' ? 'border-red-400' : below ? 'border-red-300 text-red-600' : state === 'saved' ? 'border-green-400' : 'border-white/70';
  return (
    <input
      type="number"
      min={0}
      max={max}
      step="0.5"
      disabled={disabled}
      value={val}
      onChange={(e) => {
        setVal(e.target.value);
        setState('idle');
      }}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      title={state === 'error' ? `Enter a number from 0 to ${max}` : below ? `Below the pass mark (${pass}) — not cleared` : undefined}
      className={`w-20 rounded-lg border bg-white/70 px-2 py-1.5 text-sm outline-none focus:border-neutral-400 disabled:opacity-60 ${ring}`}
    />
  );
}
