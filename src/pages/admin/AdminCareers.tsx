import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, CalendarClock, Plus, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { slugify } from '../../lib/slug';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';
import { CareersNav } from '../../components/CareersNav';
import { LEVEL_LABEL, buildJd, employmentFor, type Level, type RoleTemplate } from '../../lib/offers';
import { KIND_LABEL, MODE_LABEL, fmtDateTime, windowState, type JobKind, type WorkMode } from '../../lib/careers';

interface JobRow {
  id: string;
  title: string;
  slug: string;
  kind: JobKind;
  work_mode: WorkMode;
  department: string;
  location: string;
  status: string;
  apply_starts_at: string | null;
  apply_ends_at: string | null;
  careers_applications: { count: number }[];
}

const STATE_BADGE = {
  draft: { tone: 'neutral', label: 'Draft' },
  upcoming: { tone: 'blue', label: 'Opens soon' },
  live: { tone: 'green', label: 'Accepting applications' },
  closed: { tone: 'red', label: 'Closed' },
} as const;

/** Careers (HR): every opening, its apply window and how many people applied. */
export function AdminCareers() {
  const nav = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('careers');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<JobKind>('internship');
  const [tplId, setTplId] = useState('');
  const [level, setLevel] = useState<Level>('intern');
  const [busy, setBusy] = useState(false);

  const templates = useQuery(() => unwrap(supabase.from('careers_role_templates').select('*').eq('is_active', true).order('sort_order')) as Promise<RoleTemplate[]>, []);

  const q = useQuery(
    () =>
      unwrap(
        supabase.from('careers_jobs').select('id, title, slug, kind, work_mode, department, location, status, apply_starts_at, apply_ends_at, careers_applications(count)').order('created_at', { ascending: false }),
      ) as unknown as Promise<JobRow[]>,
    [],
  );

  const create = async () => {
    if (title.trim().length < 3) return toast('Give the position a title', 'error');
    const tpl = templates.data?.find((t) => t.id === tplId);
    setBusy(true);
    const slug = `${slugify(title).slice(0, 60) || 'position'}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from('careers_jobs')
      .insert({
        title: title.trim(),
        slug,
        kind,
        created_by: profile?.id,
        ...(tpl ? { department: tpl.department, summary: tpl.summary, jd: buildJd(tpl, level) } : {}),
      })
      .select('id')
      .single();
    setBusy(false);
    if (error) return toast(error.message, 'error');
    nav(`/admin/careers/${data.id}`);
  };

  if (q.loading && !q.data) return <Spinner />;
  const jobs = q.data ?? [];

  return (
    <div>
      <PageHeader
        title="Careers"
        subtitle="Open internships and jobs, take applications, and run the hiring process end to end"
        actions={
          writable && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> New position
            </Button>
          )
        }
      />
      <CareersNav />

      {!jobs.length ? (
        <EmptyState
          icon={<Briefcase size={22} />}
          title="No positions yet"
          description="Create a position, write its job description and terms, build the application form, set the apply window and the interview rounds, then publish it. Students see it on their dashboard."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((j) => {
            const state = windowState(j);
            const badge = STATE_BADGE[state];
            const applicants = j.careers_applications?.[0]?.count ?? 0;
            return (
              <button key={j.id} onClick={() => nav(`/admin/careers/${j.id}`)} className="text-left">
                <GlassCard className="h-full p-5 transition-transform hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-neutral-900">{j.title}</div>
                      <div className="mt-0.5 text-xs text-neutral-500">
                        {KIND_LABEL[j.kind]} · {MODE_LABEL[j.work_mode]}
                        {j.department ? ` · ${j.department}` : ''}
                        {j.location ? ` · ${j.location}` : ''}
                      </div>
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-neutral-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={14} className="text-neutral-400" />
                      <span className="font-semibold text-neutral-900">{applicants}</span> applicant{applicants === 1 ? '' : 's'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                      <CalendarClock size={14} className="text-neutral-400" />
                      {j.apply_starts_at || j.apply_ends_at ? `${fmtDateTime(j.apply_starts_at)} → ${fmtDateTime(j.apply_ends_at)}` : 'No apply dates set'}
                    </span>
                  </div>
                </GlassCard>
              </button>
            );
          })}
        </div>
      )}

      {creating && writable && (
        <Modal open onClose={() => setCreating(false)} title="New position">
          <div className="space-y-4">
            <Field label="Start from a role template" hint="Fills in the department, summary and job description. You can edit all of it afterwards">
              <Select
                value={tplId}
                onChange={(e) => {
                  const t = templates.data?.find((x) => x.id === e.target.value);
                  setTplId(e.target.value);
                  if (t) {
                    setTitle(`${t.title}${level === 'intern' ? ' Intern' : ''}`);
                    setKind(employmentFor(level) === 'internship' ? 'internship' : 'full_time');
                  }
                }}
              >
                <option value="">Blank position</option>
                {(templates.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </Field>
            {tplId && (
              <Field label="Level">
                <Select
                  value={level}
                  onChange={(e) => {
                    const l = e.target.value as Level;
                    const t = templates.data?.find((x) => x.id === tplId);
                    setLevel(l);
                    setKind(employmentFor(l) === 'internship' ? 'internship' : 'full_time');
                    if (t) setTitle(`${t.title}${l === 'intern' ? ' Intern' : ''}`);
                  }}
                >
                  {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABEL[l]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Position title">
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. FPV Drone Pilot Intern" autoFocus />
            </Field>
            <Field label="Type">
              <Select value={kind} onChange={(e) => setKind(e.target.value as JobKind)}>
                {(Object.keys(KIND_LABEL) as JobKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-neutral-500">It starts as a draft that students can't see. You write the details and publish it on the next screen.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button onClick={create} loading={busy}>
                Create and continue
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
