import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ExternalLink, FileUp, MapPin, Users, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';
import { JobText } from '../../components/JobText';
import { CountdownTiles, useNow } from '../../components/ExamCountdown';
import { WindowLine, type MyRound, type StudentJob } from './Careers';
import {
  APP_STATUS_LABEL,
  APP_STATUS_TONE,
  KIND_LABEL,
  MODE_LABEL,
  ROUND_KIND_LABEL,
  ROUND_STATUS_LABEL,
  ROUND_STATUS_TONE,
  fmtDateTime,
  parseFields,
  windowState,
  type AppStatus,
  type FormField,
  type RoundKind,
} from '../../lib/careers';

interface FullJob extends StudentJob {
  jd: string;
  terms: string;
  form_fields: unknown;
  ask_resume: boolean;
}
interface ProcessRound {
  id: string;
  position: number;
  name: string;
  kind: RoundKind;
  description: string;
}
interface MyApplication {
  id: string;
  status: AppStatus;
  current_round_id: string | null;
  offer_note: string;
  created_at: string;
  resume_path: string | null;
}

const RESUME_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

/** One position for a student: the job description, terms, the apply window, the form, and — once applied — progress through the process. */
export function CareerJob() {
  const { slug } = useParams();
  const { profile } = useAuth();
  const toast = useToast();
  const uid = profile?.id ?? '';
  const now = useNow();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  const q = useQuery(async () => {
    const job = (await unwrap(supabase.from('careers_jobs').select('*').eq('slug', slug as string).maybeSingle())) as FullJob | null;
    if (!job) return { job: null, process: [], app: null, rounds: [] };
    const [process, app, rounds] = await Promise.all([
      unwrap(supabase.from('careers_rounds').select('id, position, name, kind, description').eq('job_id', job.id).order('position')) as Promise<ProcessRound[]>,
      unwrap(
        supabase.from('careers_applications').select('id, status, current_round_id, offer_note, created_at, resume_path').eq('job_id', job.id).eq('student_id', uid).maybeSingle(),
      ) as Promise<MyApplication | null>,
      supabase.rpc('careers_my_rounds').then((r) => (r.data ?? []) as unknown as MyRound[]),
    ]);
    return { job, process, app, rounds };
  }, [slug, uid]);

  if (q.loading && !q.data) return <Spinner />;
  const { job, process, app, rounds } = q.data ?? { job: null, process: [], app: null, rounds: [] };
  if (!job)
    return (
      <EmptyState
        icon={<Users size={22} />}
        title="This position isn't available"
        description="It may have closed or been removed."
        action={
          <Link to="/app/careers" className="text-sm font-medium text-blue-600 hover:underline">
            Back to Careers
          </Link>
        }
      />
    );

  const state = windowState(job, now);
  const fields = parseFields(job.form_fields);
  const myRounds = rounds.filter((r) => r.application_id === app?.id);
  const start = job.apply_starts_at ? new Date(job.apply_starts_at).getTime() : null;
  const end = job.apply_ends_at ? new Date(job.apply_ends_at).getTime() : null;

  const submit = async () => {
    for (const f of fields) {
      if (f.required && !(answers[f.id] ?? '').toString().trim()) return toast(`Please answer: ${f.label}`, 'error');
    }
    if (job.ask_resume && !file) return toast('Please upload your resume', 'error');
    if (!profile?.phone && !phone.trim()) return toast('Please add a phone number so we can reach you', 'error');
    if (!accepted) return toast('Please accept the terms and conditions', 'error');
    if (file) {
      if (!RESUME_TYPES.includes(file.type)) return toast('The resume must be a PDF or Word file', 'error');
      if (file.size > 5 * 1024 * 1024) return toast('The resume must be 5 MB or smaller', 'error');
    }
    setBusy(true);
    try {
      let resume_path: string | null = null;
      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
        resume_path = `${uid}/${job.id}-${Date.now()}.${ext}`;
        const up = await supabase.storage.from('careers').upload(resume_path, file, { contentType: file.type });
        if (up.error) throw up.error;
      }
      if (!profile?.phone && phone.trim()) await supabase.from('profiles').update({ phone: phone.trim() }).eq('id', uid);
      const { error } = await supabase.from('careers_applications').insert({
        job_id: job.id,
        student_id: uid,
        answers,
        resume_path,
        accepted_terms_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast('Application submitted. Good luck!');
      q.refetch();
    } catch (e) {
      const msg = (e as Error).message ?? 'Could not submit';
      toast(/row-level security|violates/i.test(msg) ? 'Applications for this position are not open right now, or you have already applied.' : msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!app || !confirm('Withdraw your application? You will not be able to apply again for this position.')) return;
    const { error } = await supabase.from('careers_applications').update({ status: 'withdrawn' }).eq('id', app.id);
    if (error) return toast(error.message, 'error');
    toast('Application withdrawn');
    q.refetch();
  };

  const openResume = async () => {
    if (!app?.resume_path) return;
    const { data } = await supabase.storage.from('careers').createSignedUrl(app.resume_path, 120);
    if (data) window.open(data.signedUrl, '_blank');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/app/careers" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
        <ArrowLeft size={14} /> All positions
      </Link>

      <PageHeader title={job.title} subtitle={`${KIND_LABEL[job.kind]} · ${MODE_LABEL[job.work_mode]}${job.department ? ` · ${job.department}` : ''}`} actions={<Badge tone="blue">{KIND_LABEL[job.kind]}</Badge>} />

      <GlassCard className="p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-600">
          {job.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} className="text-neutral-400" /> {job.location}
            </span>
          )}
          {job.pay && (
            <span className="inline-flex items-center gap-1.5">
              <Wallet size={14} className="text-neutral-400" /> {job.pay}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} className="text-neutral-400" /> {job.openings} opening{job.openings === 1 ? '' : 's'}
          </span>
        </div>
        <div className="mt-4 rounded-2xl bg-white/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-neutral-600">
              <div>
                <span className="text-neutral-400">Opens </span>
                <span className="font-medium text-neutral-900">{job.apply_starts_at ? fmtDateTime(job.apply_starts_at) : 'now'}</span>
              </div>
              <div>
                <span className="text-neutral-400">Closes </span>
                <span className="font-medium text-neutral-900">{job.apply_ends_at ? fmtDateTime(job.apply_ends_at) : 'when we fill the role'}</span>
              </div>
            </div>
            {state === 'upcoming' && start !== null && <CountdownTiles ms={start - now} tone="text-amber-600" />}
            {state === 'live' && end !== null && <CountdownTiles ms={end - now} tone="text-green-700" />}
          </div>
          <div className="mt-2">
            <WindowLine job={job} />
          </div>
        </div>
      </GlassCard>

      {job.jd && (
        <GlassCard className="p-5">
          <h2 className="mb-3 font-semibold text-neutral-900">About the role</h2>
          <JobText text={job.jd} />
        </GlassCard>
      )}

      {process.length > 0 && (
        <GlassCard className="p-5">
          <h2 className="mb-3 font-semibold text-neutral-900">How we hire</h2>
          <ol className="space-y-2.5">
            {process.map((r, i) => {
              const mine = myRounds.find((m) => m.round_id === r.id);
              return (
                <li key={r.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-[11px] font-semibold text-white">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900">{r.name}</span>
                      <span className="text-xs text-neutral-400">{ROUND_KIND_LABEL[r.kind]}</span>
                      {mine && <Badge tone={ROUND_STATUS_TONE[mine.status]}>{ROUND_STATUS_LABEL[mine.status]}</Badge>}
                    </div>
                    {r.description && <div className="text-xs text-neutral-500">{r.description}</div>}
                    {mine?.scheduled_at && mine.status === 'scheduled' && (
                      <div className="mt-1 text-xs font-medium text-blue-700">
                        {fmtDateTime(mine.scheduled_at)}
                        {mine.interviewer ? ` · with ${mine.interviewer}` : ''}
                      </div>
                    )}
                    {mine?.meet_link && mine.status === 'scheduled' && (
                      <a
                        href={/^https?:\/\//i.test(mine.meet_link) ? mine.meet_link : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      >
                        <ExternalLink size={12} /> {/^https?:\/\//i.test(mine.meet_link) ? 'Join link' : mine.meet_link}
                      </a>
                    )}
                    {mine?.exam_slug && (mine.status === 'scheduled' || mine.status === 'pending') && (
                      <Link to={`/app/courses/${mine.exam_slug}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                        Open your online test
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </GlassCard>
      )}

      {/* applied: where things stand */}
      {app ? (
        <GlassCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-neutral-900">Your application</h2>
              <p className="text-xs text-neutral-500">Submitted {fmtDateTime(app.created_at)}</p>
            </div>
            <Badge tone={APP_STATUS_TONE[app.status]}>{APP_STATUS_LABEL[app.status]}</Badge>
          </div>
          {(app.status === 'offered' || app.status === 'hired') && app.offer_note && (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">{app.offer_note}</div>
          )}
          <p className="mt-3 text-sm text-neutral-600">
            {app.status === 'applied' && 'We have your application. You will be notified here as it moves forward.'}
            {app.status === 'in_review' && 'Your application is being reviewed.'}
            {app.status === 'shortlisted' && 'You have been shortlisted. The next step will be scheduled soon.'}
            {app.status === 'interviewing' && 'You are in the interview process. Check the steps above for your schedule.'}
            {app.status === 'offered' && 'Congratulations, we have made you an offer.'}
            {app.status === 'hired' && 'You are confirmed. Welcome aboard!'}
            {app.status === 'rejected' && 'Thank you for applying. We are not taking your application forward this time.'}
            {app.status === 'withdrawn' && 'You withdrew this application.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {app.resume_path && (
              <Button variant="secondary" onClick={openResume}>
                <FileUp size={14} /> My resume
              </Button>
            )}
            {['applied', 'in_review', 'shortlisted', 'interviewing'].includes(app.status) && (
              <Button variant="ghost" className="text-red-600" onClick={withdraw}>
                Withdraw application
              </Button>
            )}
          </div>
        </GlassCard>
      ) : state === 'live' ? (
        <GlassCard className="p-5">
          <h2 className="font-semibold text-neutral-900">Apply</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <TextInput value={profile?.full_name ?? ''} disabled />
            </Field>
            <Field label="Email">
              <TextInput value={profile?.email ?? ''} disabled />
            </Field>
            <Field label="Phone" hint={profile?.phone ? undefined : 'We use this to reach you about interviews'}>
              <TextInput value={profile?.phone ?? phone} disabled={!!profile?.phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
            </Field>
          </div>

          <div className="mt-4 space-y-4">
            {fields.map((f) => (
              <QuestionInput key={f.id} f={f} value={answers[f.id] ?? ''} onChange={(v) => setAnswers((p) => ({ ...p, [f.id]: v }))} />
            ))}
            {job.ask_resume && (
              <Field label="Resume" hint="PDF or Word, up to 5 MB" required>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-neutral-50"
                />
              </Field>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-white/60 bg-white/50 p-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-neutral-800">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              <span>
                I have read and accept the{' '}
                <button type="button" className="font-medium text-blue-600 underline" onClick={() => setShowTerms((v) => !v)}>
                  terms and conditions
                </button>{' '}
                for this position.
              </span>
            </label>
            {showTerms && <div className="mt-3 max-h-64 overflow-y-auto rounded-xl bg-white/70 p-3">{job.terms ? <JobText text={job.terms} /> : <p className="text-sm text-neutral-500">No special terms.</p>}</div>}
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={submit} loading={busy}>
              <CheckCircle2 size={16} /> Submit application
            </Button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="p-5 text-center text-sm text-neutral-600">
          {state === 'upcoming' ? `Applications open ${fmtDateTime(job.apply_starts_at)}. Come back then to apply.` : 'Applications for this position are closed.'}
        </GlassCard>
      )}
    </div>
  );
}

function QuestionInput({ f, value, onChange }: { f: FormField; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={f.label} required={f.required}>
      {f.type === 'textarea' ? (
        <TextArea rows={4} value={value} onChange={(e) => onChange(e.target.value)} maxLength={4000} />
      ) : f.type === 'select' ? (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      ) : f.type === 'yesno' ? (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </Select>
      ) : (
        <TextInput type={f.type === 'number' ? 'number' : f.type === 'url' ? 'url' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} maxLength={500} placeholder={f.type === 'url' ? 'https://…' : undefined} />
      )}
    </Field>
  );
}
