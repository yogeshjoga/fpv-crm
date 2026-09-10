import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { invokeFn } from '../../lib/functions';
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
  title: string;
  description: string;
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

export function PublicRegistrationForm() {
  const { slug } = useParams();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'ok' | 'dup' | null>(null);

  const q = useQuery(
    () =>
      unwrap(
        supabase
          .from('enrollment_forms')
          .select('id, title, description, course:courses(title), enrollment_form_fields(id, label, field_type, options_json, required, help_text, position)')
          .eq('slug', slug as string)
          .eq('is_public', true)
          .eq('is_open', true)
          .maybeSingle(),
      ) as Promise<FormRow | null>,
    [slug],
  );

  const fields = useMemo(
    () =>
      [...(q.data?.enrollment_form_fields ?? [])]
        .filter((f) => f.field_type !== 'file')
        .sort((a, b) => a.position - b.position),
    [q.data],
  );

  const setVal = (label: string, v: string | string[]) => setValues((p) => ({ ...p, [label]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await invokeFn<{ ok: boolean; duplicate?: boolean }>('register', {
        form_slug: slug,
        full_name: fullName,
        email,
        phone,
        answers: values,
      });
      setDone(res.duplicate ? 'dup' : 'ok');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (q.loading) return <Wrapper><Spinner /></Wrapper>;
  if (!q.data)
    return (
      <Wrapper>
        <h1 className="text-lg font-semibold text-neutral-900">Form not available</h1>
        <p className="mt-2 text-sm text-neutral-600">This registration form is closed or does not exist.</p>
        <Link to="/login" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
          Go to sign in
        </Link>
      </Wrapper>
    );

  if (done)
    return (
      <Wrapper>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="text-green-500" size={40} />
          <h1 className="text-lg font-semibold text-neutral-900">
            {done === 'dup' ? 'Already registered' : 'Registration received'}
          </h1>
          <p className="text-sm text-neutral-600">
            {done === 'dup'
              ? 'We already have a pending registration for this email. An administrator will be in touch.'
              : 'Thanks! An administrator will review your registration and email your login details once approved.'}
          </p>
          <Link to="/login" className="mt-2 text-sm font-medium text-blue-600 hover:underline">
            Go to sign in
          </Link>
        </div>
      </Wrapper>
    );

  return (
    <Wrapper>
      {q.data.course?.title && <div className="text-xs font-semibold uppercase tracking-wide text-blue-500">{q.data.course.title}</div>}
      <h1 className="mt-1 font-display text-2xl font-semibold text-neutral-900">{q.data.title}</h1>
      {q.data.description && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{q.data.description}</p>}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Full name" required>
          <TextInput required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Email" required hint="Your login details will be sent here">
          <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone">
          <TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>

        {fields.map((f) => (
          <Field key={f.id} label={f.label} hint={f.help_text} required={f.required}>
            {renderField(f, values[f.label], setVal)}
          </Field>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={submitting} className="w-full">
          Submit registration
        </Button>
      </form>
    </Wrapper>
  );
}

function renderField(
  f: FormField,
  value: string | string[] | undefined,
  setVal: (label: string, v: string | string[]) => void,
) {
  const opts = Array.isArray(f.options_json) ? f.options_json : [];
  const s = (value as string) ?? '';
  switch (f.field_type) {
    case 'textarea':
      return <TextArea required={f.required} value={s} onChange={(e) => setVal(f.label, e.target.value)} />;
    case 'number':
      return <TextInput type="number" required={f.required} value={s} onChange={(e) => setVal(f.label, e.target.value)} />;
    case 'email':
      return <TextInput type="email" required={f.required} value={s} onChange={(e) => setVal(f.label, e.target.value)} />;
    case 'phone':
      return <TextInput type="tel" required={f.required} value={s} onChange={(e) => setVal(f.label, e.target.value)} />;
    case 'date':
      return <TextInput type="date" required={f.required} value={s} onChange={(e) => setVal(f.label, e.target.value)} />;
    case 'select':
      return (
        <Select required={f.required} value={s} onChange={(e) => setVal(f.label, e.target.value)}>
          <option value="">Select…</option>
          {opts.map((o) => (
            <option key={o} value={o}>{o}</option>
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
                onChange={(e) => setVal(f.label, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
              />
            );
          })}
        </div>
      );
    case 'checkbox':
      return <Checkbox label="Yes" checked={s === 'true'} onChange={(e) => setVal(f.label, e.target.checked ? 'true' : 'false')} />;
    default:
      return <TextInput required={f.required} value={s} onChange={(e) => setVal(f.label, e.target.value)} />;
  }
}
