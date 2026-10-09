import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, MapPin, Pencil, Search, Star, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { invokeFn } from '../../lib/functions';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { downloadCsv } from '../../lib/csv';
import type { Tables } from '../../lib/database.types';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';
import { KIND_LABEL, KIND_TONE, RUN_LABEL, RUN_TONE, fmtDay, hours, runState, type GroupKind, type RosterRow } from '../../lib/workshops';

type Group = Tables<'course_groups'>;
type Tab = 'students' | 'reviews';
type Filter = 'all' | 'passed' | 'failed' | 'not_taken';

const stars = (n: number | null) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—');

/** One workshop or event: only its own students, with their results, marks, certificates and reviews. */
export function AdminWorkshopDetail() {
  const { id } = useParams();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('workshops');
  const [tab, setTab] = useState<Tab>('students');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openStudent, setOpenStudent] = useState<RosterRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const q = useQuery(async () => {
    const [group, roster, courses] = await Promise.all([
      unwrap(supabase.from('course_groups').select('*').eq('id', id as string).maybeSingle()) as Promise<Group | null>,
      supabase.rpc('workshop_roster', { p_group: id as string }).then((r) => {
        if (r.error) throw new Error(r.error.message);
        return (r.data ?? []) as unknown as RosterRow[];
      }),
      unwrap(supabase.from('course_group_courses').select('courses(id, title)').eq('group_id', id as string)) as unknown as Promise<{ courses: { id: string; title: string } | null }[]>,
    ]);
    return { group, roster, courses: courses.map((c) => c.courses).filter((c): c is { id: string; title: string } => !!c) };
  }, [id]);

  const roster = useMemo(() => q.data?.roster ?? [], [q.data]);
  const rows = roster.filter((r) => {
    if (search.trim() && !`${r.full_name} ${r.email} ${r.phone}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (filter === 'passed') return r.courses_passed > 0;
    if (filter === 'not_taken') return r.attempts === 0;
    if (filter === 'failed') return r.attempts > 0 && r.courses_passed === 0;
    return true;
  });

  const stats = useMemo(() => {
    const took = roster.filter((r) => r.attempts > 0);
    const scored = roster.filter((r) => r.best_score !== null);
    const rated = roster.filter((r) => r.review_rating !== null);
    return {
      students: roster.length,
      took: took.length,
      avg: scored.length ? scored.reduce((a, r) => a + Number(r.best_score), 0) / scored.length : null,
      passed: roster.filter((r) => r.courses_passed > 0).length,
      certs: roster.reduce((a, r) => a + r.certificates, 0),
      hours: roster.reduce((a, r) => a + r.study_seconds, 0),
      rating: rated.length ? rated.reduce((a, r) => a + (r.review_rating ?? 0), 0) / rated.length : null,
      reviews: rated.length,
    };
  }, [roster]);

  if (q.loading && !q.data) return <Spinner />;
  if (q.error) return <EmptyState title="Could not open this workshop" description={q.error} />;
  const g = q.data?.group;
  if (!g) return <EmptyState title="This workshop was not found" description="It may have been deleted." />;
  const run = runState(g);

  const exportCsv = () =>
    downloadCsv(
      `${g.code ?? 'workshop'}-students-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'Email', 'Phone', 'Status', 'Joined', 'Courses enrolled', 'Exam attempts', 'Best score %', 'Courses passed', 'Certificates', 'Marks', 'Study hours', 'Review stars'],
      roster.map((r) => [r.full_name, r.email, r.phone, r.status, new Date(r.joined_at).toLocaleDateString('en-GB'), r.courses_enrolled, r.attempts, r.best_score ?? '', r.courses_passed, r.certificates, r.marks_total ?? '', (r.study_seconds / 3600).toFixed(1), r.review_rating ?? '']),
    );

  const remove = async (r: RosterRow) => {
    if (!confirm(`Remove ${r.full_name} from this ${KIND_LABEL[g.kind as GroupKind].toLowerCase()}? Their account, results and certificates stay.`)) return;
    const { error } = await supabase.from('course_group_members').delete().eq('group_id', g.id).eq('student_id', r.student_id);
    if (!error) q.refetch();
  };

  return (
    <div>
      <Link to="/admin/workshops" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
        <ArrowLeft size={14} /> All workshops and events
      </Link>
      <PageHeader
        title={g.name}
        subtitle={[g.organizer, g.venue, g.starts_on ? `${fmtDay(g.starts_on)}${g.ends_on && g.ends_on !== g.starts_on ? ` to ${fmtDay(g.ends_on)}` : ''}` : ''].filter(Boolean).join(' · ')}
        actions={
          <>
            <span className="rounded-md bg-neutral-900 px-2 py-1 font-mono text-xs font-semibold text-white">{g.code}</span>
            <Badge tone={KIND_TONE[g.kind as GroupKind]}>{KIND_LABEL[g.kind as GroupKind]}</Badge>
            {g.kind !== 'regular' && <Badge tone={RUN_TONE[run]}>{RUN_LABEL[run]}</Badge>}
            {writable && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Edit
              </Button>
            )}
          </>
        }
      />

      {q.data!.courses.length > 0 && (
        <div className="-mt-3 mb-4 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <MapPin size={12} className="hidden" /> Courses:
          {q.data!.courses.map((c) => (
            <Badge key={c.id}>{c.title}</Badge>
          ))}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          [stats.students, 'Students'],
          [`${stats.took}/${stats.students}`, 'Took the exam'],
          [stats.avg === null ? '—' : `${stats.avg.toFixed(1)}%`, 'Average best score'],
          [stats.passed, 'Passed'],
          [stats.certs, 'Certificates'],
          [hours(stats.hours), 'Study time'],
          [stats.rating === null ? '—' : `${stats.rating.toFixed(1)} ★ (${stats.reviews})`, 'Reviews'],
        ].map(([v, label]) => (
          <GlassCard key={String(label)} className="p-4">
            <div className="text-xl font-semibold text-neutral-900">{v}</div>
            <div className="text-xs text-neutral-500">{label}</div>
          </GlassCard>
        ))}
      </div>

      <div className="mb-4 inline-flex rounded-full border border-white/60 bg-white/50 p-1 text-sm">
        {(['students', 'reviews'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 font-medium ${tab === t ? 'bg-[#1a1a1a] text-white' : 'text-neutral-600 hover:text-neutral-900'}`}>
            {t === 'students' ? `Students (${roster.length})` : `Reviews (${stats.reviews})`}
          </button>
        ))}
      </div>

      {tab === 'students' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <TextInput className="!pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search this ${KIND_LABEL[g.kind as GroupKind].toLowerCase()}'s students…`} />
            </div>
            <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="!w-auto">
              <option value="all">All students</option>
              <option value="passed">Passed</option>
              <option value="failed">Took the exam, not passed</option>
              <option value="not_taken">Has not taken the exam</option>
            </Select>
            <span className="text-sm text-neutral-500">
              {rows.length} of {roster.length}
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={exportCsv} disabled={!roster.length}>
                <Download size={15} /> Export CSV
              </Button>
              {writable && (
                <Button onClick={() => setAdding(true)}>
                  <UserPlus size={15} /> Add students
                </Button>
              )}
            </div>
          </div>

          {!rows.length ? (
            <EmptyState title={roster.length ? 'No students match' : 'No students yet'} description={roster.length ? 'Try a different search or filter.' : writable ? 'Use Add students to bring them into this workshop.' : undefined} />
          ) : (
            <GlassCard className="overflow-x-auto p-2">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2 text-center">Courses</th>
                    <th className="px-3 py-2 text-center">Attempts</th>
                    <th className="px-3 py-2 text-center">Best score</th>
                    <th className="px-3 py-2 text-center">Passed</th>
                    <th className="px-3 py-2 text-center">Certificates</th>
                    <th className="px-3 py-2 text-center">Marks</th>
                    <th className="px-3 py-2 text-center">Study</th>
                    <th className="px-3 py-2 text-center">Review</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.student_id} className="border-t border-white/60">
                      <td className="px-3 py-2">
                        <button className="text-left" onClick={() => setOpenStudent(r)}>
                          <div className="font-medium text-neutral-900 hover:underline">{r.full_name || r.email}</div>
                          <div className="text-xs text-neutral-500">
                            {r.email}
                            {r.status !== 'active' ? ` · ${r.status}` : ''}
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center">{r.courses_enrolled}</td>
                      <td className="px-3 py-2 text-center">{r.attempts || '·'}</td>
                      <td className="px-3 py-2 text-center font-medium text-neutral-900">{r.best_score === null ? '·' : `${Number(r.best_score).toFixed(0)}%`}</td>
                      <td className="px-3 py-2 text-center">{r.courses_passed ? <Badge tone="green">{r.courses_passed}</Badge> : '·'}</td>
                      <td className="px-3 py-2 text-center">{r.certificates || '·'}</td>
                      <td className="px-3 py-2 text-center">{r.marks_total ?? '·'}</td>
                      <td className="px-3 py-2 text-center text-neutral-600">{hours(r.study_seconds)}</td>
                      <td className="px-3 py-2 text-center text-amber-500">{stars(r.review_rating)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="secondary" onClick={() => setOpenStudent(r)}>
                          Report
                        </Button>
                        {writable && (
                          <button onClick={() => remove(r)} className="ml-2 text-neutral-300 hover:text-red-500" aria-label="Remove from this workshop">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          )}
        </>
      ) : (
        <ReviewsTab groupId={g.id} />
      )}

      {openStudent && <StudentReport group={g} student={openStudent} onClose={() => setOpenStudent(null)} />}
      {editing && writable && <EditWorkshop group={g} onClose={() => setEditing(false)} onSaved={() => q.refetch()} />}
      {adding && writable && <AddStudents group={g} onClose={() => setAdding(false)} onDone={() => q.refetch()} />}
    </div>
  );
}

function ReviewsTab({ groupId }: { groupId: string }) {
  const q = useQuery(
    () => unwrap(supabase.from('reviews').select('id, rating, comment, created_at, student:profiles!reviews_student_id_fkey(full_name, email)').eq('group_id', groupId).order('created_at', { ascending: false })) as unknown as Promise<{ id: string; rating: number; comment: string; created_at: string; student: { full_name: string; email: string } | null }[]>,
    [groupId],
  );
  if (q.loading && !q.data) return <Spinner />;
  if (!q.data?.length) return <EmptyState icon={<Star size={22} />} title="No reviews yet" description="Students review this workshop from their Reviews page." />;
  return (
    <div className="space-y-3">
      {q.data.map((r) => (
        <GlassCard key={r.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium text-neutral-900">{r.student?.full_name || r.student?.email}</div>
            <div className="text-sm text-amber-500">{stars(r.rating)}</div>
          </div>
          {r.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{r.comment}</p>}
          <div className="mt-1 text-xs text-neutral-400">{new Date(r.created_at).toLocaleDateString('en-GB')}</div>
        </GlassCard>
      ))}
    </div>
  );
}

interface Report {
  courses: {
    course_id: string;
    title: string;
    enrollment: string | null;
    attempts: { no: number; status: string; score: number | null; passed: boolean | null; at: string | null }[];
    certificate: { id: string; issued_at: string; revoked: boolean } | null;
    marks: { component: string; marks: number }[];
    study_seconds: number;
  }[];
  review: { rating: number; comment: string; at: string } | null;
}

function StudentReport({ group, student, onClose }: { group: Group; student: RosterRow; onClose: () => void }) {
  const q = useQuery(
    () =>
      (async () => {
        const r = await supabase.rpc('workshop_student_report', { p_group: group.id, p_student: student.student_id });
        if (r.error) throw new Error(r.error.message);
        return r.data as unknown as Report;
      })(),
    [group.id, student.student_id],
  );
  return (
    <Modal open onClose={onClose} title={`${student.full_name || student.email} · ${group.code}`} wide>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="text-sm text-neutral-600">
          {student.email}
          {student.phone ? ` · ${student.phone}` : ''} · joined {new Date(student.joined_at).toLocaleDateString('en-GB')}. Everything below is only for {group.name}.
        </div>
        {q.loading && !q.data ? (
          <Spinner />
        ) : q.error ? (
          <p className="text-sm text-red-600">{q.error}</p>
        ) : (
          <>
            {q.data!.courses.map((c) => (
              <GlassCard key={c.course_id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-neutral-900">{c.title}</div>
                  <div className="flex items-center gap-2">
                    {c.enrollment ? <Badge tone={c.enrollment === 'completed' ? 'green' : 'blue'}>{c.enrollment}</Badge> : <Badge>not enrolled</Badge>}
                    {c.certificate && <Badge tone={c.certificate.revoked ? 'red' : 'green'}>{c.certificate.revoked ? 'Certificate revoked' : `Certificate ${c.certificate.id}`}</Badge>}
                  </div>
                </div>
                <div className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Exam attempts</div>
                    {c.attempts.length ? (
                      <ul className="space-y-0.5">
                        {c.attempts.map((a) => (
                          <li key={a.no}>
                            #{a.no}: {a.score === null ? a.status : `${Number(a.score).toFixed(0)}%`}
                            {a.passed ? ' · passed' : a.passed === false ? ' · not passed' : ''}
                            {a.at ? ` · ${new Date(a.at).toLocaleDateString('en-GB')}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-neutral-400">None yet</span>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Marks</div>
                    {c.marks.length ? (
                      <ul className="space-y-0.5">
                        {c.marks.map((m) => (
                          <li key={m.component} className="capitalize">
                            {m.component}: {m.marks}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-neutral-400">No marks entered</span>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Study time</div>
                    {hours(c.study_seconds)}
                  </div>
                </div>
              </GlassCard>
            ))}
            <GlassCard className="p-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Review of this {KIND_LABEL[group.kind as GroupKind].toLowerCase()}</div>
              {q.data!.review ? (
                <>
                  <div className="text-amber-500">{stars(q.data!.review.rating)}</div>
                  {q.data!.review.comment && <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{q.data!.review.comment}</p>}
                </>
              ) : (
                <span className="text-sm text-neutral-400">No review yet</span>
              )}
            </GlassCard>
          </>
        )}
      </div>
    </Modal>
  );
}

function EditWorkshop({ group, onClose, onSaved }: { group: Group; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ kind: group.kind as GroupKind, name: group.name, organizer: group.organizer, venue: group.venue, starts_on: group.starts_on ?? '', ends_on: group.ends_on ?? '', description: group.description ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (f.name.trim().length < 3) return toast('Give it a name', 'error');
    setBusy(true);
    const { error } = await supabase
      .from('course_groups')
      .update({ name: f.name.trim(), kind: f.kind, organizer: f.organizer.trim(), venue: f.venue.trim(), starts_on: f.starts_on || null, ends_on: f.ends_on || null, description: f.description.trim() || null } as never)
      .eq('id', group.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Saved');
    onSaved();
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Edit ${group.code}`}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" hint={f.kind !== group.kind ? 'Changing the type gives it a new ID.' : undefined}>
            <Select value={f.kind} onChange={set('kind')}>
              <option value="workshop">Workshop</option>
              <option value="event">Event</option>
              <option value="regular">Regular batch</option>
            </Select>
          </Field>
          <Field label="Name" required>
            <TextInput value={f.name} onChange={set('name')} />
          </Field>
          <Field label="College or organiser">
            <TextInput value={f.organizer} onChange={set('organizer')} />
          </Field>
          <Field label="Venue">
            <TextInput value={f.venue} onChange={set('venue')} />
          </Field>
          <Field label="Starts on">
            <TextInput type="date" value={f.starts_on} onChange={set('starts_on')} />
          </Field>
          <Field label="Ends on">
            <TextInput type="date" value={f.ends_on} onChange={set('ends_on')} />
          </Field>
        </div>
        <Field label="Notes">
          <TextArea rows={2} value={f.description} onChange={set('description')} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddStudents({ group, onClose, onDone }: { group: Group; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [people, setPeople] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const list = people
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [email, ...rest] = l.split(/[,\t]/);
        return { email: email.trim(), full_name: rest.join(' ').trim() };
      });
    if (!list.length) return toast('Add at least one email', 'error');
    setBusy(true);
    try {
      const res = await invokeFn<{ created: number; existing: number; skipped: number; results: { email: string; outcome: string; note?: string }[] }>('add-students', { people: list.slice(0, 100), group_ids: [group.id] });
      const skipped = res.results.filter((r) => r.outcome === 'skipped');
      toast(`${res.created} new and ${res.existing} existing students added${skipped.length ? `. ${skipped.length} skipped: ${skipped[0].email} (${skipped[0].note})` : ''}`, skipped.length ? 'error' : undefined);
      onDone();
      if (!skipped.length) onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add them', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Add students to ${group.code}`}>
      <div className="space-y-4">
        <Field label="Students" hint="One per line: email, then the name. New people get an account and a welcome email; they are put in this workshop only.">
          <TextArea rows={8} value={people} onChange={(e) => setPeople(e.target.value)} placeholder={'asha@example.com, Asha Rao\nravi@example.com, Ravi Kumar'} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Add students
          </Button>
        </div>
      </div>
    </Modal>
  );
}
