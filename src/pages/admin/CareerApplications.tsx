import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ExternalLink, FileSignature, FileText, Mail, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { downloadCsv } from '../../lib/csv';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';
import {
  APP_STATUS_LABEL,
  APP_STATUS_TONE,
  ROUND_STATUS_LABEL,
  ROUND_STATUS_TONE,
  fmtDateTime,
  parseFields,
  toLocalInput,
  type AppStatus,
  type RoundStatus,
} from '../../lib/careers';
import type { RoundRow } from './AdminCareerJob';
import { CareerEmailModal } from '../../components/CareerEmailModal';
import { useOrgBrand } from '../../lib/useOrgBrand';
import type { EmailTemplateKey } from '../../lib/careerEmails';

interface AppRound {
  id: string;
  round_id: string;
  status: RoundStatus;
  scheduled_at: string | null;
  interviewer: string;
  meet_link: string;
  score: number | null;
  feedback: string;
}
export interface AppRow {
  id: string;
  job_id?: string;
  student_id: string;
  status: AppStatus;
  answers: Record<string, unknown>;
  resume_path: string | null;
  current_round_id: string | null;
  offer_note: string;
  created_at: string;
  student: { full_name: string; email: string; phone: string | null } | null;
  careers_application_rounds: AppRound[];
}
export interface JobLite {
  id: string;
  title: string;
  kind?: string;
  jd?: string;
  form_fields: unknown;
}

