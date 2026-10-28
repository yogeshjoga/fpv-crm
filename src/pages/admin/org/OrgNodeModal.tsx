import { useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { removeMedia, uploadOrgPhoto } from '../../../lib/siteMedia';
import { Button, Checkbox, Field, Modal, Select, TextArea, TextInput, useToast } from '../../../components/ui/kit';
import {
  ACCENTS, EMPLOYMENT_TYPE_LABEL, displayName, subtreeIds,
  type Accent, type EmployeeRecord, type OrgNodeView, type PersonProfile,
} from '../../../lib/orgChart';

export interface StaffOption extends PersonProfile {
  designation: string;
}

type Source = 'employee' | 'account' | 'outside' | 'group';
const SOURCES: { key: Source; label: string; hint: string }[] = [
  { key: 'employee', label: 'Employee or intern', hint: 'From your HR records' },
  { key: 'account', label: 'A user account', hint: 'Staff, or anyone who has a login' },
  { key: 'outside', label: 'Someone from outside', hint: 'A temporary person, not in the organisation' },
  { key: 'group', label: 'A team or role', hint: 'A box that groups people' },
];

const sourceOf = (n: OrgNodeView | null): Source => {
  if (!n) return 'employee';
  if (n.kind === 'group') return 'group';
  if (n.employee_id) return 'employee';
  if (n.profile_id) return 'account';
  return 'outside';
};

/** Add or edit one box in the chart: an HR employee or intern, a user account, a temporary outsider, or a team. */
export function OrgNodeModal({ chartId, node, nodes, accounts, employees, defaultParent, onClose, onSaved }: {
  chartId: string;
  node: OrgNodeView | null;
  nodes: OrgNodeView[];
  accounts: StaffOption[];
  employees: EmployeeRecord[];
  defaultParent: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [source, setSource] = useState<Source>(sourceOf(node));
  const [profileId, setProfileId] = useState(node?.profile_id ?? '');
  const [employeeId, setEmployeeId] = useState(node?.employee_id ?? '');
  const [find, setFind] = useState('');
  const [label, setLabel] = useState(node?.label ?? '');
  const [title, setTitle] = useState(node?.title ?? '');
  const [temporary, setTemporary] = useState(node ? node.is_external : true);
  const [until, setUntil] = useState(node?.until ?? '');
  const [parent, setParent] = useState(node ? node.parent_id ?? '' : defaultParent ?? '');
  const [accent, setAccent] = useState<Accent>(node?.accent ?? 'slate');
  const [image, setImage] = useState(node?.image_url ?? '');
  const [note, setNote] = useState(node?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const takenProfiles = useMemo(() => new Set(nodes.filter((n) => n.profile_id && n.id !== node?.id).map((n) => n.profile_id as string)), [nodes, node?.id]);
  const takenEmployees = useMemo(() => new Set(nodes.filter((n) => n.employee_id && n.id !== node?.id).map((n) => n.employee_id as string)), [nodes, node?.id]);
  const blocked = useMemo(() => new Set(node ? subtreeIds(nodes, node.id) : []), [nodes, node]);
  const managers = nodes.filter((n) => !blocked.has(n.id));
  const needle = find.trim().toLowerCase();
  const shownAccounts = accounts.filter((a) => !needle || `${a.full_name ?? ''} ${a.email ?? ''}`.toLowerCase().includes(needle));
  const shownEmployees = employees.filter((e) => !needle || `${e.full_name} ${e.designation}`.toLowerCase().includes(needle));
  const chosenEmployee = employees.find((e) => e.id === employeeId);

  const pickEmployee = (id: string) => {
    setError(null);
    setEmployeeId(id);
    const e = employees.find((x) => x.id === id);
    if (e && !title.trim()) setTitle(e.designation || EMPLOYMENT_TYPE_LABEL[e.employment_type] || '');
  };
  const pickAccount = (id: string) => {
    setError(null);
    setProfileId(id);
    const a = accounts.find((x) => x.id === id);
    if (a && !title.trim()) setTitle(a.designation || '');
  };

  // The photo is uploaded straight away and used as the box's picture once the box is saved.
  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadOrgPhoto(file);
      setImage(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the photo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    if (source === 'employee' && !employeeId) return setError('Choose the employee or intern.');
    if (source === 'account' && !profileId) return setError('Choose the user account.');
    if ((source === 'outside' || source === 'group') && !label.trim()) return setError(source === 'group' ? 'Give the team a name.' : 'Type the person’s name.');
    const url = image.trim();
    if (url && !/^https:\/\/\S+$/i.test(url)) return setError('The photo link must start with https://');
    if (until && source !== 'outside') return setError('An end date is only for people from outside.');
    const external = source === 'outside' && temporary;
    const row = {
      chart_id: chartId, parent_id: parent || null,
      kind: source === 'group' ? 'group' : 'person',
      profile_id: source === 'account' ? profileId : null,
      employee_id: source === 'employee' ? employeeId : null,
      is_external: external,
      until: external && until ? until : null,
      label: source === 'outside' || source === 'group' ? label.trim() : '',
      title: title.trim(), image_url: url || null, note: note.trim(), accent,
    };
    setBusy(true);
    const { error: e } = node ? await supabase.from('org_nodes').update(row).eq('id', node.id) : await supabase.from('org_nodes').insert(row);
    setBusy(false);
    if (e) return setError(e.message.includes('duplicate') ? 'That person is already in this chart.' : e.message);
    // a replaced or removed picture that we uploaded is deleted so old files do not pile up
    const old = node?.image_url ?? '';
    if (old && old !== url && old.includes('/site-media/org/')) await removeMedia([old.slice(old.indexOf('org/'))]);
    toast(node ? 'Saved' : 'Added to the chart');
    onSaved();
  };

  const remove = async () => {
    if (!node) return;
    const kids = nodes.filter((n) => n.parent_id === node.id).length;
    if (!confirm(`Remove ${displayName(node)} from the chart?${kids ? ` Their ${kids} direct report${kids === 1 ? '' : 's'} will move up to their manager.` : ''} The person’s account or HR record is not deleted.`)) return;
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
        <Field label="Who is this?">
          <div className="grid gap-2 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <button key={s.key} type="button" onClick={() => { setSource(s.key); setError(null); setFind(''); }} className={`rounded-2xl border px-3 py-2 text-left ${source === s.key ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-white/70 bg-white/70 text-neutral-800 hover:bg-white'}`}>
                <span className="block text-sm font-medium">{s.label}</span>
                <span className={`block text-xs ${source === s.key ? 'text-white/70' : 'text-neutral-500'}`}>{s.hint}</span>
              </button>
            ))}
          </div>
        </Field>

        {source === 'employee' && (
          <div className="space-y-2">
            <Field label="Employee or intern" required>
              <TextInput value={find} onChange={(e) => setFind(e.target.value)} placeholder="Type to search by name" />
            </Field>
            {!employees.length ? (
              <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">There are no employees or interns in the HR records yet. They appear here once someone is hired from Careers. Until then, add them as a user account or as someone from outside.</p>
            ) : (
              <Select value={employeeId} onChange={(e) => pickEmployee(e.target.value)} size={Math.min(6, Math.max(2, shownEmployees.length))} className="!h-auto !rounded-2xl !py-2">
                {shownEmployees.map((e) => <option key={e.id} value={e.id} disabled={takenEmployees.has(e.id)}>{e.full_name} ({EMPLOYMENT_TYPE_LABEL[e.employment_type] ?? e.employment_type}{e.designation ? `, ${e.designation}` : ''}){takenEmployees.has(e.id) ? ' (already in this chart)' : ''}</option>)}
              </Select>
            )}
            {chosenEmployee && !chosenEmployee.profile_id && <p className="text-xs text-amber-700">This person has no login account, so leads cannot be credited to them. They can still be shown in the chart.</p>}
          </div>
        )}

        {source === 'account' && (
          <div className="space-y-2">
            <Field label="User account" required hint="Linking an account shows that person’s leads and admissions.">
              <TextInput value={find} onChange={(e) => setFind(e.target.value)} placeholder="Type to search by name or email" />
            </Field>
            <Select value={profileId} onChange={(e) => pickAccount(e.target.value)} size={Math.min(6, Math.max(2, shownAccounts.length))} className="!h-auto !rounded-2xl !py-2">
              {shownAccounts.slice(0, 200).map((a) => <option key={a.id} value={a.id} disabled={takenProfiles.has(a.id)}>{a.full_name || a.email} ({a.role}){takenProfiles.has(a.id) ? ' (already in this chart)' : ''}</option>)}
            </Select>
            {shownAccounts.length > 200 && <p className="text-xs text-neutral-500">Showing the first 200. Type more of the name to narrow the list.</p>}
          </div>
        )}

        {(source === 'outside' || source === 'group') && (
          <Field label={source === 'group' ? 'Team or role name' : 'Name'} required>
            <TextInput value={label} maxLength={80} onChange={(e) => { setError(null); setLabel(e.target.value); }} placeholder={source === 'group' ? 'e.g. Admissions team' : 'e.g. Priya Sharma'} />
          </Field>
        )}
        {source === 'outside' && (
          <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
            <Checkbox label="Temporary, from outside the organisation" checked={temporary} onChange={(e) => setTemporary(e.target.checked)} />
            {temporary && <Field label="Until" hint="Optional. After this date the box is shown as ended."><TextInput type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></Field>}
            <p className="text-xs text-neutral-600">Shown with a dashed border and a Temporary label. They have no lead numbers because they have no account.</p>
          </div>
        )}

        <Field label="Title" hint={source === 'outside' ? 'For example Consultant, Guest trainer, Advisor, and their company.' : source === 'group' ? 'Optional, shown under the name.' : 'For example CEO, Admissions Manager, Counsellor.'}>
          <TextInput value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Reports to" hint="Leave empty to make this a top-level box.">
          <Select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Nobody (top of the chart)</option>
            {managers.map((n) => <option key={n.id} value={n.id}>{displayName(n)}{n.title ? `, ${n.title}` : ''}</option>)}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Colour"><Select value={accent} onChange={(e) => setAccent(e.target.value as Accent)}>{(Object.keys(ACCENTS) as Accent[]).map((a) => <option key={a} value={a}>{ACCENTS[a].label}</option>)}</Select></Field>
          <Field label="Photo" hint="Upload a picture, or paste a https link. Without one, an account's own photo (or initials) is used.">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white bg-neutral-100 text-xs text-neutral-400">
                {/^https:\/\//i.test(image.trim()) ? <img src={image.trim()} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : 'No photo'}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void choosePhoto(e.target.files?.[0])} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>{image ? 'Replace photo' : 'Upload photo'}</Button>
                  {image && <Button type="button" variant="ghost" onClick={() => setImage('')}>Remove</Button>}
                </div>
                <TextInput value={image} maxLength={500} onChange={(e) => { setError(null); setImage(e.target.value); }} placeholder="or paste a https:// link" />
              </div>
            </div>
          </Field>
        </div>
        <Field label="Note" hint="Optional, shown when the box is opened."><TextArea rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <div>{node && <Button variant="secondary" onClick={() => void remove()} disabled={busy}><Trash2 size={15} /> Remove</Button>}</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void save()} loading={busy} disabled={uploading}>{node ? 'Save' : 'Add'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
