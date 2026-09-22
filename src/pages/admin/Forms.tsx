import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Copy, CreditCard, FormInput, Globe, ListChecks, Plus, Settings2 } from 'lucide-react';
import { supabase, APP_URL } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { slugify } from '../../lib/slug';
import { toLocalInput, fromLocalInput } from '../../lib/localDateTime';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, Checkbox, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';

export function Forms() {
  const { profile } = useAuth();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('forms');
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [validityFor, setValidityFor] = useState<any | null>(null);

  const q = useQuery(async () => {
    const [forms, courses] = await Promise.all([
      unwrap(
        supabase
          .from('enrollment_forms')
          .select(
            'id, title, slug, is_open, is_public, id_card_valid_from, id_card_valid_until, ' +
              'course:courses(title), enrollment_form_fields(id), enrollment_requests(id)',
          )
          .order('created_at', { ascending: false }),
      ) as Promise<any[]>,
      unwrap(supabase.from('courses').select('id, title').order('title')) as Promise<any[]>,
    ]);
    return { forms, courses };
  }, []);

  const toggleOpen = async (f: any) => {
    const { error } = await supabase.from('enrollment_forms').update({ is_open: !f.is_open }).eq('id', f.id);
    if (error) return toast(error.message, 'error');
    q.refetch();
  };

  const togglePublic = async (f: any) => {
    const { error } = await supabase.from('enrollment_forms').update({ is_public: !f.is_public }).eq('id', f.id);
    if (error) return toast(error.message, 'error');
    q.refetch();
  };

  const pathFor = (f: any) => (f.is_public ? `/register-form/${f.slug}` : `/enroll/${f.slug}`);
  const copyUrl = (f: any) => {
    navigator.clipboard.writeText(`${APP_URL}${pathFor(f)}`);
    toast('Link copied');
  };

  return (
    <div>
      <PageHeader
        title="Enrollment forms"
        subtitle="Build a registration form per course/batch and share its link"
        actions={
          writable && (
            <Button onClick={() => setCreating(true)} disabled={!q.data?.courses.length}>
              <Plus size={16} /> New form
            </Button>
          )
        }
      />

      {q.loading ? (
        <Spinner />
      ) : !q.data?.forms.length ? (
        <EmptyState
          icon={<FormInput size={22} />}
          title="No enrollment forms"
          description={q.data?.courses.length ? 'Create a form and share its URL with a cohort.' : 'Create a course first.'}
          action={writable && q.data?.courses.length ? <Button onClick={() => setCreating(true)}>New form</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.forms.map((f) => (
            <GlassCard key={f.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-neutral-900">{f.title}</div>
                  <div className="text-xs text-neutral-400">{f.course?.title}</div>
                </div>
                <div className="flex gap-1.5">
                  {f.is_public && <Badge tone="blue">public</Badge>}
                  <Badge tone={f.is_open ? 'green' : 'neutral'}>{f.is_open ? 'open' : 'closed'}</Badge>
                  {(f.id_card_valid_from || f.id_card_valid_until) && <Badge tone="amber">ID card window set</Badge>}
                </div>
              </div>
              <div className="mt-2 text-xs text-neutral-400">
                {f.enrollment_form_fields?.length ?? 0} fields · {f.enrollment_requests?.length ?? 0} responses
                {f.is_public && ' · public sign-up → Registrations'}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="font-mono">{pathFor(f)}</span>
                <button onClick={() => copyUrl(f)} className="text-neutral-400 hover:text-blue-600">
                  <Copy size={13} />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/admin/forms/${f.id}/analytics`}>
                  <Button variant="secondary">
                    <BarChart3 size={14} /> Analytics
                  </Button>
                </Link>
                <Link to={`/admin/forms/${f.id}/edit`}>
                  <Button variant="secondary">
                    <Settings2 size={14} /> Build
                  </Button>
                </Link>
                {!f.is_public && (
                  <Link to={`/admin/forms/${f.id}/responses`}>
                    <Button variant="secondary">
                      <ListChecks size={14} /> Responses
                    </Button>
                  </Link>
                )}
                {writable && (
                  <>
                    <Button variant="ghost" onClick={() => toggleOpen(f)}>
                      {f.is_open ? 'Close' : 'Open'}
                    </Button>
                    <Button variant="ghost" onClick={() => togglePublic(f)}>
                      <Globe size={13} /> {f.is_public ? 'Make private' : 'Make public'}
                    </Button>
                    <Button variant="ghost" onClick={() => setValidityFor(f)}>
                      <CreditCard size={13} /> ID card validity
                    </Button>
                  </>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={creating && writable} onClose={() => setCreating(false)} title="New enrollment form">
        {q.data && (
          <CreateForm
            courses={q.data.courses}
            createdBy={profile!.id}
            onDone={() => {
              setCreating(false);
              q.refetch();
            }}
          />
        )}
      </Modal>

      {validityFor && (
        <IdCardValidityModal
          form={validityFor}
          onClose={() => setValidityFor(null)}
          onSaved={() => {
            setValidityFor(null);
            q.refetch();
          }}
        />
      )}
    </div>
  );
}

/** The start/expiry window that ID cards default to when generated for someone who
 * registered through this form — set once here instead of retyping it per card. An
 * explicit date on the card generation form (or a preset) still overrides this. */
function IdCardValidityModal({ form, onClose, onSaved }: { form: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [validFrom, setValidFrom] = useState(toLocalInput(form.id_card_valid_from));
  const [validUntil, setValidUntil] = useState(toLocalInput(form.id_card_valid_until));

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('enrollment_forms')
      .update({ id_card_valid_from: fromLocalInput(validFrom), id_card_valid_until: fromLocalInput(validUntil) })
      .eq('id', form.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('ID card validity saved');
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={`ID card validity — ${form.title}`}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">
          Any ID card generated for someone who registered through this form defaults to this window, instead of
          today → 1 year from now. Leave both blank to fall back to that default.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valid from">
            <TextInput type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </Field>
          <Field label="Valid until (expiry)">
            <TextInput type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
        </div>
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

function CreateForm({ courses, createdBy, onDone }: { courses: any[]; createdBy: string; onDone: () => void }) {
  const toast = useToast();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase
      .from('enrollment_forms')
      .insert({ course_id: courseId, title, description, slug, is_public: isPublic, is_open: true, created_by: createdBy });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Form created');
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Course" required>
        <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Form title" required>
        <TextInput required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="FPV Batch — Sept 2026 Registration" />
      </Field>
      <Field label="Description">
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="rounded-2xl border border-white/60 bg-white/40 p-3">
        <Checkbox
          label="Public registration form (no login) — submissions go to the Registrations queue"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        <p className="mt-1 pl-6 text-xs text-neutral-500">
          {isPublic
            ? 'Share /register-form/… — anyone can apply; you accept and pick their courses.'
            : 'Private: a logged-in student opens /enroll/… to request this specific course.'}
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={busy}>
          Create form
        </Button>
      </div>
    </form>
  );
}
