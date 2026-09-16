import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, GripVertical, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Button, Checkbox, Field, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';

const FIELD_TYPES = ['text', 'textarea', 'email', 'phone', 'number', 'date', 'select', 'multiselect', 'checkbox', 'file'] as const;
const HAS_OPTIONS = new Set(['select', 'multiselect']);

export function FormBuilder() {
  const { id } = useParams();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('forms');
  const toast = useToast();

  const q = useQuery(async () => {
    const form = (await unwrap(
      supabase
        .from('enrollment_forms')
        .select('id, title, description, course:courses(title), enrollment_form_fields(id, label, field_type, options_json, required, help_text, position)')
        .eq('id', id as string)
        .single(),
    )) as any;
    return form;
  }, [id]);

  const [savingId, setSavingId] = useState<string | null>(null);

  if (q.loading) return <Spinner />;
  if (q.error) return <p className="text-sm text-red-600">{q.error}</p>;
  const form = q.data;
  const fields = [...(form.enrollment_form_fields ?? [])].sort((a: any, b: any) => a.position - b.position);

  const addField = async () => {
    const { error } = await supabase
      .from('enrollment_form_fields')
      .insert({ form_id: form.id, label: 'Untitled question', field_type: 'text', position: fields.length });
    if (error) return toast(error.message, 'error');
    q.refetch();
  };

  const saveField = async (f: any) => {
    setSavingId(f.id);
    const options_json = HAS_OPTIONS.has(f.field_type)
      ? String(f._optionsText ?? (Array.isArray(f.options_json) ? f.options_json.join('\n') : ''))
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const { error } = await supabase
      .from('enrollment_form_fields')
      .update({ label: f.label, field_type: f.field_type, required: f.required, help_text: f.help_text ?? '', options_json })
      .eq('id', f.id);
    setSavingId(null);
    if (error) return toast(error.message, 'error');
    toast('Saved');
    q.refetch();
  };

  const delField = async (fid: string) => {
    await supabase.from('enrollment_form_fields').delete().eq('id', fid);
    q.refetch();
  };

  return (
    <div>
      <Link to="/admin/forms" className="mb-3 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
        <ChevronLeft size={15} /> Forms
      </Link>
      <PageHeader
        title={form.title}
        subtitle={`${form.course?.title} · drag order by position`}
        actions={
          writable && (
            <Button onClick={addField}>
              <Plus size={16} /> Add field
            </Button>
          )
        }
      />

      <div className="space-y-3">
        {fields.map((f: any, i: number) => (
          <FieldEditor
            key={f.id}
            index={i}
            field={f}
            saving={savingId === f.id}
            writable={writable}
            onSave={saveField}
            onDelete={() => delField(f.id)}
          />
        ))}
        {!fields.length && <p className="text-sm text-neutral-400">No fields yet. Add the questions your applicants should answer.</p>}
      </div>
    </div>
  );
}

function FieldEditor({
  index,
  field,
  saving,
  writable,
  onSave,
  onDelete,
}: {
  index: number;
  field: any;
  saving: boolean;
  writable: boolean;
  onSave: (f: any) => void;
  onDelete: () => void;
}) {
  const [local, setLocal] = useState<any>({
    ...field,
    _optionsText: Array.isArray(field.options_json) ? field.options_json.join('\n') : '',
  });
  const set = (k: string, v: unknown) => setLocal((p: any) => ({ ...p, [k]: v }));

  return (
    <GlassCard className="p-4">
      <div className="flex items-start gap-3">
        <div className="pt-2 text-neutral-300">
          <GripVertical size={16} />
        </div>
        <div className="flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <Field label={`Field ${index + 1} label`}>
              <TextInput disabled={!writable} value={local.label} onChange={(e) => set('label', e.target.value)} />
            </Field>
            <Field label="Type">
              <Select disabled={!writable} value={local.field_type} onChange={(e) => set('field_type', e.target.value)}>
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {HAS_OPTIONS.has(local.field_type) && (
            <Field label="Options" hint="One per line">
              <TextInput disabled={!writable} value={local._optionsText} onChange={(e) => set('_optionsText', e.target.value)} placeholder="Beginner, Intermediate, Advanced" />
            </Field>
          )}
          <Field label="Help text" hint="Optional">
            <TextInput disabled={!writable} value={local.help_text ?? ''} onChange={(e) => set('help_text', e.target.value)} />
          </Field>
          <div className="flex items-center justify-between">
            <Checkbox disabled={!writable} label="Required" checked={local.required} onChange={(e) => set('required', e.target.checked)} />
            {writable && (
              <div className="flex gap-2">
                <button onClick={onDelete} className="text-neutral-400 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
                <Button onClick={() => onSave(local)} loading={saving} variant="secondary">
                  Save
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
