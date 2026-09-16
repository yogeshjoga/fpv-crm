import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, EmptyState, PageHeader, Spinner } from '../../components/ui/kit';

interface FieldRow {
  id: string;
  label: string;
  field_type: string;
  position: number;
}

interface FieldStat {
  field: FieldRow;
  total: number;
  rows: { label: string; count: number }[];
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

/** Any answer shape (string, number, boolean, string[]) -> a list of trimmed, non-empty strings. */
function valueToStrings(v: unknown): string[] {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return [String(v).trim()].filter(Boolean);
}

/** Bucket a value->count map into the top N entries plus a single "Other" row for the long tail. */
function topRows(counts: Map<string, number>, cap = 8): { label: string; count: number }[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, cap).map(([label, count]) => ({ label, count }));
  const restCount = sorted.slice(cap).reduce((s, [, c]) => s + c, 0);
  return restCount > 0 ? [...top, { label: `Other (${sorted.length - cap})`, count: restCount }] : top;
}

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
          const vals = valueToStrings((r.answers ?? {})[f.label]);
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
          const vals = valueToStrings(raw);
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
        return { field: f, total: values.length, rows: topRows(counts) };
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

      {!stats.length ? (
        <EmptyState
          icon={<BarChart3 size={22} />}
          title="Not enough data yet"
          description="Analytics fill in automatically once people start submitting this form."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {stats.map((s) => (
            <GlassCard key={s.field.id} className="p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="font-semibold text-neutral-900">{s.field.label}</div>
                <Badge>{FIELD_TYPE_LABEL[s.field.field_type] ?? s.field.field_type}</Badge>
              </div>
              <div className="space-y-2">
                {s.rows.map((row) => (
                  <div key={row.label}>
                    <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-neutral-600" title={row.label}>
                        {row.label}
                      </span>
                      <span className="shrink-0 text-neutral-400">
                        {row.count} · {Math.round((row.count / s.total) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.05]">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(4, (row.count / s.total) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-neutral-400">
                {s.total} answer{s.total === 1 ? '' : 's'}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
