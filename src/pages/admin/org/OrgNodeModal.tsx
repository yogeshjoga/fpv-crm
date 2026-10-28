import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Button, Field, Modal, Select, TextArea, TextInput, useToast } from '../../../components/ui/kit';
import { ACCENTS, displayName, subtreeIds, type Accent, type OrgNodeView, type PersonProfile } from '../../../lib/orgChart';

export interface StaffOption extends PersonProfile {
  designation: string;
}

/** Add or edit one box in the chart: a person (linked to a staff account, or just a name) or a team. */
export function OrgNodeModal({ chartId, node, nodes, staff, defaultParent, onClose, onSaved }: {
  chartId: string;
  node: OrgNodeView | null;
  nodes: OrgNodeView[];
  staff: StaffOption[];
  defaultParent: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<'person' | 'group'>(node?.kind ?? 'person');
  const [profileId, setProfileId] = useState(node?.profile_id ?? '');
  const [label, setLabel] = useState(node?.label ?? '');
  const [title, setTitle] = useState(node?.title ?? '');
  const [parent, setParent] = useState(node ? node.parent_id ?? '' : defaultParent ?? '');
  const [accent, setAccent] = useState<Accent>(node?.accent ?? 'slate');
  const [image, setImage] = useState(node?.image_url ?? '');
  const [note, setNote] = useState(node?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taken = useMemo(() => new Set(nodes.filter((n) => n.profile_id && n.id !== node?.id).map((n) => n.profile_id as string)), [nodes, node?.id]);
  const blocked = useMemo(() => new Set(node ? subtreeIds(nodes, node.id) : []), [nodes, node]);
  const managers = nodes.filter((n) => !blocked.has(n.id));
  const chosen = staff.find((s) => s.id === profileId);

  const pickAccount = (id: string) => {
    setProfileId(id);
    setError(null);
    const s = staff.find((x) => x.id === id);
    if (s && !title.trim()) setTitle(s.designation || '');
  };

  const save = async () => {
    if (kind === 'person' && !profileId && !label.trim()) return setError('Choose a staff account, or type a name.');
    if (kind === 'group' && !label.trim()) return setError('Give the team a name.');
    const url = image.trim();
    if (url && !/^https:\/\/\S+$/i.test(url)) return setError('The photo link must start with https://');
    const row = {
      chart_id: chartId, parent_id: parent || null, kind, profile_id: kind === 'person' && profileId ? profileId : null,
      label: label.trim(), title: title.trim(), image_url: url || null, note: note.trim(), accent,
    };
    setBusy(true);
    const { error: e } = node ? await supabase.from('org_nodes').update(row).eq('id', node.id) : await supabase.from('org_nodes').insert(row);
    setBusy(false);
    if (e) return setError(e.message.includes('duplicate') ? 'That person is already in this chart.' : e.message);
    toast(node ? 'Saved' : 'Added to the chart');
    onSaved();
  };

  const remove = async () => {
    if (!node) return;
    const kids = nodes.filter((n) => n.parent_id === node.id).length;
    if (!confirm(`Remove ${displayName(node)} from the chart?${kids ? ` Their ${kids} direct report${kids === 1 ? '' : 's'} will move up to their manager.` : ''} The staff account itself is not deleted.`)) return;
    setBusy(true);
    const { error: e } = await supabase.from('org_nodes').delete().eq('id', node.id);
    setBusy(false);
    if (e) return setError(e.message);
    toast('Removed from the chart');
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={node ? `Edit ${displayName(node)}` : 'Add to the chart'}>
      <div className="space-y-4">
        <Field label="This is">
          <div className="flex gap-2">
            {(['person', 'group'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${kind === k ? 'bg-[#1a1a1a] text-white' : 'bg-white/70 text-neutral-700 hover:bg-white'}`}>{k === 'person' ? 'A person' : 'A team or role'}</button>
            ))}
          </div>
        </Field>

        {kind === 'person' && (
          <Field label="Staff account" hint="Link an account to see that person’s leads and admissions. Leave empty for someone without an account.">
            <Select value={profileId} onChange={(e) => pickAccount(e.target.value)}>
              <option value="">No account (type a name below)</option>
              {staff.map((s) => <option key={s.id} value={s.id} disabled={taken.has(s.id)}>{(s.full_name || s.email || 'Unnamed')} ({s.role}){taken.has(s.id) ? ' (already in this chart)' : ''}</option>)}
            </Select>
          </Field>
        )}
        {(kind === 'group' || !profileId) && (
          <Field label={kind === 'group' ? 'Team or role name' : 'Name'} required><TextInput value={label} maxLength={80} onChange={(e) => { setError(null); setLabel(e.target.value); }} placeholder={kind === 'group' ? 'e.g. Admissions team' : 'e.g. Priya Sharma'} /></Field>
        )}
        <Field label="Title" hint={kind === 'group' ? 'Optional, shown under the name.' : 'For example CEO, Admissions Manager, Counsellor.'}><TextInput value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Reports to" hint="Leave empty to make this a top-level box.">
          <Select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Nobody (top of the chart)</option>
            {managers.map((n) => <option key={n.id} value={n.id}>{displayName(n)}{n.title ? `, ${n.title}` : ''}</option>)}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Colour"><Select value={accent} onChange={(e) => setAccent(e.target.value as Accent)}>{(Object.keys(ACCENTS) as Accent[]).map((a) => <option key={a} value={a}>{ACCENTS[a].label}</option>)}</Select></Field>
          <Field label="Photo link" hint={chosen?.avatar_url ? 'Empty uses their profile photo.' : 'Optional, https only.'}><TextInput value={image} maxLength={500} onChange={(e) => { setError(null); setImage(e.target.value); }} placeholder="https://…" /></Field>
        </div>
        <Field label="Note" hint="Optional, shown when the box is opened."><TextArea rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <div>{node && <Button variant="secondary" onClick={() => void remove()} disabled={busy}><Trash2 size={15} /> Remove</Button>}</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void save()} loading={busy}>{node ? 'Save' : 'Add'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
