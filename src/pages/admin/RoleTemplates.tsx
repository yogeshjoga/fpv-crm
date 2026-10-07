import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { slugify } from '../../lib/slug';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, Checkbox, EmptyState, Field, PageHeader, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';
import { CareersNav } from '../../components/CareersNav';
import { JobText } from '../../components/JobText';
import { LEVEL_LABEL, buildJd, levelNotes, type Level, type RoleTemplate } from '../../lib/offers';

const LEVELS: Level[] = ['intern', 'fresher', 'experienced'];

/** The job descriptions HR starts from for each role. Edit them here and every new offer letter uses the new text. */
export function RoleTemplates() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const ro = !canWrite('careers');
  const [selected, setSelected] = useState<string | null>(null);

  const q = useQuery(() => unwrap(supabase.from('careers_role_templates').select('*').order('sort_order').order('title')) as Promise<RoleTemplate[]>, []);
  const list = q.data ?? [];
  const current = list.find((t) => t.id === (selected ?? list[0]?.id));

  const addRole = async () => {
    const title = 'New role';
    const { data, error } = await supabase
      .from('careers_role_templates')
      .insert({ title, slug: `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`, sort_order: (list.at(-1)?.sort_order ?? 0) + 1, is_active: true })
      .select('id')
      .single();
    if (error) return toast(error.message, 'error');
    await q.refetch();
    setSelected(data.id);
  };

  if (q.loading && !q.data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Role templates"
        subtitle="The job description for each role, and what changes for an intern, a fresher and an experienced hire"
        actions={
          !ro && (
            <Button onClick={addRole}>
              <Plus size={16} /> New role
            </Button>
          )
        }
      />
      <CareersNav />

      {!list.length ? (
        <EmptyState title="No role templates" description="Add the roles you hire for. Each one holds a job description you can edit." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`block w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${current?.id === t.id ? 'border-neutral-900 bg-white' : 'border-white/70 bg-white/50 hover:bg-white/80'}`}
              >
                <div className="font-medium text-neutral-900">{t.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                  {t.department || 'No department'}
                  {!t.is_active && <Badge>Hidden</Badge>}
                </div>
              </button>
            ))}
          </div>
          {current && <RoleEditor key={current.id} role={current} ro={ro} onSaved={() => q.refetch()} onDeleted={() => { setSelected(null); q.refetch(); }} />}
        </div>
      )}
    </div>
  );
}

function RoleEditor({ role, ro, onSaved, onDeleted }: { role: RoleTemplate; ro: boolean; onSaved: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(role.title);
  const [department, setDepartment] = useState(role.department);
  const [summary, setSummary] = useState(role.summary);
  const [jd, setJd] = useState(role.jd);
  const [notes, setNotes] = useState(levelNotes(role));
  const [active, setActive] = useState(role.is_active);
  const [preview, setPreview] = useState<Level>('intern');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (title.trim().length < 3) return toast('Give the role a title', 'error');
    setBusy(true);
    const { error } = await supabase
      .from('careers_role_templates')
      .update({ title: title.trim(), department: department.trim(), summary: summary.trim(), jd, level_notes: notes, is_active: active })
      .eq('id', role.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Saved');
    onSaved();
  };

  const remove = async () => {
    if (!window.confirm(`Delete the "${role.title}" template? Offer letters already made keep their text.`)) return;
    const { error } = await supabase.from('careers_role_templates').delete().eq('id', role.id);
    if (error) return toast(error.message, 'error');
    toast('Deleted');
    onDeleted();
  };

  return (
    <GlassCard className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role title">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} disabled={ro} />
        </Field>
        <Field label="Department">
          <TextInput value={department} onChange={(e) => setDepartment(e.target.value)} disabled={ro} />
        </Field>
      </div>
      <Field label="One-line summary" hint="Shown when you pick a role and on the positions list">
        <TextInput value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={400} disabled={ro} />
      </Field>
      <Field label="Job description" hint="Blank line between paragraphs. Start a line with “- ” for a bullet. A short line followed by bullets becomes a heading.">
        <TextArea rows={16} value={jd} onChange={(e) => setJd(e.target.value)} disabled={ro} />
      </Field>

      <div>
        <div className="mb-2 text-sm font-medium text-neutral-700">What is different at each level</div>
        <div className="grid gap-3 md:grid-cols-3">
          {LEVELS.map((l) => (
            <Field key={l} label={LEVEL_LABEL[l]}>
              <TextArea rows={5} value={notes[l]} onChange={(e) => setNotes({ ...notes, [l]: e.target.value })} disabled={ro} />
            </Field>
          ))}
        </div>
      </div>

      <Checkbox label="Available when preparing offer letters" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={ro} />

      <div className="rounded-2xl border border-white/70 bg-white/60 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-neutral-700">Preview as</span>
          {LEVELS.map((l) => (
            <button key={l} onClick={() => setPreview(l)} className={`rounded-full px-3 py-1 text-xs font-medium ${preview === l ? 'bg-[#1a1a1a] text-white' : 'bg-white text-neutral-600'}`}>
              {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>
        <JobText text={buildJd({ jd, level_notes: notes }, preview)} />
      </div>

      {!ro && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" className="text-red-600" onClick={remove}>
            <Trash2 size={15} /> Delete role
          </Button>
          <Button onClick={save} loading={busy}>
            Save changes
          </Button>
        </div>
      )}
    </GlassCard>
  );
}
