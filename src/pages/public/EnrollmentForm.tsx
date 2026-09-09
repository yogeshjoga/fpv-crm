import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { Button, Checkbox, Field, Select, Spinner, TextArea, TextInput } from '../../components/ui/kit';

interface FormField {
  id: string;
  label: string;
  field_type: string;
  options_json: string[];
  required: boolean;
  help_text: string;
  position: number;
}
interface FormRow {
  id: string;
  course_id: string;
  title: string;
  description: string;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  course: { title: string } | null;
  enrollment_form_fields: FormField[];
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/60 p-8 shadow-[0_8px_40px_rgb(0,0,0,0.06)] backdrop-blur-2xl">
        {children}
      </div>
    </div>
  );
}

export function EnrollmentForm() {
  const { slug } = useParams();
  const { profile } = useAuth();
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const q = useQuery(async () => {
    const form = (await unwrap(
      supabase
        .from('enrollment_forms')
        .select(
          'id, course_id, title, description, is_open, opens_at, closes_at, course:courses(title), ' +
            'enrollment_form_fields(id, label, field_type, options_json, required, help_text, position)',
        )
        .eq('slug', slug as string)
        .single(),
    )) as unknown as FormRow;

    const existing = (await unwrap(
      supabase.from('enrollment_requests').select('id, status').eq('form_id', form.id).maybeSingle(),
    )) as { id: string; status: string } | null;

    return { form, existing };
  }, [slug]);

  const fields = useMemo(
    () => [...(q.data?.form.enrollment_form_fields ?? [])].sort((a, b) => a.position - b.position),
    [q.data],
  );

  const setVal = (id: string, v: string | string[]) => setValues((p) => ({ ...p, [id]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.data) return;
    const { form } = q.data;
    setSubmitting(true);
    setError(null);
    try {
      const { data: reqRow, error: reqErr } = await supabase
        .from('enrollment_requests')
        .insert({ form_id: form.id, course_id: form.course_id, student_id: profile!.id })
        .select('id')
        .single();
      if (reqErr) throw new Error(reqErr.message);

      const answers: Array<Record<string, unknown>> = [];
      for (const f of fields) {
        let file_path: string | null = null;
        if (f.field_type === 'file' && files[f.id]) {
          const file = files[f.id]!;
          const path = `${profile!.id}/${form.id}/${reqRow.id}-${f.id}-${file.name}`;
          const up = await supabase.storage.from('enrollment-uploads').upload(path, file, { upsert: true });
          if (up.error) throw new Error(up.error.message);
          file_path = path;
        }
        const raw = values[f.id];
        answers.push({
          request_id: reqRow.id,
          field_id: f.id,
          value_text: Array.isArray(raw) ? null : raw ?? null,
          value_json: Array.isArray(raw) ? raw : null,
          file_path,
        });
      }
      if (answers.length) {
        const { error: ansErr } = await supabase.from('enrollment_request_answers').insert(answers as never);
        if (ansErr) throw new Error(ansErr.message);
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (q.loading) return <Wrapper><Spinner /></Wrapper>;
  if (q.error || !q.data)
    return (
      <Wrapper>
        <h1 className="text-lg font-semibold text-neutral-900">Form not found</h1>
        <p className="mt-2 text-sm text-neutral-600">{q.error ?? 'This enrollment form does not exist.'}</p>
        <Link to="/app/courses" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
          Back to catalog
        </Link>
      </Wrapper>
    );

  const { form, existing } = q.data;
  const now = Date.now();
  const closed =
    !form.is_open ||
    (form.opens_at && new Date(form.opens_at).getTime() > now) ||
    (form.closes_at && new Date(form.closes_at).getTime() < now);

  if (done || existing) {
    const status = existing?.status ?? 'pending';
    return (
      <Wrapper>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="text-green-500" size={40} />
          <h1 className="text-lg font-semibold text-neutral-900">
            {status === 'approved' ? 'You’re enrolled!' : status === 'rejected' ? 'Request declined' : 'Request submitted'}
          </h1>
          <p className="text-sm text-neutral-600">
            {status === 'approved'
              ? 'Your enrollment was approved. Open the course to start learning.'
              : status === 'rejected'
                ? 'An administrator declined this enrollment request.'
                : 'An administrator will review your enrollment request shortly.'}
          </p>
          <Link to="/app/courses" className="mt-2 text-sm font-medium text-blue-600 hover:underline">
            Back to catalog
          </Link>
        </div>
      </Wrapper>
    );
  }

  if (closed)
    return (
      <Wrapper>
        <div className="flex flex-col items-center gap-3 text-center">
          <Clock className="text-amber-500" size={36} />
          <h1 className="text-lg font-semibold text-neutral-900">Enrollment is closed</h1>
          <p className="text-sm text-neutral-600">This form is not accepting responses right now.</p>
          <Link to="/app/courses" className="mt-2 text-sm font-medium text-blue-600 hover:underline">
            Back to catalog
          </Link>
        </div>
      </Wrapper>
    );

  return (
    <Wrapper>
      <div className="text-xs font-semibold uppercase tracking-wide text-blue-500">{form.course?.title}</div>
      <h1 className="mt-1 font-display text-2xl font-semibold text-neutral-900">{form.title}</h1>
      {form.description && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{form.description}</p>}

      <form onSubmit={submit} className="mt-6 space-y-4">
        {fields.map((f) => (
          <Field key={f.id} label={f.label} hint={f.help_text} required={f.required}>
            {renderField(f, values[f.id], setVal, (file) => setFiles((p) => ({ ...p, [f.id]: file })))}
          </Field>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={submitting} className="w-full">
          Submit enrollment request
        </Button>
      </form>
    </Wrapper>
  );
}

function renderField(
  f: FormField,
  value: string | string[] | undefined,
  setVal: (id: string, v: string | string[]) => void,
  setFile: (file: File | null) => void,
) {
  const opts = Array.isArray(f.options_json) ? f.options_json : [];
  switch (f.field_type) {
    case 'textarea':
      return <TextArea required={f.required} value={(value as string) ?? ''} onChange={(e) => setVal(f.id, e.target.value)} />;
    case 'number':
      return <TextInput type="number" required={f.required} value={(value as string) ?? ''} onChange={(e) => setVal(f.id, e.target.value)} />;
    case 'email':
      return <TextInput type="email" required={f.required} value={(value as string) ?? ''} onChange={(e) => setVal(f.id, e.target.value)} />;
    case 'phone':
      return <TextInput type="tel" required={f.required} value={(value as string) ?? ''} onChange={(e) => setVal(f.id, e.target.value)} />;
    case 'date':
      return <TextInput type="date" required={f.required} value={(value as string) ?? ''} onChange={(e) => setVal(f.id, e.target.value)} />;
    case 'select':
      return (
        <Select required={f.required} value={(value as string) ?? ''} onChange={(e) => setVal(f.id, e.target.value)}>
          <option value="">Select…</option>
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
    case 'multiselect':
      return (
        <div className="space-y-1.5">
          {opts.map((o) => {
            const arr = (value as string[]) ?? [];
            return (
              <Checkbox
                key={o}
                label={o}
                checked={arr.includes(o)}
                onChange={(e) => setVal(f.id, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
              />
            );
          })}
        </div>
      );
    case 'checkbox':
      return (
        <Checkbox
          label="Yes"
          checked={value === 'true'}
          onChange={(e) => setVal(f.id, e.target.checked ? 'true' : 'false')}
        />
      );
    case 'file':
      return <input type="file" required={f.required} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />;
    default:
      return <TextInput required={f.required} value={(value as string) ?? ''} onChange={(e) => setVal(f.id, e.target.value)} />;
  }
}
