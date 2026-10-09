import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, IdCard, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import type { Tables } from '../../lib/database.types';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';
import { CareersNav } from '../../components/CareersNav';
import { EMPLOYMENT_LABEL, fmtDate, type EmploymentType } from '../../lib/offers';
import { downloadEmployeeIdCard } from '../../lib/employeeIdPdf';
import { fetchOrgBrand } from '../../lib/useOrgBrand';

type Employee = Tables<'hr_employees'>;
type Task = Tables<'hr_onboarding_tasks'>;
type EmpRow = Employee & { hr_onboarding_tasks: { done: boolean }[] };

const STATUS_LABEL = { onboarding: 'Onboarding', active: 'Active', exited: 'Left' } as const;
const STATUS_TONE = { onboarding: 'amber', active: 'green', exited: 'neutral' } as const;
type Status = keyof typeof STATUS_LABEL;

/** Employees: hired people from onboarding to their last day. Hiring a candidate in Careers starts a record here. */
export function HrEmployees() {
  const { canWrite } = useAdminAccess();
  const ro = !canWrite('careers');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const q = useQuery(() => unwrap(supabase.from('hr_employees').select('*, hr_onboarding_tasks(done)').order('created_at', { ascending: false })) as unknown as Promise<EmpRow[]>, []);
  const all = q.data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length, onboarding: 0, active: 0, exited: 0 };
    for (const e of all) c[e.status] += 1;
    return c;
  }, [all]);
  const rows = all.filter((e) => (status === 'all' || e.status === status) && (!search.trim() || `${e.full_name} ${e.employee_code} ${e.email} ${e.designation}`.toLowerCase().includes(search.trim().toLowerCase())));
  const open = all.find((e) => e.id === openId) ?? null;

  if (q.loading && !q.data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Hired people: onboarding checklist, ID card, assets and attendance. Marking a candidate hired starts their record here"
        actions={
          !ro && (
            <Button onClick={() => setAdding(true)}>
              <UserPlus size={16} /> Add employee
            </Button>
          )
        }
      />
      <CareersNav />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <TextInput className="!pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find an employee…" />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {(['all', 'onboarding', 'active', 'exited'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3.5 py-1.5 font-medium ${status === s ? 'bg-[#1a1a1a] text-white' : 'bg-white/70 text-neutral-600 hover:bg-white'}`}
            >
              {s === 'all' ? 'Everyone' : STATUS_LABEL[s]} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      {!rows.length ? (
        <EmptyState icon={<UserPlus size={22} />} title="No employees yet" description="When you mark a candidate as hired in Careers, their onboarding record appears here. You can also add someone by hand." />
      ) : (
        <div className="space-y-3">
          {rows.map((e) => {
            const done = e.hr_onboarding_tasks.filter((t) => t.done).length;
            return (
              <GlassCard key={e.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button className="min-w-0 text-left" onClick={() => setOpenId(e.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-neutral-900">{e.full_name}</span>
                      <Badge tone={STATUS_TONE[e.status as Status]}>{STATUS_LABEL[e.status as Status]}</Badge>
                      {e.id_card_issued_at && <Badge tone="blue">ID issued</Badge>}
                    </div>
                    <div className="mt-0.5 text-sm text-neutral-600">
                      {e.designation || 'No designation'}
                      {e.department ? ` · ${e.department}` : ''} · {EMPLOYMENT_LABEL[e.employment_type as EmploymentType]}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {e.employee_code}
                      {e.joined_on ? ` · joined ${fmtDate(e.joined_on)}` : ''}
                      {e.status === 'onboarding' ? ` · ${done}/${e.hr_onboarding_tasks.length} onboarding steps done` : ''}
                    </div>
                  </button>
                  <Button variant="secondary" onClick={() => setOpenId(e.id)}>
                    Open
                  </Button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {open && <EmployeeDetail key={open.id} employee={open} ro={ro} onClose={() => setOpenId(null)} onChanged={() => q.refetch()} />}
      {adding && !ro && <AddEmployee onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); q.refetch(); setOpenId(id); }} />}
    </div>
  );
}

function AddEmployee({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const toast = useToast();
  const { profile } = useAuth();
  const [f, setF] = useState({ full_name: '', email: '', phone: '', designation: '', department: '', employment_type: 'full_time' as EmploymentType, joined_on: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (f.full_name.trim().length < 2) return toast("Enter the person's name", 'error');
    setBusy(true);
    // link to their login account when the email matches one
    let profile_id: string | null = null;
    if (f.email.trim()) {
      const { data } = await supabase.from('profiles').select('id').ilike('email', f.email.trim()).maybeSingle();
      profile_id = data?.id ?? null;
    }
    const { data, error } = await supabase
      .from('hr_employees')
      .insert({ ...f, full_name: f.full_name.trim(), email: f.email.trim(), profile_id, created_by: profile?.id })
      .select('id')
      .single();
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Employee added');
    onAdded(data.id);
  };

  return (
    <Modal open onClose={onClose} title="Add an employee">
      <div className="space-y-4">
        <Field label="Full name" required>
          <TextInput value={f.full_name} onChange={set('full_name')} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <TextInput type="email" value={f.email} onChange={set('email')} />
          </Field>
          <Field label="Phone">
            <TextInput value={f.phone} onChange={set('phone')} />
          </Field>
          <Field label="Designation">
            <TextInput value={f.designation} onChange={set('designation')} />
          </Field>
          <Field label="Department">
            <TextInput value={f.department} onChange={set('department')} />
          </Field>
          <Field label="Engagement">
            <Select value={f.employment_type} onChange={set('employment_type')}>
              {(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map((k) => (
                <option key={k} value={k}>
                  {EMPLOYMENT_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Joining date">
            <TextInput type="date" value={f.joined_on} onChange={set('joined_on')} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            <Plus size={15} /> Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface AssignmentRow {
  id: string;
  assigned_on: string;
  returned_on: string | null;
  hr_assets: { asset_tag: string; name: string } | null;
}

function EmployeeDetail({ employee, ro, onClose, onChanged }: { employee: EmpRow; ro: boolean; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { profile } = useAuth();
  const [f, setF] = useState({
    full_name: employee.full_name,
    email: employee.email,
    phone: employee.phone,
    designation: employee.designation,
    department: employee.department,
    employment_type: employee.employment_type as EmploymentType,
    joined_on: employee.joined_on ?? '',
    notes: employee.notes,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [newTask, setNewTask] = useState('');
  const [assetId, setAssetId] = useState('');
  const month = new Date().toISOString().slice(0, 7);

  const tasks = useQuery(() => unwrap(supabase.from('hr_onboarding_tasks').select('*').eq('employee_id', employee.id).order('position').order('title')) as Promise<Task[]>, [employee.id]);
  const assigned = useQuery(
    () => unwrap(supabase.from('hr_asset_assignments').select('id, assigned_on, returned_on, hr_assets(asset_tag, name)').eq('employee_id', employee.id).order('assigned_on', { ascending: false })) as unknown as Promise<AssignmentRow[]>,
    [employee.id],
  );
  const free = useQuery(() => unwrap(supabase.from('hr_assets').select('id, asset_tag, name').eq('status', 'available').order('asset_tag')) as Promise<{ id: string; asset_tag: string; name: string }[]>, []);
  const att = useQuery(
    () => unwrap(supabase.from('hr_attendance').select('status').eq('employee_id', employee.id).gte('day', `${month}-01`).lte('day', `${month}-31`)) as Promise<{ status: string }[]>,
    [employee.id, month],
  );
  const attCounts = (att.data ?? []).reduce<Record<string, number>>((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});

  const refreshAll = () => {
    onChanged();
    void tasks.refetch();
    void assigned.refetch();
    void free.refetch();
  };

  const save = async () => {
    if (f.full_name.trim().length < 2) return toast('Enter a name', 'error');
    setBusy('save');
    const { error } = await supabase
      .from('hr_employees')
      .update({ ...f, full_name: f.full_name.trim(), joined_on: f.joined_on || null })
      .eq('id', employee.id);
    setBusy(null);
    if (error) return toast(error.message, 'error');
    toast('Saved');
    onChanged();
  };

  const toggle = async (t: Task) => {
    const { error } = await supabase
      .from('hr_onboarding_tasks')
      .update({ done: !t.done, done_at: t.done ? null : new Date().toISOString(), done_by: t.done ? null : profile?.id })
      .eq('id', t.id);
    if (error) return toast(error.message, 'error');
    void tasks.refetch();
    onChanged();
  };
  const addTask = async () => {
    if (newTask.trim().length < 2) return;
    const { error } = await supabase.from('hr_onboarding_tasks').insert({ employee_id: employee.id, title: newTask.trim(), position: (tasks.data?.length ?? 0) + 1 });
    if (error) return toast(error.message, 'error');
    setNewTask('');
    void tasks.refetch();
    onChanged();
  };
  const removeTask = async (t: Task) => {
    const { error } = await supabase.from('hr_onboarding_tasks').delete().eq('id', t.id);
    if (error) return toast(error.message, 'error');
    void tasks.refetch();
    onChanged();
  };

  const setStatus = async (status: Status) => {
    const open = (tasks.data ?? []).filter((t) => !t.done).length;
    if (status === 'active' && open && !window.confirm(`${open} onboarding step${open === 1 ? ' is' : 's are'} still open. Mark onboarding complete anyway?`)) return;
    if (status === 'exited' && !window.confirm(`Mark ${employee.full_name} as having left? Any assets they hold should be returned first.`)) return;
    setBusy('status');
    const { error } = await supabase
      .from('hr_employees')
      .update({ status, exited_on: status === 'exited' ? new Date().toISOString().slice(0, 10) : null })
      .eq('id', employee.id);
    setBusy(null);
    if (error) return toast(error.message, 'error');
    toast(status === 'active' ? 'Onboarding complete' : status === 'exited' ? 'Marked as left' : 'Updated');
    onChanged();
  };

  const idCard = async () => {
    setBusy('id');
    try {
      let photo: string | null = null;
      if (employee.profile_id) {
        const { data } = await supabase.from('profiles').select('avatar_url').eq('id', employee.profile_id).maybeSingle();
        photo = data?.avatar_url ?? null;
      }
      const org = await fetchOrgBrand();
      await downloadEmployeeIdCard(
        { fullName: f.full_name, code: employee.employee_code ?? '', designation: f.designation, department: f.department, joinedOn: f.joined_on || null, email: f.email, phone: f.phone, photoUrl: photo },
        org,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not make the ID card', 'error');
    } finally {
      setBusy(null);
    }
  };
  const markIssued = async () => {
    setBusy('issued');
    const { error } = await supabase.from('hr_employees').update({ id_card_issued_at: new Date().toISOString() }).eq('id', employee.id);
    if (!error) {
      const task = (tasks.data ?? []).find((t) => /issue employee id card/i.test(t.title) && !t.done);
      if (task) await supabase.from('hr_onboarding_tasks').update({ done: true, done_at: new Date().toISOString(), done_by: profile?.id }).eq('id', task.id);
    }
    setBusy(null);
    if (error) return toast(error.message, 'error');
    toast('ID card marked as issued');
    refreshAll();
  };

  const assign = async () => {
    if (!assetId) return;
    setBusy('assign');
    const { error } = await supabase.from('hr_asset_assignments').insert({ asset_id: assetId, employee_id: employee.id, assigned_by: profile?.id });
    setBusy(null);
    if (error) return toast(error.message, 'error');
    setAssetId('');
    toast('Asset assigned');
    refreshAll();
  };
  const giveBack = async (a: AssignmentRow) => {
    const note = window.prompt(`Condition of ${a.hr_assets?.name ?? 'the asset'} when returned (optional)`, '');
    if (note === null) return;
    const { error } = await supabase.from('hr_asset_assignments').update({ returned_on: new Date().toISOString().slice(0, 10), condition_in: note.trim() }).eq('id', a.id);
    if (error) return toast(error.message, 'error');
    toast('Asset returned');
    refreshAll();
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const dis = ro || employee.status === 'exited';
  const doneCount = (tasks.data ?? []).filter((t) => t.done).length;

  return (
    <Modal open onClose={onClose} title={`${employee.full_name} · ${employee.employee_code}`} wide>
      <div className="max-h-[72vh] space-y-6 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[employee.status as Status]}>{STATUS_LABEL[employee.status as Status]}</Badge>
          {employee.exited_on && <span className="text-xs text-neutral-500">Left on {fmtDate(employee.exited_on)}</span>}
          {!ro && employee.status === 'onboarding' && (
            <Button variant="secondary" onClick={() => setStatus('active')} loading={busy === 'status'}>
              <CheckCircle2 size={15} /> Complete onboarding
            </Button>
          )}
          {!ro && employee.status !== 'exited' && (
            <Button variant="ghost" className="text-red-600" onClick={() => setStatus('exited')} loading={busy === 'status'}>
              Mark as left
            </Button>
          )}
          {!ro && employee.status === 'exited' && (
            <Button variant="secondary" onClick={() => setStatus('active')} loading={busy === 'status'}>
              Reinstate
            </Button>
          )}
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <TextInput disabled={dis} value={f.full_name} onChange={set('full_name')} />
            </Field>
            <Field label="Email">
              <TextInput disabled={dis} value={f.email} onChange={set('email')} />
            </Field>
            <Field label="Phone">
              <TextInput disabled={dis} value={f.phone} onChange={set('phone')} />
            </Field>
            <Field label="Joining date">
              <TextInput type="date" disabled={dis} value={f.joined_on} onChange={set('joined_on')} />
            </Field>
            <Field label="Designation">
              <TextInput disabled={dis} value={f.designation} onChange={set('designation')} />
            </Field>
            <Field label="Department">
              <TextInput disabled={dis} value={f.department} onChange={set('department')} />
            </Field>
            <Field label="Engagement">
              <Select disabled={dis} value={f.employment_type} onChange={set('employment_type')}>
                {(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map((k) => (
                  <option key={k} value={k}>
                    {EMPLOYMENT_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Notes (private)">
              <TextArea rows={2} disabled={dis} value={f.notes} onChange={set('notes')} />
            </Field>
          </div>
          {!dis && (
            <div className="mt-2 flex justify-end">
              <Button variant="secondary" onClick={save} loading={busy === 'save'}>
                Save details
              </Button>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">
            Onboarding checklist <span className="font-normal text-neutral-500">({doneCount}/{tasks.data?.length ?? 0} done)</span>
          </h3>
          <ul className="space-y-1.5">
            {(tasks.data ?? []).map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-xl bg-white/50 px-3 py-2 text-sm">
                <button disabled={ro} onClick={() => toggle(t)} className="shrink-0 text-neutral-400 hover:text-green-600 disabled:pointer-events-none" aria-label={t.done ? 'Mark not done' : 'Mark done'}>
                  {t.done ? <CheckCircle2 size={18} className="text-green-600" /> : <Circle size={18} />}
                </button>
                <span className={`flex-1 ${t.done ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}>{t.title}</span>
                {t.done_at && <span className="text-[11px] text-neutral-400">{new Date(t.done_at).toLocaleDateString('en-GB')}</span>}
                {!ro && (
                  <button onClick={() => removeTask(t)} className="text-neutral-300 hover:text-red-500" aria-label="Remove step">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!ro && (
            <div className="mt-2 flex gap-2">
              <TextInput value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a step…" onKeyDown={(e) => e.key === 'Enter' && void addTask()} />
              <Button variant="secondary" onClick={addTask}>
                Add
              </Button>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">ID card</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={idCard} loading={busy === 'id'}>
              <IdCard size={15} /> Download ID card (PDF)
            </Button>
            {!ro && (
              <Button variant="secondary" onClick={markIssued} loading={busy === 'issued'} disabled={!!employee.id_card_issued_at}>
                {employee.id_card_issued_at ? `Issued ${new Date(employee.id_card_issued_at).toLocaleDateString('en-GB')}` : 'Mark as issued'}
              </Button>
            )}
            <span className="text-xs text-neutral-500">Uses the profile photo when the person has a login with one.</span>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Assets</h3>
          {!assigned.data?.length ? (
            <p className="text-sm text-neutral-500">Nothing assigned yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {assigned.data.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/50 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium text-neutral-900">{a.hr_assets?.name}</span> <span className="text-neutral-500">· {a.hr_assets?.asset_tag}</span>
                    <span className="ml-2 text-xs text-neutral-400">
                      {fmtDate(a.assigned_on)}
                      {a.returned_on ? ` to ${fmtDate(a.returned_on)}` : ''}
                    </span>
                  </span>
                  {a.returned_on ? <Badge>Returned</Badge> : !ro && <Button variant="secondary" onClick={() => giveBack(a)}>Return</Button>}
                </li>
              ))}
            </ul>
          )}
          {!ro && employee.status !== 'exited' && (
            <div className="mt-2 flex gap-2">
              <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                <option value="">Assign an available asset…</option>
                {(free.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_tag} · {a.name}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={assign} loading={busy === 'assign'} disabled={!assetId}>
                Assign
              </Button>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Attendance this month</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {[
              ['present', 'Present'],
              ['wfh', 'Work from home'],
              ['half_day', 'Half day'],
              ['leave', 'Leave'],
              ['absent', 'Absent'],
            ].map(([k, label]) => (
              <span key={k} className="rounded-full bg-white/60 px-3 py-1">
                {label}: <span className="font-semibold text-neutral-900">{attCounts[k] ?? 0}</span>
              </span>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}
