import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { answerValueToStrings, topAnswerRows } from '../../lib/formAnalytics';
import { FormFieldStatsGrid, type FieldStat } from '../../components/FormFieldStats';
import { Badge, PageHeader, Spinner } from '../../components/ui/kit';

interface FieldRow {
  id: string;
  label: string;
  field_type: string;
  position: number;
}

const FIELD_TYPE_LABEL: Record<string, string> = {
  text: 'Text',
  textarea: 'Text',
  select: 'Choice',
  multiselect: 'Multi-choice',
  number: 'Number',
  email: 'Email',
  phone: 'Phone',
  date: 'Date',
  file: 'File',
  checkbox: 'Checkbox',
};

export function FormAnalytics() {
  const { id } = useParams();

  const q = useQuery(async () => {
    const form = (await unwrap(
      supabase
        .from('enrollment_forms')
        .select('id, title, is_public, course:courses(title)')
        .eq('id', id as string)
        .single(),
    )) as any;

    const fields = (await unwrap(
      supabase.from('enrollment_form_fields').select('id, label, field_type, position').eq('form_id', id as string).order('position'),
    )) as FieldRow[];

    const answersByField = new Map<string, string[]>();
    for (const f of fields) answersByField.set(f.label, []);
    let responseCount = 0;

    if (form.is_public) {
      const regs = (await unwrap(
        supabase.from('registrations').select('answers').eq('form_id', id as string),
      )) as { answers: Record<string, unknown> }[];
      responseCount = regs.length;
      for (const r of regs) {
        for (const f of fields) {
          const vals = answerValueToStrings((r.answers ?? {})[f.label]);
          if (vals.length) answersByField.get(f.label)!.push(...vals);
        }
      }
    } else {
      const reqs = (await unwrap(
        supabase
          .from('enrollment_requests')
          .select('id, enrollment_request_answers(value_text, value_json, field:enrollment_form_fields(id, label))')
          .eq('form_id', id as string),
      )) as {
        id: string;
        enrollment_request_answers: { value_text: string | null; value_json: unknown; field: { id: string; label: string } | null }[];
      }[];
      responseCount = reqs.length;
      for (const r of reqs) {
        for (const a of r.enrollment_request_answers) {
          if (!a.field) continue;
          const raw = Array.isArray(a.value_json) && (a.value_json as unknown[]).length ? a.value_json : a.value_text;
          const vals = answerValueToStrings(raw);
          if (vals.length) answersByField.get(a.field.label)?.push(...vals);
        }
      }
    }

    const stats: FieldStat[] = fields
      .filter((f) => f.field_type !== 'file')
      .map((f) => {
        const values = answersByField.get(f.label) ?? [];
        const counts = new Map<string, number>();
        for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
        return { key: f.id, label: f.label, typeLabel: FIELD_TYPE_LABEL[f.field_type] ?? f.field_type, total: values.length, rows: topAnswerRows(counts) };
      })
      .filter((s) => s.total > 0);

    return { form, responseCount, stats };
  }, [id]);

  if (q.loading) return <Spinner />;
  if (!q.data) return null;
  const { form, responseCount, stats } = q.data;

  return (
    <div>
      <Link to="/admin/forms" className="mb-3 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
        <ChevronLeft size={15} /> Forms
      </Link>
      <PageHeader
        title={`${form.title} — Analytics`}
        subtitle={form.course?.title ? `Course: ${form.course.title}` : undefined}
        actions={<Badge tone="blue">{responseCount} response{responseCount === 1 ? '' : 's'}</Badge>}
      />

      <FormFieldStatsGrid stats={stats} />
    </div>
  );
}
