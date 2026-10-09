import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, CalendarPlus, ClipboardList, FileText, ListChecks, Plus, Rocket, Trash2, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, Checkbox, EmptyState, Field, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';
import {
  FIELD_TYPE_LABEL,
  KIND_LABEL,
  MODE_LABEL,
  ROUND_KIND_LABEL,
  newFieldId,
  parseFields,
  toLocalInput,
  windowState,
  type FieldType,
  type FormField,
  type JobKind,
  type RoundKind,
  type WorkMode,
} from '../../lib/careers';
import { CareerApplications } from './CareerApplications';
import { ExtendApplyModal } from '../../components/ExtendApplyModal';

interface Job {
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
  jd: string;
  terms: string;
  form_fields: unknown;
  ask_resume: boolean;
  apply_starts_at: string | null;
  apply_ends_at: string | null;
  status: string;
}
export interface RoundRow {
  id: string;
  job_id: string;
  position: number;
  name: string;
  kind: RoundKind;
  exam_course_id: string | null;
  pass_score: number | null;
  description: string;
}

type Tab = 'details' | 'form' | 'process' | 'applications';

/** One position: its job description and terms, application form, apply window, interview rounds and applicants. */
export function AdminCareerJob() {
  const { id } = useParams();
  const nav = useNavigate();
  const { canWrite } = useAdminAccess();
  const ro = !canWrite('careers');
  const [tab, setTab] = useState<Tab>('applications');
  const [extending, setExtending] = useState(false);

  const q = useQuery(async () => {
    const [job, rounds, courses] = await Promise.all([
      unwrap(supabase.from('careers_jobs').select('*').eq('id', id as string).maybeSingle()) as Promise<Job | null>,
      unwrap(supabase.from('careers_rounds').select('*').eq('job_id', id as string).order('position')) as Promise<RoundRow[]>,
      unwrap(supabase.from('courses').select('id, title, status').order('title')) as Promise<{ id: string; title: string; status: string }[]>,
    ]);
    return { job, rounds, courses };
  }, [id]);

  if (q.loading && !q.data) return <Spinner />;
  const job = q.data?.job;
  if (!job)
    return (
      <EmptyState
        icon={<FileText size={22} />}
        title="Position not found"
        description="It may have been deleted."
        action={<Button onClick={() => nav('/admin/careers')}>Back to Careers</Button>}
      />
    );
  const state = windowState(job);
  const tabs: [Tab, string, typeof Users][] = [
    ['applications', 'Applications', Users],
    ['details', 'Details, JD and terms', FileText],
    ['form', 'Application form', ClipboardList],
    ['process', 'Interview process', ListChecks],
  ];

  return (
    <div>
      <Link to="/admin/careers" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
        <ArrowLeft size={14} /> All positions
      </Link>
      <PageHeader
        title={job.title}
        subtitle={`${KIND_LABEL[job.kind]} · ${MODE_LABEL[job.work_mode]}${job.department ? ` · ${job.department}` : ''}`}
        actions={
          <>
            {!ro && (state === 'live' || state === 'closed') && (
              <Button variant="secondary" onClick={() => setExtending(true)}>
                <CalendarPlus size={15} /> {state === 'closed' ? 'Reopen and extend' : 'Extend time'}
              </Button>
            )}
          <Badge tone={state === 'live' ? 'green' : state === 'upcoming' ? 'blue' : state === 'closed' ? 'red' : 'neutral'}>
            {state === 'live' ? 'Accepting applications' : state === 'upcoming' ? 'Opens soon' : state === 'closed' ? 'Closed' : 'Draft'}
          </Badge>
          </>
        }
      />

      {extending && <ExtendApplyModal job={job} onClose={() => setExtending(false)} onDone={() => q.refetch()} />}

      <div className="mb-5 inline-flex flex-wrap rounded-full border border-white/60 bg-white/50 p-1 text-sm">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition-colors ${tab === key ? 'bg-[#1a1a1a] text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'details' && <DetailsTab key={job.id + job.status} job={job} ro={ro} onSaved={() => q.refetch()} />}
      {tab === 'form' && <FormTab key={job.id} job={job} ro={ro} onSaved={() => q.refetch()} />}
      {tab === 'process' && <ProcessTab key={job.id} jobId={job.id} rounds={q.data!.rounds} courses={q.data!.courses} ro={ro} onSaved={() => q.refetch()} />}
      {tab === 'applications' && <CareerApplications job={job} rounds={q.data!.rounds} ro={ro} />}
    </div>
  );
}

/* ────────────────────────────── details ────────────────────────────── */

function DetailsTab({ job, ro, onSaved }: { job: Job; ro: boolean; onSaved: () => void }) {
  const toast = useToast();
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(() => ({
    title: job.title,
    kind: job.kind,
    work_mode: job.work_mode,
    department: job.department,
    location: job.location,
    openings: job.openings,
    pay: job.pay,
    summary: job.summary,
    jd: job.jd,
    terms: job.terms,
    ask_resume: job.ask_resume,
    starts: toLocalInput(job.apply_starts_at),
    ends: toLocalInput(job.apply_ends_at),
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = async (status?: string) => {
    if (f.title.trim().length < 3) return toast('The title needs at least 3 characters', 'error');
    if (f.starts && f.ends && new Date(f.ends) <= new Date(f.starts)) return toast('The closing time must be after the opening time', 'error');
    const next = status ?? job.status;
    if (next === 'open') {
      if (!f.jd.trim()) return toast('Write the job description before publishing', 'error');
      if (!f.terms.trim()) return toast('Add the terms and conditions before publishing', 'error');
      if (!f.ends && !confirm('No closing time is set, so applications stay open until you close them yourself. Publish anyway?')) return;
      if (job.status !== 'open' && !confirm('Publish this position? Every active student gets a notification on their dashboard.')) return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('careers_jobs')
      .update({
        title: f.title.trim(),
        kind: f.kind,
        work_mode: f.work_mode,
        department: f.department.trim(),
        location: f.location.trim(),
        openings: Math.max(1, Number(f.openings) || 1),
        pay: f.pay.trim(),
        summary: f.summary.trim(),
        jd: f.jd,
        terms: f.terms,
        ask_resume: f.ask_resume,
        apply_starts_at: f.starts ? new Date(f.starts).toISOString() : null,
        apply_ends_at: f.ends ? new Date(f.ends).toISOString() : null,
        status: next,
      })
      .eq('id', job.id);
    setSaving(false);
    if (error) return toast(error.message, 'error');
    toast(status === 'open' ? 'Published. Students have been notified' : status === 'closed' ? 'Applications closed' : 'Saved');
    onSaved();
  };

  const remove = async () => {
    if (!confirm('Delete this position and every application to it? This cannot be undone.')) return;
    const { error } = await supabase.from('careers_jobs').delete().eq('id', job.id);
    if (error) return toast(error.message, 'error');
    toast('Position deleted');
    nav('/admin/careers');
  };

  return (
    <div className="space-y-5">
      {ro && <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">You have read-only access to Careers.</div>}

      <GlassCard className="p-5">
        <h2 className="font-semibold text-neutral-900">The role</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Position title">
            <TextInput disabled={ro} value={f.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Type">
            <Select disabled={ro} value={f.kind} onChange={(e) => set('kind', e.target.value as JobKind)}>
              {(Object.keys(KIND_LABEL) as JobKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department / team">
            <TextInput disabled={ro} value={f.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g. Flight operations" />
          </Field>
          <Field label="Location">
            <TextInput disabled={ro} value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Visakhapatnam" />
          </Field>
          <Field label="Work mode">
            <Select disabled={ro} value={f.work_mode} onChange={(e) => set('work_mode', e.target.value as WorkMode)}>
              {(Object.keys(MODE_LABEL) as WorkMode[]).map((k) => (
                <option key={k} value={k}>
                  {MODE_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Openings">
            <TextInput type="number" min={1} disabled={ro} value={f.openings} onChange={(e) => set('openings', Number(e.target.value))} />
          </Field>
          <Field label="Stipend / salary" hint="Shown to students, e.g. ₹10,000 per month">
            <TextInput disabled={ro} value={f.pay} onChange={(e) => set('pay', e.target.value)} />
          </Field>
          <Field label="One-line summary" hint="Shown on the dashboard card">
            <TextInput disabled={ro} maxLength={400} value={f.summary} onChange={(e) => set('summary', e.target.value)} />
          </Field>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="font-semibold text-neutral-900">Job description</h2>
        <p className="mt-0.5 text-xs text-neutral-500">Responsibilities, requirements, skills, what the student will learn. Blank lines make paragraphs; start a line with “- ” for a bullet.</p>
        <div className="mt-3">
          <TextArea rows={12} disabled={ro} value={f.jd} onChange={(e) => set('jd', e.target.value)} placeholder={'About the role\n\nResponsibilities\n- ...\n\nRequirements\n- ...'} />
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="font-semibold text-neutral-900">Terms and conditions</h2>
        <p className="mt-0.5 text-xs text-neutral-500">Students must tick that they accept these before they can submit an application.</p>
        <div className="mt-3">
          <TextArea rows={8} disabled={ro} value={f.terms} onChange={(e) => set('terms', e.target.value)} placeholder="Selection is at the company's discretion. Candidates must attend every round. Documents may be verified…" />
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="font-semibold text-neutral-900">Apply window</h2>
        <p className="mt-0.5 text-xs text-neutral-500">Students see these times on their dashboard. They can only submit between them.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Applications open" hint="Leave empty to open as soon as you publish">
            <TextInput type="datetime-local" disabled={ro} value={f.starts} onChange={(e) => set('starts', e.target.value)} />
          </Field>
          <Field label="Applications close" hint="Leave empty to keep it open until you close it">
            <TextInput type="datetime-local" disabled={ro} value={f.ends} onChange={(e) => set('ends', e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Checkbox label="Ask applicants to upload a resume (PDF or Word, up to 5 MB)" checked={f.ask_resume} disabled={ro} onChange={(e) => set('ask_resume', e.target.checked)} />
        </div>
        {job.status === 'open' && (
          <p className="mt-3 text-xs text-neutral-500">Changing the dates of an open position sends students a fresh notification.</p>
        )}
      </GlassCard>

      {!ro && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="text-red-600" onClick={remove}>
            <Trash2 size={15} /> Delete position
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => save()} loading={saving}>
              Save
            </Button>
            {job.status === 'open' ? (
              <Button variant="danger" onClick={() => save('closed')} disabled={saving}>
                Close applications
              </Button>
            ) : (
              <Button onClick={() => save('open')} loading={saving}>
                <Rocket size={15} /> {job.status === 'closed' ? 'Reopen' : 'Publish'} and notify students
              </Button>
            )}
            {job.status !== 'draft' && (
              <Button variant="ghost" onClick={() => save('draft')} disabled={saving}>
                Back to draft
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── application form ───────────────────────────── */

function FormTab({ job, ro, onSaved }: { job: Job; ro: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [fields, setFields] = useState<FormField[]>(() => parseFields(job.form_fields));
  const [saving, setSaving] = useState(false);

  const patch = (i: number, p: Partial<FormField>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const move = (i: number, d: number) =>
    setFields((fs) => {
      const j = i + d;
      if (j < 0 || j >= fs.length) return fs;
      const n = [...fs];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const save = async () => {
    for (const f of fields) {
      if (!f.label.trim()) return toast('Every question needs some text', 'error');
      if (f.type === 'select' && (f.options?.filter((o) => o.trim()).length ?? 0) < 2) return toast(`“${f.label}” needs at least two choices`, 'error');
    }
    setSaving(true);
    const clean = fields.map((f) => ({ ...f, label: f.label.trim(), options: f.type === 'select' ? f.options?.map((o) => o.trim()).filter(Boolean) : undefined }));
    const { error } = await supabase.from('careers_jobs').update({ form_fields: clean }).eq('id', job.id);
    setSaving(false);
    if (error) return toast(error.message, 'error');
    toast('Application form saved');
    onSaved();
  };

  return (
    <div className="space-y-4">
      <GlassCard className="p-5">
        <h2 className="font-semibold text-neutral-900">Application form</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Every applicant&apos;s name, email and phone come from their profile{job.ask_resume ? ', and they upload a resume' : ''}. Add whatever else you want to ask.
        </p>

        {!fields.length ? (
          <p className="mt-4 text-sm text-neutral-500">No extra questions yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {fields.map((f, i) => (
              <div key={f.id} className="rounded-2xl border border-white/60 bg-white/50 p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
                  <Field label={`Question ${i + 1}`}>
                    <TextInput disabled={ro} value={f.label} maxLength={200} onChange={(e) => patch(i, { label: e.target.value })} placeholder="e.g. Why do you want this internship?" />
                  </Field>
                  <Field label="Answer type">
                    <Select disabled={ro} value={f.type} onChange={(e) => patch(i, { type: e.target.value as FieldType, options: e.target.value === 'select' ? f.options ?? ['', ''] : undefined })}>
                      {(Object.keys(FIELD_TYPE_LABEL) as FieldType[]).map((t) => (
                        <option key={t} value={t}>
                          {FIELD_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {f.type === 'select' && (
                  <div className="mt-3">
                    <Field label="Choices" hint="One per line">
                      <TextArea rows={3} disabled={ro} value={(f.options ?? []).join('\n')} onChange={(e) => patch(i, { options: e.target.value.split('\n') })} />
                    </Field>
                  </div>
                )}
                {!ro && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <Checkbox label="Required" checked={f.required} onChange={(e) => patch(i, { required: e.target.checked })} />
                    <div className="flex gap-1">
                      <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">
                        <ArrowUp size={14} />
                      </Button>
                      <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === fields.length - 1} title="Move down">
                        <ArrowDown size={14} />
                      </Button>
                      <Button variant="ghost" className="text-red-600" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} title="Remove">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!ro && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setFields((fs) => [...fs, { id: newFieldId(), label: '', type: 'text', required: true }])}>
              <Plus size={15} /> Add a question
            </Button>
            {fields.length === 0 && (
              <Button
                variant="ghost"
                onClick={() =>
                  setFields([
                    { id: newFieldId(), label: 'College / university', type: 'text', required: true },
                    { id: newFieldId(), label: 'Year of study / graduation year', type: 'text', required: true },
                    { id: newFieldId(), label: 'Why do you want this role?', type: 'textarea', required: true },
                    { id: newFieldId(), label: 'Link to your portfolio or LinkedIn', type: 'url', required: false },
                  ])
                }
              >
                Start from a standard set
              </Button>
            )}
          </div>
        )}
      </GlassCard>

      {!ro && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>
            Save form
          </Button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── interview process ───────────────────────────── */

type RoundDraft = Omit<RoundRow, 'job_id'> & { isNew?: boolean };

function ProcessTab({
  jobId,
  rounds,
  courses,
  ro,
  onSaved,
}: {
  jobId: string;
  rounds: RoundRow[];
  courses: { id: string; title: string; status: string }[];
  ro: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [list, setList] = useState<RoundDraft[]>(() => rounds.map((r) => ({ ...r })));
  const [saving, setSaving] = useState(false);
  const removedIds = useMemo(() => rounds.filter((r) => !list.some((x) => x.id === r.id)).map((r) => r.id), [rounds, list]);

  useEffect(() => setList(rounds.map((r) => ({ ...r }))), [rounds]);

  const patch = (i: number, p: Partial<RoundDraft>) => setList((l) => l.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const move = (i: number, d: number) =>
    setList((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const add = (kind: RoundKind) =>
    setList((l) => [
      ...l,
      { id: crypto.randomUUID(), position: l.length, name: ROUND_KIND_LABEL[kind], kind, exam_course_id: null, pass_score: kind === 'online_test' ? 50 : null, description: '', isNew: true },
    ]);

  const save = async () => {
    for (const r of list) if (r.name.trim().length < 2) return toast('Every round needs a name', 'error');
    setSaving(true);
    try {
      if (removedIds.length) {
        const { error } = await supabase.from('careers_rounds').delete().in('id', removedIds);
        if (error) throw error;
      }
      const rows = list.map((r, i) => ({
        id: r.id,
        job_id: jobId,
        position: i,
        name: r.name.trim(),
        kind: r.kind,
        exam_course_id: r.kind === 'online_test' ? r.exam_course_id : null,
        pass_score: r.kind === 'online_test' ? r.pass_score : null,
        description: r.description.trim(),
      }));
      if (rows.length) {
        const { error } = await supabase.from('careers_rounds').upsert(rows, { onConflict: 'id' });
        if (error) throw error;
      }
      toast('Interview process saved');
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard className="p-5">
        <h2 className="font-semibold text-neutral-900">Interview process</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          The rounds a candidate goes through, in order. On the Applications tab you move each candidate into a round, schedule it, and record the result.
          A <strong>Online test</strong> round can use a course&apos;s questions: the candidate is enrolled in that course&apos;s exam automatically, and the score comes back here.
        </p>

        {!list.length ? (
          <p className="mt-4 text-sm text-neutral-500">No rounds yet. Add the first one below.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {list.map((r, i) => (
              <li key={r.id} className="rounded-2xl border border-white/60 bg-white/50 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-xs font-semibold text-white">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                      <Field label="Round name">
                        <TextInput disabled={ro} value={r.name} onChange={(e) => patch(i, { name: e.target.value })} />
                      </Field>
                      <Field label="Kind">
                        <Select disabled={ro} value={r.kind} onChange={(e) => patch(i, { kind: e.target.value as RoundKind })}>
                          {(Object.keys(ROUND_KIND_LABEL) as RoundKind[]).map((k) => (
                            <option key={k} value={k}>
                              {ROUND_KIND_LABEL[k]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    {r.kind === 'online_test' && (
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                        <Field label="Test questions come from" hint="A published course. Set its time limit and attempts in Exams.">
                          <Select disabled={ro} value={r.exam_course_id ?? ''} onChange={(e) => patch(i, { exam_course_id: e.target.value || null })}>
                            <option value="">Not linked (enter scores by hand)</option>
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                                {c.status !== 'published' ? ' (not published)' : ''}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Pass score (%)">
                          <TextInput type="number" min={0} max={100} disabled={ro} value={r.pass_score ?? ''} onChange={(e) => patch(i, { pass_score: e.target.value === '' ? null : Number(e.target.value) })} />
                        </Field>
                      </div>
                    )}
                    <Field label="What happens in this round" hint="Shown to the candidate, e.g. 30 minute video call with the flight lead">
                      <TextInput disabled={ro} value={r.description} maxLength={2000} onChange={(e) => patch(i, { description: e.target.value })} />
                    </Field>
                  </div>
                  {!ro && (
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">
                        <ArrowUp size={14} />
                      </Button>
                      <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === list.length - 1} title="Move down">
                        <ArrowDown size={14} />
                      </Button>
                      <Button variant="ghost" className="text-red-600" onClick={() => setList((l) => l.filter((_, j) => j !== i))} title="Remove round">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {!ro && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(ROUND_KIND_LABEL) as RoundKind[]).map((k) => (
              <Button key={k} variant="secondary" onClick={() => add(k)}>
                <Plus size={14} /> {ROUND_KIND_LABEL[k]}
              </Button>
            ))}
            {!list.length && (
              <Button
                variant="ghost"
                onClick={() =>
                  setList([
                    { id: crypto.randomUUID(), position: 0, name: 'Resume screening', kind: 'screening', exam_course_id: null, pass_score: null, description: 'We review your application and resume.', isNew: true },
                    { id: crypto.randomUUID(), position: 1, name: 'Online test', kind: 'online_test', exam_course_id: null, pass_score: 50, description: 'A timed online test.', isNew: true },
                    { id: crypto.randomUUID(), position: 2, name: 'Technical interview', kind: 'interview', exam_course_id: null, pass_score: null, description: 'A conversation with the team about your skills.', isNew: true },
                    { id: crypto.randomUUID(), position: 3, name: 'HR interview', kind: 'hr', exam_course_id: null, pass_score: null, description: 'A conversation about expectations, availability and terms.', isNew: true },
                  ])
                }
              >
                Start from a standard process
              </Button>
            )}
          </div>
        )}
        {removedIds.length > 0 && <p className="mt-3 text-xs text-amber-700">Saving removes {removedIds.length} round{removedIds.length === 1 ? '' : 's'}, along with any candidate results recorded in {removedIds.length === 1 ? 'it' : 'them'}.</p>}
      </GlassCard>

      {!ro && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>
            Save interview process
          </Button>
        </div>
      )}
    </div>
  );
}
