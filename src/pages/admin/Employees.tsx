import { useState } from 'react';
import { Briefcase, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { invokeFn } from '../../lib/functions';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';

interface Employee {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: 'super_admin' | 'admin' | 'instructor' | 'student';
  status: 'pending' | 'active' | 'suspended';
  staff_details: { department: string; designation: string; joined_on: string | null; employee_code: string | null } | null;
}

export function Employees() {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const q = useQuery<Employee[]>(
    () =>
      unwrap(
        supabase
          .from('profiles')
          .select('id, full_name, email, phone, role, status, staff_details(department, designation, joined_on, employee_code)')
          .in('role', ['super_admin', 'admin', 'instructor'])
          .order('created_at'),
      ) as Promise<Employee[]>,
    [],
  );

  const setRole = async (e: Employee, role: Employee['role']) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', e.id);
    if (error) return toast(error.message, 'error');
    toast('Role updated');
    q.refetch();
  };
  const setStatus = async (e: Employee, status: Employee['status']) => {
    const { error } = await supabase.from('profiles').update({ status }).eq('id', e.id);
    if (error) return toast(error.message, 'error');
    q.refetch();
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Instructors and administrators"
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} /> Add employee
          </Button>
        }
      />

      {q.loading ? (
        <Spinner />
      ) : !q.data?.length ? (
        <EmptyState icon={<Briefcase size={22} />} title="No staff yet" action={<Button onClick={() => setAdding(true)}>Add employee</Button>} />
      ) : (
        <GlassCard className="overflow-x-auto p-2">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {q.data.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditing(e)} className="text-left font-medium text-neutral-900 hover:text-blue-600">
                      {e.full_name || '—'}
                    </button>
                    <div className="text-xs text-neutral-500">{e.email}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{e.staff_details?.department || '—'}</td>
                  <td className="px-4 py-3 text-neutral-600">{e.staff_details?.designation || '—'}</td>
                  <td className="px-4 py-3 text-neutral-500">
                    {e.staff_details?.joined_on ? new Date(e.staff_details.joined_on).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Select value={e.role} onChange={(ev) => setRole(e, ev.target.value as Employee['role'])} className="w-36 py-1.5">
                      <option value="super_admin">super_admin</option>
                      <option value="admin">admin</option>
                      <option value="instructor">instructor</option>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setStatus(e, e.status === 'active' ? 'suspended' : 'active')}>
                      <Badge tone={e.status === 'active' ? 'green' : 'red'}>{e.status}</Badge>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      <AddEmployee open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); q.refetch(); }} />
      {editing && (
        <EditEmployee employee={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); q.refetch(); }} />
      )}
    </div>
  );
}

function AddEmployee({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ email: '', full_name: '', role: 'instructor', department: '', designation: '', joined_on: '' });
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLink(null);
    try {
      const res = await invokeFn<{ user_id: string; email_sent: boolean; invite_link: string | null }>('admin-create-user', form);
      if (res.email_sent) toast('Employee created — invite email sent');
      else {
        toast('Employee created — email not configured, share the link');
        setLink(res.invite_link);
      }
      if (res.email_sent) onDone();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add employee" wide>
      {link ? (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">Send this set-password link to the new employee:</p>
          <TextInput readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex justify-end">
            <Button onClick={onDone}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Email" required>
              <TextInput type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
          </div>
          <Field label="Full name">
            <TextInput value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="super_admin">super_admin</option>
              <option value="admin">admin</option>
              <option value="instructor">instructor</option>
            </Select>
          </Field>
          <Field label="Department">
            <TextInput value={form.department} onChange={(e) => set('department', e.target.value)} />
          </Field>
          <Field label="Designation">
            <TextInput value={form.designation} onChange={(e) => set('designation', e.target.value)} />
          </Field>
          <Field label="Joined on">
            <TextInput type="date" value={form.joined_on} onChange={(e) => set('joined_on', e.target.value)} />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={busy}>Create &amp; invite</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function EditEmployee({ employee, onClose, onDone }: { employee: Employee; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [d, setD] = useState({
    department: employee.staff_details?.department ?? '',
    designation: employee.staff_details?.designation ?? '',
    joined_on: employee.staff_details?.joined_on ?? '',
    employee_code: employee.staff_details?.employee_code ?? '',
    phone: employee.phone ?? '',
  });
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const a = await supabase
      .from('staff_details')
      .upsert(
        { profile_id: employee.id, department: d.department, designation: d.designation, joined_on: d.joined_on || null, employee_code: d.employee_code || null },
        { onConflict: 'profile_id' },
      );
    const b = await supabase.from('profiles').update({ phone: d.phone }).eq('id', employee.id);
    setBusy(false);
    if (a.error || b.error) return toast((a.error ?? b.error)!.message, 'error');
    toast('Saved');
    onDone();
  };

  return (
    <Modal open onClose={onClose} title={employee.full_name || employee.email} wide>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Employee code">
          <TextInput value={d.employee_code} onChange={(e) => setD({ ...d, employee_code: e.target.value })} />
        </Field>
        <Field label="Phone">
          <TextInput value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
        </Field>
        <Field label="Department">
          <TextInput value={d.department} onChange={(e) => setD({ ...d, department: e.target.value })} />
        </Field>
        <Field label="Designation">
          <TextInput value={d.designation} onChange={(e) => setD({ ...d, designation: e.target.value })} />
        </Field>
        <Field label="Joined on">
          <TextInput type="date" value={d.joined_on ?? ''} onChange={(e) => setD({ ...d, joined_on: e.target.value })} />
        </Field>
        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
