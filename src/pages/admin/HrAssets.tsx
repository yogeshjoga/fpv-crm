import { useMemo, useState } from 'react';
import { Package, Plus, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';
import { CareersNav } from '../../components/CareersNav';
import { fmtDate } from '../../lib/offers';

type AssetStatus = 'available' | 'assigned' | 'repair' | 'retired';
const STATUS_LABEL: Record<AssetStatus, string> = { available: 'Available', assigned: 'Assigned', repair: 'In repair', retired: 'Retired' };
const STATUS_TONE: Record<AssetStatus, 'green' | 'blue' | 'amber' | 'neutral'> = { available: 'green', assigned: 'blue', repair: 'amber', retired: 'neutral' };

interface AssetRow {
  id: string;
  asset_tag: string;
  name: string;
  category: string;
  serial_no: string;
  status: AssetStatus;
  purchased_on: string | null;
  notes: string;
  hr_asset_assignments: { id: string; assigned_on: string; returned_on: string | null; employee_id: string; hr_employees: { full_name: string; employee_code: string | null } | null }[];
}

/** Company equipment (drones, laptops, tools): who has what, and what is free, in repair or retired. */
export function HrAssets() {
  const toast = useToast();
  const { profile } = useAuth();
  const { canWrite } = useAdminAccess();
  const ro = !canWrite('careers');
  const [status, setStatus] = useState<'all' | AssetStatus>('all');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [assigning, setAssigning] = useState<AssetRow | null>(null);

  const q = useQuery(
    () =>
      unwrap(
        supabase.from('hr_assets').select('*, hr_asset_assignments(id, assigned_on, returned_on, employee_id, hr_employees(full_name, employee_code))').order('asset_tag'),
      ) as unknown as Promise<AssetRow[]>,
    [],
  );
  const all = q.data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length, available: 0, assigned: 0, repair: 0, retired: 0 };
    for (const a of all) c[a.status] += 1;
    return c;
  }, [all]);
  const rows = all.filter((a) => (status === 'all' || a.status === status) && (!search.trim() || `${a.asset_tag} ${a.name} ${a.category} ${a.serial_no}`.toLowerCase().includes(search.trim().toLowerCase())));

  const setAssetStatus = async (a: AssetRow, next: AssetStatus) => {
    const { error } = await supabase.from('hr_assets').update({ status: next }).eq('id', a.id);
    if (error) return toast(error.message, 'error');
    toast(`Marked ${STATUS_LABEL[next].toLowerCase()}`);
    void q.refetch();
  };
  const giveBack = async (a: AssetRow, assignmentId: string) => {
    const note = window.prompt(`Condition of ${a.name} when returned (optional)`, '');
    if (note === null) return;
    const { error } = await supabase.from('hr_asset_assignments').update({ returned_on: new Date().toISOString().slice(0, 10), condition_in: note.trim() }).eq('id', assignmentId);
    if (error) return toast(error.message, 'error');
    toast('Returned');
    void q.refetch();
  };

  if (q.loading && !q.data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle="Drones, laptops, tools and kits: who has what, and what is free"
        actions={
          !ro && (
            <Button onClick={() => setAdding(true)}>
              <Plus size={16} /> Add asset
            </Button>
          )
        }
      />
      <CareersNav />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <TextInput className="!pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find an asset…" />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {(['all', 'available', 'assigned', 'repair', 'retired'] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3.5 py-1.5 font-medium ${status === s ? 'bg-[#1a1a1a] text-white' : 'bg-white/70 text-neutral-600 hover:bg-white'}`}>
              {s === 'all' ? 'All' : STATUS_LABEL[s]} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      {!rows.length ? (
        <EmptyState icon={<Package size={22} />} title="No assets" description="Add the equipment you hand out to people, then assign it from here or from an employee's record." />
      ) : (
        <div className="space-y-3">
          {rows.map((a) => {
            const open = a.hr_asset_assignments.find((x) => !x.returned_on);
            return (
              <GlassCard key={a.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-neutral-900">{a.name}</span>
                      <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {a.asset_tag}
                      {a.category ? ` · ${a.category}` : ''}
                      {a.serial_no ? ` · S/N ${a.serial_no}` : ''}
                    </div>
                    {open && (
                      <div className="mt-1 text-sm text-neutral-700">
                        With <span className="font-medium">{open.hr_employees?.full_name ?? 'someone'}</span> since {fmtDate(open.assigned_on)}
                      </div>
                    )}
                  </div>
                  {!ro && (
                    <div className="flex flex-wrap gap-2">
                      {a.status === 'available' && (
                        <Button variant="secondary" onClick={() => setAssigning(a)}>
                          Assign
                        </Button>
                      )}
                      {open && (
                        <Button variant="secondary" onClick={() => giveBack(a, open.id)}>
                          Return
                        </Button>
                      )}
                      {a.status === 'available' && (
                        <Button variant="ghost" onClick={() => setAssetStatus(a, 'repair')}>
                          Send to repair
                        </Button>
                      )}
                      {(a.status === 'repair' || a.status === 'retired') && (
                        <Button variant="ghost" onClick={() => setAssetStatus(a, 'available')}>
                          Make available
                        </Button>
                      )}
                      {(a.status === 'available' || a.status === 'repair') && (
                        <Button variant="ghost" className="text-red-600" onClick={() => setAssetStatus(a, 'retired')}>
                          Retire
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {adding && !ro && <AddAsset onClose={() => setAdding(false)} onAdded={() => { setAdding(false); void q.refetch(); }} />}
      {assigning && !ro && <AssignAsset asset={assigning} byId={profile?.id} onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); void q.refetch(); }} />}
    </div>
  );
}

function AddAsset({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ asset_tag: '', name: '', category: '', serial_no: '', purchased_on: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (f.asset_tag.trim().length < 2 || f.name.trim().length < 2) return toast('Give the asset a tag and a name', 'error');
    setBusy(true);
    const { error } = await supabase.from('hr_assets').insert({ ...f, asset_tag: f.asset_tag.trim(), name: f.name.trim(), purchased_on: f.purchased_on || null });
    setBusy(false);
    if (error) return toast(error.message.includes('duplicate') ? 'That asset tag is already used' : error.message, 'error');
    toast('Asset added');
    onAdded();
  };
  return (
    <Modal open onClose={onClose} title="Add an asset">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Asset tag" required hint="A unique label, e.g. EGR-LAP-001">
            <TextInput value={f.asset_tag} onChange={set('asset_tag')} autoFocus />
          </Field>
          <Field label="Name" required>
            <TextInput value={f.name} onChange={set('name')} placeholder="e.g. Dell laptop" />
          </Field>
          <Field label="Category">
            <TextInput value={f.category} onChange={set('category')} placeholder="Laptop, Drone, Tool…" />
          </Field>
          <Field label="Serial number">
            <TextInput value={f.serial_no} onChange={set('serial_no')} />
          </Field>
          <Field label="Purchased on">
            <TextInput type="date" value={f.purchased_on} onChange={set('purchased_on')} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Add asset
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AssignAsset({ asset, byId, onClose, onDone }: { asset: AssetRow; byId?: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [emp, setEmp] = useState('');
  const [cond, setCond] = useState('');
  const [busy, setBusy] = useState(false);
  const people = useQuery(() => unwrap(supabase.from('hr_employees').select('id, full_name, employee_code').neq('status', 'exited').order('full_name')) as Promise<{ id: string; full_name: string; employee_code: string | null }[]>, []);
  const save = async () => {
    if (!emp) return toast('Choose who gets it', 'error');
    setBusy(true);
    const { error } = await supabase.from('hr_asset_assignments').insert({ asset_id: asset.id, employee_id: emp, condition_out: cond.trim(), assigned_by: byId });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Assigned');
    onDone();
  };
  return (
    <Modal open onClose={onClose} title={`Assign ${asset.name}`}>
      <div className="space-y-4">
        <Field label="Employee">
          <Select value={emp} onChange={(e) => setEmp(e.target.value)}>
            <option value="">Choose…</option>
            {(people.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.employee_code})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Condition when handed over" hint="Optional, e.g. new, minor scratch on the lid">
          <TextInput value={cond} onChange={(e) => setCond(e.target.value)} maxLength={500} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Assign
          </Button>
        </div>
      </div>
    </Modal>
  );
}
