import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ImageIcon, Layers, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { slugify } from '../../lib/slug';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';
import type { Tables } from '../../lib/database.types';

type Course = Tables<'courses'>;
type Org = Tables<'org_settings'>;

export function AdminCourses() {
  const { profile } = useAuth();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('courses');
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [uploadingCover, setUploadingCover] = useState<string | null>(null);

  const q = useQuery(async () => {
    const [courses, org] = await Promise.all([
      unwrap(supabase.from('courses').select('*').order('created_at', { ascending: false })) as Promise<Course[]>,
      unwrap(supabase.from('org_settings').select('*').single()) as Promise<Org>,
    ]);
    return { courses, org };
  }, []);

  const toggleStatus = async (c: Course) => {
    const next = c.status === 'published' ? 'draft' : 'published';
    const { error } = await supabase.from('courses').update({ status: next }).eq('id', c.id);
    if (error) return toast(error.message, 'error');
    toast(`"${c.title}" ${next === 'published' ? 'published' : 'unpublished'}`);
    q.refetch();
  };

  const updateCertType = async (c: Course, cert_type: string) => {
    if (!cert_type.trim() || cert_type === c.cert_type) return;
    const { error } = await supabase.from('courses').update({ cert_type: cert_type.trim() }).eq('id', c.id);
    if (error) return toast(error.message, 'error');
    q.refetch();
  };

  const uploadCover = async (c: Course, file: File) => {
    setUploadingCover(c.id);
    const path = `${c.id}-${Date.now()}-${file.name}`;
    const up = await supabase.storage.from('course-covers').upload(path, file, { upsert: true });
    if (up.error) {
      setUploadingCover(null);
      return toast(up.error.message, 'error');
    }
    const { data } = supabase.storage.from('course-covers').getPublicUrl(path);
    const { error } = await supabase.from('courses').update({ cover_image_url: data.publicUrl }).eq('id', c.id);
    setUploadingCover(null);
    if (error) return toast(error.message, 'error');
    toast('Cover image updated');
    q.refetch();
  };

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle="Build course content and exams"
        actions={
          writable && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> New course
            </Button>
          )
        }
      />

      {q.loading ? (
        <Spinner />
      ) : !q.data?.courses.length ? (
        <EmptyState
          icon={<Layers size={22} />}
          title="No courses yet"
          description="Create your first FPV course."
          action={writable && <Button onClick={() => setCreating(true)}>New course</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.courses.map((c) => (
            <GlassCard key={c.id} className="p-5">
              <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100">
                {c.cover_image_url ? (
                  <img src={c.cover_image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="text-blue-400" size={28} />
                )}
              </div>
              {writable && (
                <label className="mb-3 -mt-1 inline-block cursor-pointer text-xs font-medium text-blue-600 hover:underline">
                  {uploadingCover === c.id ? 'Uploading…' : c.cover_image_url ? 'Change cover image' : 'Upload cover image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadCover(c, e.target.files[0])}
                  />
                </label>
              )}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-neutral-900">{c.title}</div>
                  <div className="mt-0.5 text-xs text-neutral-400">
                    <span className="font-mono">{c.course_code}</span> · /{c.slug}
                  </div>
                </div>
                <Badge tone={c.status === 'published' ? 'green' : c.status === 'archived' ? 'neutral' : 'amber'}>{c.status}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{c.summary}</p>
              <div className="mt-3 text-xs text-neutral-400">
                Exam: {c.exam_question_count} Q · {c.exam_time_limit_min} min · pass {c.pass_pct}% · {c.max_attempts} attempts
              </div>
              {writable ? (
                <Field label="Certificate type" hint="Printed as “OF ___” on the certificate">
                  <TextInput defaultValue={c.cert_type} key={c.cert_type} onBlur={(e) => updateCertType(c, e.target.value)} />
                </Field>
              ) : (
                <div className="mt-2 text-xs text-neutral-400">Certificate: OF {c.cert_type.toUpperCase()}</div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/admin/courses/${c.id}/build`}>
                  <Button variant="secondary">
                    <Layers size={14} /> Content
                  </Button>
                </Link>
                <Link to={`/admin/question-bank/${c.id}`}>
                  <Button variant="secondary">
                    <FileQuestion size={14} /> Question bank
                  </Button>
                </Link>
                {writable && (
                  <Button variant="ghost" onClick={() => toggleStatus(c)}>
                    {c.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {q.data && writable && (
        <CreateCourseModal
          open={creating}
          onClose={() => setCreating(false)}
          org={q.data.org}
          createdBy={profile!.id}
          onCreated={() => {
            setCreating(false);
            q.refetch();
          }}
        />
      )}
    </div>
  );
}

function CreateCourseModal({
  open,
  onClose,
  org,
  createdBy,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  org: Org;
  createdBy: string;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    course_code: '',
    summary: '',
    description: '',
    pass_pct: org.default_pass_pct,
    exam_time_limit_min: org.default_time_limit_min,
    exam_question_count: org.default_question_count,
    max_attempts: org.default_max_attempts,
    cooldown_hours: org.default_cooldown_hours,
    status: 'draft' as Course['status'],
    cert_type: 'Participation',
  });

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('courses').insert({
      ...form,
      slug: slugify(form.title),
      course_code: form.course_code.toUpperCase().replace(/[^A-Z0-9]/g, ''),
      created_by: createdBy,
    });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Course created');
    onCreated();
  };

  return (
    <Modal open={open} onClose={onClose} title="New course" wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Title" required>
            <TextInput required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="FPV Drone Fundamentals" />
          </Field>
        </div>
        <Field label="Course code" hint="Used in certificate IDs, e.g. FPV" required>
          <TextInput required value={form.course_code} onChange={(e) => set('course_code', e.target.value)} placeholder="FPV" className="font-mono uppercase" />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="draft">draft</option>
            <option value="published">published</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Summary">
            <TextInput value={form.summary} onChange={(e) => set('summary', e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description">
            <TextArea value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
        <Field label="Pass %">
          <TextInput type="number" value={form.pass_pct} onChange={(e) => set('pass_pct', Number(e.target.value))} />
        </Field>
        <Field label="Time limit (min)">
          <TextInput type="number" value={form.exam_time_limit_min} onChange={(e) => set('exam_time_limit_min', Number(e.target.value))} />
        </Field>
        <Field label="Questions per exam">
          <TextInput type="number" value={form.exam_question_count} onChange={(e) => set('exam_question_count', Number(e.target.value))} />
        </Field>
        <Field label="Max attempts">
          <TextInput type="number" value={form.max_attempts} onChange={(e) => set('max_attempts', Number(e.target.value))} />
        </Field>
        <Field label="Cooldown (hours)">
          <TextInput type="number" value={form.cooldown_hours} onChange={(e) => set('cooldown_hours', Number(e.target.value))} />
        </Field>
        <Field label="Certificate type" hint="Printed as “OF ___”, e.g. Participation, L1 Pilot, Coordinator">
          <TextInput value={form.cert_type} onChange={(e) => set('cert_type', e.target.value)} />
        </Field>
        <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create course
          </Button>
        </div>
      </form>
    </Modal>
  );
}