const FILTERS: (AppStatus | 'all')[] = ['all', 'applied', 'in_review', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn'];

/** The recruiter's pipeline for one position: every applicant, where they are, and what happens next. */
export function CareerApplications({ job, rounds, ro }: { job: JobLite; rounds: RoundRow[]; ro: boolean }) {
  const toast = useToast();
  const { profile } = useAuth();
  const canExport = profile?.role === 'admin' || profile?.role === 'super_admin';
  const [filter, setFilter] = useState<AppStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkRound, setBulkRound] = useState('');
  const [busy, setBusy] = useState(false);

  const q = useQuery(
    () =>
      unwrap(
        supabase
          .from('careers_applications')
          .select(
            'id, student_id, status, answers, resume_path, current_round_id, offer_note, created_at, student:profiles!careers_applications_student_id_fkey(full_name, email, phone), careers_application_rounds(id, round_id, status, scheduled_at, interviewer, meet_link, score, feedback)',
          )
          .eq('job_id', job.id)
          .order('created_at', { ascending: false }),
      ) as unknown as Promise<AppRow[]>,
    [job.id],
  );
  const apps = useMemo(() => q.data ?? [], [q.data]);
  const roundName = (id: string | null) => rounds.find((r) => r.id === id)?.name ?? '—';

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: apps.length };
    for (const a of apps) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [apps]);

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return apps.filter((a) => (filter === 'all' || a.status === filter) && (!s || a.student?.full_name.toLowerCase().includes(s) || a.student?.email.toLowerCase().includes(s)));
  }, [apps, filter, search]);

  const toggle = (id: string, on: boolean) =>
    setPicked((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const allShownPicked = shown.length > 0 && shown.every((a) => picked.has(a.id));

  const applyBulkStatus = async () => {
    if (!bulkStatus || !picked.size) return;
    if (!confirm(`Mark ${picked.size} applicant${picked.size === 1 ? '' : 's'} as “${APP_STATUS_LABEL[bulkStatus as AppStatus]}”? Each is notified on their dashboard.`)) return;
    setBusy(true);
    const { error } = await supabase.from('careers_applications').update({ status: bulkStatus }).in('id', [...picked]);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Updated');
    setPicked(new Set());
    setBulkStatus('');
    q.refetch();
  };

  const applyBulkRound = async () => {
    if (!bulkRound || !picked.size) return;
    if (!confirm(`Move ${picked.size} applicant${picked.size === 1 ? '' : 's'} into “${roundName(bulkRound)}”? Each is notified.`)) return;
    setBusy(true);
    let failed = 0;
    for (const id of picked) {
      const { error } = await supabase.rpc('careers_start_round', { p_application_id: id, p_round_id: bulkRound });
      if (error) failed++;
    }
    setBusy(false);
    toast(failed ? `${picked.size - failed} moved, ${failed} could not be moved (closed applications)` : 'Moved', failed ? 'error' : undefined);
    setPicked(new Set());
    setBulkRound('');
    q.refetch();
  };

  const syncScores = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('careers_sync_test_scores', { p_job_id: job.id });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast(data ? `Pulled ${data} online test result${data === 1 ? '' : 's'}` : 'No new test results yet');
    q.refetch();
  };

  const exportCsv = () => {
    const fields = parseFields(job.form_fields);
    const headers = ['Name', 'Email', 'Phone', 'Applied', 'Status', 'Current round', ...fields.map((f) => f.label), ...rounds.map((r) => `${r.name} result`)];
    const body = apps.map((a) => [
      a.student?.full_name ?? '',
      a.student?.email ?? '',
      a.student?.phone ?? '',
      new Date(a.created_at).toLocaleDateString('en-GB'),
      APP_STATUS_LABEL[a.status],
      roundName(a.current_round_id),
      ...fields.map((f) => String(a.answers?.[f.id] ?? '')),
      ...rounds.map((r) => {
        const ar = a.careers_application_rounds.find((x) => x.round_id === r.id);
        return ar ? `${ROUND_STATUS_LABEL[ar.status]}${ar.score !== null ? ` (${ar.score})` : ''}` : '';
      }),
    ]);
    downloadCsv(`applications-${job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`, headers, body);
  };

  if (q.loading && !q.data) return <Spinner />;
  const open = apps.find((a) => a.id === openId) ?? null;
  const hasTest = rounds.some((r) => r.kind === 'online_test' && r.exam_course_id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-64 max-w-full">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <TextInput placeholder="Find an applicant…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {hasTest && !ro && (
            <Button variant="secondary" onClick={syncScores} loading={busy}>
              <RefreshCw size={14} /> Pull test results
            </Button>
          )}
          {canExport && (
            <Button variant="secondary" onClick={exportCsv} disabled={!apps.length}>
              <Download size={14} /> Export CSV
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === s ? 'bg-[#1a1a1a] text-white' : 'bg-white/60 text-neutral-600 hover:bg-white'}`}
          >
            {s === 'all' ? 'Everyone' : APP_STATUS_LABEL[s]} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {!ro && picked.size > 0 && (
        <GlassCard className="mb-4 flex flex-wrap items-center gap-3 p-3 text-sm">
          <span className="font-medium text-neutral-900">{picked.size} selected</span>
          <div className="flex items-center gap-2">
            <div className="w-44">
              <Select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                <option value="">Change status…</option>
                {(['in_review', 'shortlisted', 'rejected'] as AppStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {APP_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="secondary" onClick={applyBulkStatus} disabled={!bulkStatus} loading={busy}>
              Apply
            </Button>
          </div>
          {rounds.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-48">
                <Select value={bulkRound} onChange={(e) => setBulkRound(e.target.value)}>
                  <option value="">Move to a round…</option>
                  {rounds.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button variant="secondary" onClick={applyBulkRound} disabled={!bulkRound} loading={busy}>
                Move
              </Button>
            </div>
          )}
          <button className="ml-auto text-xs text-neutral-500 hover:underline" onClick={() => setPicked(new Set())}>
            Clear selection
          </button>
        </GlassCard>
      )}

      {!apps.length ? (
        <EmptyState icon={<FileText size={22} />} title="No applications yet" description="Applications appear here as students submit them. You will see where each one stands in the process." />
      ) : !shown.length ? (
        <EmptyState icon={<Search size={22} />} title="Nobody matches" description="Try another status or search." />
      ) : (
        <GlassCard className="overflow-x-auto p-2">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="w-8 px-3 py-3">
                  {!ro && (
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={allShownPicked}
                      onChange={(e) => setPicked(e.target.checked ? new Set([...picked, ...shown.map((a) => a.id)]) : new Set([...picked].filter((id) => !shown.some((a) => a.id === id))))}
                      aria-label="Select everyone shown"
                    />
                  )}
                </th>
                <th className="px-3 py-3">Applicant</th>
                <th className="px-3 py-3">Applied</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Where they are</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {shown.map((a) => {
                const cur = a.careers_application_rounds.find((x) => x.round_id === a.current_round_id);
                return (
                  <tr key={a.id} className="hover:bg-white/30">
                    <td className="px-3 py-2.5">
                      {!ro && <input type="checkbox" className="h-4 w-4" checked={picked.has(a.id)} onChange={(e) => toggle(a.id, e.target.checked)} aria-label={`Select ${a.student?.full_name}`} />}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-neutral-900">{a.student?.full_name || a.student?.email}</div>
                      <div className="text-xs text-neutral-400">{a.student?.email}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-neutral-500">{new Date(a.created_at).toLocaleDateString('en-GB')}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={APP_STATUS_TONE[a.status]}>{APP_STATUS_LABEL[a.status]}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-neutral-600">
                      {a.current_round_id ? (
                        <div>
                          <div className="font-medium text-neutral-800">{roundName(a.current_round_id)}</div>
                          {cur && (
                            <div className="mt-0.5">
                              <Badge tone={ROUND_STATUS_TONE[cur.status]}>{ROUND_STATUS_LABEL[cur.status]}</Badge>
                              {cur.scheduled_at && cur.status === 'scheduled' && <span className="ml-1.5 text-neutral-500">{fmtDateTime(cur.scheduled_at)}</span>}
                              {cur.score !== null && <span className="ml-1.5 text-neutral-500">score {cur.score}</span>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-400">Not in a round yet</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button variant="secondary" onClick={() => setOpenId(a.id)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </GlassCard>
      )}

      {open && (
        <ApplicationDetail
          key={open.id}
          app={open}
          job={job}
          rounds={rounds}
          ro={ro}
          onClose={() => setOpenId(null)}
          onChanged={() => q.refetch()}
        />
      )}
    </div>
  );
}

/* ───────────────────────────── one applicant ───────────────────────────── */

export function ApplicationDetail({ app, job, rounds, ro, onClose, onChanged }: { app: AppRow; job: JobLite; rounds: RoundRow[]; ro: boolean; onClose: () => void; onChanged: () => void }) {
  const nav = useNavigate();
  const toast = useToast();
  const fields = parseFields(job.form_fields);
  const [notes, setNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [offer, setOffer] = useState(app.offer_note);
  const [busy, setBusy] = useState<string | null>(null);
  const brand = useOrgBrand();
  const [email, setEmail] = useState<{ round?: RoundRow; when?: string; who?: string; link?: string } | null>(null);

  useEffect(() => {
    supabase
      .from('careers_application_notes')
      .select('notes')
      .eq('application_id', app.id)
      .maybeSingle()
      .then(({ data }) => {
        setNotes(data?.notes ?? '');
        setNotesLoaded(true);
      });
  }, [app.id]);

  const closed = app.status === 'rejected' || app.status === 'withdrawn' || app.status === 'hired';

  const setStatus = async (status: AppStatus) => {
    if (status === 'rejected' && !confirm('Reject this applicant? They are told their application was not taken forward.')) return;
    if (status === 'hired' && !confirm('Mark as hired? They are told they are confirmed.')) return;
    setBusy('status');
    const patch: Record<string, unknown> = { status };
    if (status === 'offered' || status === 'hired') patch.offer_note = offer;
    const { error } = await supabase.from('careers_applications').update(patch as never).eq('id', app.id);
    setBusy(null);
    if (error) return toast(error.message, 'error');
    toast(`Marked ${APP_STATUS_LABEL[status].toLowerCase()}`);
    onChanged();
  };

  const saveNotes = async () => {
    setBusy('notes');
    const { error } = await supabase.from('careers_application_notes').upsert({ application_id: app.id, notes }, { onConflict: 'application_id' });
    setBusy(null);
    if (error) return toast(error.message, 'error');
    toast('Notes saved');
  };

  const openResume = async () => {
    if (!app.resume_path) return;
    const { data, error } = await supabase.storage.from('careers').createSignedUrl(app.resume_path, 120);
    if (error || !data) return toast('Could not open the resume', 'error');
    window.open(data.signedUrl, '_blank');
  };

  const startRound = async (roundId: string, when: string) => {
    setBusy(roundId);
    const { data, error } = await supabase.rpc('careers_start_round', { p_application_id: app.id, p_round_id: roundId, p_scheduled_at: when ? new Date(when).toISOString() : (undefined as unknown as string) });
    setBusy(null);
    if (error) return toast(error.message, 'error');
    const warning = (data as { warning?: string | null } | null)?.warning;
    toast(warning ?? 'Moved into the round. The candidate is notified');
    onChanged();
  };

  const emailStart: EmailTemplateKey = email?.round ? 'interview' : app.status === 'shortlisted' ? 'shortlisted' : app.status === 'rejected' ? 'not_selected' : app.status === 'offered' ? 'offer' : 'custom';

  return (
    <>
    <Modal open onClose={onClose} title={app.student?.full_name || 'Applicant'} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-neutral-600">
            <div>{app.student?.email}</div>
            {app.student?.phone && <div>{app.student.phone}</div>}
            <div className="text-xs text-neutral-400">Applied {fmtDateTime(app.created_at)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={APP_STATUS_TONE[app.status]}>{APP_STATUS_LABEL[app.status]}</Badge>
            {app.resume_path && (
              <Button variant="secondary" onClick={openResume}>
                <ExternalLink size={14} /> Resume
              </Button>
            )}
            {!ro && app.student?.email && (
              <Button variant="secondary" onClick={() => setEmail({})}>
                <Mail size={14} /> Email
              </Button>
            )}
            {!ro && (app.status === 'offered' || app.status === 'hired' || app.status === 'interviewing' || app.status === 'shortlisted') && (
              <Button
                variant="secondary"
                onClick={() =>
                  nav(
                    `/admin/careers/offers?${new URLSearchParams({ application: app.id, name: app.student?.full_name ?? '', email: app.student?.email ?? '', role: job.title, kind: job.kind ?? '' })}`,
                  )
                }
              >
                <FileSignature size={14} /> Offer letter
              </Button>
            )}
          </div>
        </div>

        {!ro && !closed && (
          <div className="flex flex-wrap gap-2">
            {(['in_review', 'shortlisted', 'offered', 'hired', 'rejected'] as AppStatus[])
              .filter((s) => s !== app.status)
              .map((s) => (
                <Button key={s} variant={s === 'rejected' ? 'secondary' : s === 'hired' || s === 'offered' ? 'primary' : 'secondary'} className={s === 'rejected' ? 'text-red-600' : ''} onClick={() => setStatus(s)} loading={busy === 'status'}>
                  {s === 'in_review' ? 'Mark in review' : s === 'shortlisted' ? 'Shortlist' : s === 'offered' ? 'Make an offer' : s === 'hired' ? 'Mark hired' : 'Reject'}
                </Button>
              ))}
          </div>
        )}

        {(app.status === 'offered' || app.status === 'hired' || (!ro && !closed)) && (
          <Field label="Offer note" hint="Shown to the candidate when you make an offer or confirm them: joining date, stipend, next steps">
            <TextArea rows={2} disabled={ro || closed} value={offer} onChange={(e) => setOffer(e.target.value)} />
          </Field>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Application</h3>
          {fields.length === 0 && !app.resume_path ? (
            <p className="text-sm text-neutral-500">No extra questions were asked.</p>
          ) : (
            <dl className="space-y-2">
              {fields.map((f) => (
                <div key={f.id} className="rounded-xl bg-white/50 px-3 py-2">
                  <dt className="text-xs text-neutral-500">{f.label}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-900">{String(app.answers?.[f.id] ?? '') || <span className="text-neutral-300">No answer</span>}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Interview process</h3>
          {!rounds.length ? (
            <p className="text-sm text-neutral-500">No rounds are set up for this position. Add them on the Interview process tab.</p>
          ) : (
            <ol className="space-y-3">
              {rounds.map((r, i) => (
                <RoundCard
                  key={r.id}
                  index={i}
                  round={r}
                  ar={app.careers_application_rounds.find((x) => x.round_id === r.id)}
                  ro={ro}
                  closed={closed}
                  starting={busy === r.id}
                  onStart={(when) => startRound(r.id, when)}
                  onChanged={onChanged}
                  onEmail={(v) => setEmail({ round: r, ...v })}
                />
              ))}
            </ol>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Private HR notes</h3>
          <TextArea rows={3} disabled={ro || !notesLoaded} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Only people with access to Careers can see these. The candidate never does." />
          {!ro && (
            <div className="mt-2 flex justify-end">
              <Button variant="secondary" onClick={saveNotes} loading={busy === 'notes'}>
                Save notes
              </Button>
            </div>
          )}
        </section>
      </div>
    </Modal>
    {email && app.student?.email && (
      <CareerEmailModal
        key={email.round?.id ?? 'general'}
        applicationId={app.id}
        toName={app.student.full_name || 'the candidate'}
        toEmail={app.student.email}
        initial={emailStart}
        context={{
          orgName: brand.data?.orgName ?? 'EgireRobotics',
          candidate: app.student.full_name || '',
          jobTitle: job.title,
          jd: job.jd ?? '',
          round: email.round ? { name: email.round.name, kind: email.round.kind } : null,
          when: email.when ? new Date(email.when).toISOString() : null,
          interviewer: email.who,
          link: email.link,
        }}
        onClose={() => setEmail(null)}
        onSent={onChanged}
      />
    )}
    </>
  );
}

function RoundCard({
  index,
  round,
  ar,
  ro,
  closed,
  starting,
  onStart,
  onChanged,
  onEmail,
}: {
  index: number;
  round: RoundRow;
  ar: AppRound | undefined;
  ro: boolean;
  closed: boolean;
  starting: boolean;
  onStart: (when: string) => void;
  onChanged: () => void;
  onEmail: (v: { when: string; who: string; link: string }) => void;
}) {
  const toast = useToast();
  const [when, setWhen] = useState(toLocalInput(ar?.scheduled_at ?? null));
  const [who, setWho] = useState(ar?.interviewer ?? '');
  const [link, setLink] = useState(ar?.meet_link ?? '');
  const [score, setScore] = useState(ar?.score ?? null);
  const [feedback, setFeedback] = useState(ar?.feedback ?? '');
  const [busy, setBusy] = useState(false);

  const save = async (status?: RoundStatus) => {
    if (!ar) return;
    if (link && !/^https?:\/\//i.test(link)) return toast('The meeting link must start with http:// or https://', 'error');
    setBusy(true);
    const patch: Record<string, unknown> = {
      scheduled_at: when ? new Date(when).toISOString() : null,
      interviewer: who.trim(),
      meet_link: link.trim(),
      score,
      feedback,
    };
    if (status) patch.status = status;
    else if (ar.status === 'pending' && when) patch.status = 'scheduled';
    const { error } = await supabase.from('careers_application_rounds').update(patch as never).eq('id', ar.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast(status ? `Marked ${ROUND_STATUS_LABEL[status].toLowerCase()}` : 'Saved');
    onChanged();
  };

  return (
    <li className="rounded-2xl border border-white/60 bg-white/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1a1a1a] text-[11px] font-semibold text-white">{index + 1}</span>
          <span className="font-medium text-neutral-900">{round.name}</span>
          {round.kind === 'online_test' && round.exam_course_id && <Badge tone="blue">Online test</Badge>}
        </div>
        {ar ? <Badge tone={ROUND_STATUS_TONE[ar.status]}>{ROUND_STATUS_LABEL[ar.status]}</Badge> : <span className="text-xs text-neutral-400">Not started</span>}
      </div>

      {!ar ? (
        !ro &&
        !closed && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            {round.kind !== 'online_test' && (
              <div className="w-56">
                <Field label="Schedule (optional)">
                  <TextInput type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                </Field>
              </div>
            )}
            <Button onClick={() => onStart(when)} loading={starting}>
              Move into this round
            </Button>
            {round.kind === 'online_test' && round.exam_course_id && <span className="text-xs text-neutral-500">The candidate is enrolled in the test and notified.</span>}
          </div>
        )
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {round.kind !== 'online_test' && (
              <Field label="When">
                <TextInput type="datetime-local" disabled={ro} value={when} onChange={(e) => setWhen(e.target.value)} />
              </Field>
            )}
            <Field label="Interviewer / panel">
              <TextInput disabled={ro} value={who} onChange={(e) => setWho(e.target.value)} placeholder="e.g. Ravi (flight lead)" />
            </Field>
            {round.kind !== 'online_test' && (
              <Field label="Meeting link or place">
                <TextInput disabled={ro} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" />
              </Field>
            )}
            <Field label={round.kind === 'online_test' ? `Score (%)${round.pass_score !== null ? ` · pass ${round.pass_score}` : ''}` : 'Score (optional)'}>
              <TextInput type="number" disabled={ro} value={score ?? ''} onChange={(e) => setScore(e.target.value === '' ? null : Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Feedback (private)">
            <TextArea rows={2} disabled={ro} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Strengths, concerns, recommendation. The candidate never sees this." />
          </Field>
          {!ro && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => save()} loading={busy}>
                Save
              </Button>
              {round.kind !== 'online_test' && (
                <Button variant="secondary" onClick={() => onEmail({ when, who, link })}>
                  <Mail size={14} /> Email schedule
                </Button>
              )}
              <span className="mx-1 text-xs text-neutral-400">Result:</span>
              <Button variant="secondary" onClick={() => save('passed')} disabled={busy}>
                Passed
              </Button>
              <Button variant="secondary" className="text-red-600" onClick={() => save('failed')} disabled={busy}>
                Not cleared
              </Button>
              <Button variant="ghost" onClick={() => save('no_show')} disabled={busy}>
                Did not attend
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
