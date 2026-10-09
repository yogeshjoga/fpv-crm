import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { downloadCsv } from '../../lib/csv';
import { GlassCard } from '../../components/ui/shared';
import { Button, EmptyState, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';
import { CareersNav } from '../../components/CareersNav';

type AttStatus = 'present' | 'absent' | 'half_day' | 'leave' | 'wfh';
const STATUS_LABEL: Record<AttStatus, string> = { present: 'Present', absent: 'Absent', half_day: 'Half day', leave: 'Leave', wfh: 'Work from home' };

interface Emp {
  id: string;
  full_name: string;
  employee_code: string | null;
  designation: string;
  status: string;
}
interface Mark {
  status: AttStatus | '';
  check_in: string;
  check_out: string;
  note: string;
}
const blank: Mark = { status: '', check_in: '', check_out: '', note: '' };
const today = () => new Date().toISOString().slice(0, 10);

/** Attendance: mark a day for everyone, and see the month at a glance. */
export function HrAttendance() {
  const [view, setView] = useState<'day' | 'month'>('day');
  const emps = useQuery(() => unwrap(supabase.from('hr_employees').select('id, full_name, employee_code, designation, status').neq('status', 'exited').order('full_name')) as Promise<Emp[]>, []);

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Mark who is in each day, and review the month" />
      <CareersNav />
      <div className="mb-4 inline-flex rounded-full border border-white/60 bg-white/50 p-1 text-sm">
        {(['day', 'month'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`rounded-full px-4 py-1.5 font-medium ${view === v ? 'bg-[#1a1a1a] text-white' : 'text-neutral-600 hover:text-neutral-900'}`}>
            {v === 'day' ? 'Daily sheet' : 'Monthly report'}
          </button>
        ))}
      </div>
      {emps.loading && !emps.data ? (
        <Spinner />
      ) : !emps.data?.length ? (
        <EmptyState icon={<CalendarCheck size={22} />} title="No employees yet" description="Add or hire someone first. Everyone who has not left appears here." />
      ) : view === 'day' ? (
        <DaySheet emps={emps.data} />
      ) : (
        <MonthReport emps={emps.data} />
      )}
    </div>
  );
}

function DaySheet({ emps }: { emps: Emp[] }) {
  const toast = useToast();
  const { profile } = useAuth();
  const { canWrite } = useAdminAccess();
  const ro = !canWrite('careers');
  const [day, setDay] = useState(today());
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [busy, setBusy] = useState(false);

  const saved = useQuery(
    () => unwrap(supabase.from('hr_attendance').select('employee_id, status, check_in, check_out, note').eq('day', day)) as Promise<{ employee_id: string; status: AttStatus; check_in: string | null; check_out: string | null; note: string }[]>,
    [day],
  );
  useEffect(() => {
    if (!saved.data) return;
    const m: Record<string, Mark> = {};
    for (const r of saved.data) m[r.employee_id] = { status: r.status, check_in: (r.check_in ?? '').slice(0, 5), check_out: (r.check_out ?? '').slice(0, 5), note: r.note };
    setMarks(m);
  }, [saved.data]);

  const get = (id: string) => marks[id] ?? blank;
  const patch = (id: string, p: Partial<Mark>) => setMarks((m) => ({ ...m, [id]: { ...get(id), ...p } }));
  const marked = emps.filter((e) => get(e.id).status).length;

  const allPresent = () =>
    setMarks((m) => {
      const next = { ...m };
      for (const e of emps) if (!next[e.id]?.status) next[e.id] = { ...(next[e.id] ?? blank), status: 'present' };
      return next;
    });

  const save = async () => {
    const rows = emps
      .filter((e) => get(e.id).status)
      .map((e) => {
        const m = get(e.id);
        return { employee_id: e.id, day, status: m.status as AttStatus, check_in: m.check_in || null, check_out: m.check_out || null, note: m.note.trim(), marked_by: profile?.id };
      });
    if (!rows.length) return toast('Mark at least one person', 'error');
    setBusy(true);
    const { error } = await supabase.from('hr_attendance').upsert(rows, { onConflict: 'employee_id,day' });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast(`Saved ${rows.length} record${rows.length === 1 ? '' : 's'} for ${day}`);
    void saved.refetch();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <TextInput type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value || today())} className="!w-auto" />
        <span className="text-sm text-neutral-500">
          {marked} of {emps.length} marked
        </span>
        {!ro && (
          <>
            <Button variant="secondary" onClick={allPresent}>
              Mark everyone else present
            </Button>
            <Button onClick={save} loading={busy}>
              Save attendance
            </Button>
          </>
        )}
      </div>
      <div className="space-y-2">
        {emps.map((e) => {
          const m = get(e.id);
          return (
            <GlassCard key={e.id} className="p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-52 min-w-0">
                  <div className="truncate text-sm font-medium text-neutral-900">{e.full_name}</div>
                  <div className="truncate text-xs text-neutral-500">
                    {e.employee_code}
                    {e.designation ? ` · ${e.designation}` : ''}
                  </div>
                </div>
                <Select disabled={ro} value={m.status} onChange={(ev) => patch(e.id, { status: ev.target.value as AttStatus | '' })} className="!w-44 !py-2 text-sm">
                  <option value="">Not marked</option>
                  {(Object.keys(STATUS_LABEL) as AttStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
                <TextInput disabled={ro || !m.status} type="time" value={m.check_in} onChange={(ev) => patch(e.id, { check_in: ev.target.value })} className="!w-32 !py-2 text-sm" aria-label="In time" />
                <TextInput disabled={ro || !m.status} type="time" value={m.check_out} onChange={(ev) => patch(e.id, { check_out: ev.target.value })} className="!w-32 !py-2 text-sm" aria-label="Out time" />
                <TextInput disabled={ro || !m.status} value={m.note} onChange={(ev) => patch(e.id, { note: ev.target.value })} placeholder="Note" maxLength={300} className="!w-56 !py-2 text-sm" />
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

function MonthReport({ emps }: { emps: Emp[] }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const last = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [month]);
  const q = useQuery(
    () => unwrap(supabase.from('hr_attendance').select('employee_id, status').gte('day', `${month}-01`).lte('day', `${month}-${String(last).padStart(2, '0')}`)) as Promise<{ employee_id: string; status: AttStatus }[]>,
    [month, last],
  );

  const table = emps.map((e) => {
    const c: Record<AttStatus, number> = { present: 0, wfh: 0, half_day: 0, leave: 0, absent: 0 };
    for (const r of q.data ?? []) if (r.employee_id === e.id) c[r.status] += 1;
    const worked = c.present + c.wfh + c.half_day * 0.5;
    return { e, c, worked };
  });

  const exportCsv = () =>
    downloadCsv(
      `attendance-${month}.csv`,
      ['Employee', 'Code', 'Present', 'Work from home', 'Half day', 'Leave', 'Absent', 'Days worked'],
      table.map(({ e, c, worked }) => [e.full_name, e.employee_code ?? '', c.present, c.wfh, c.half_day, c.leave, c.absent, worked]),
    );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value || today().slice(0, 7))} className="!w-auto" />
        <Button variant="secondary" onClick={exportCsv}>
          <Download size={15} /> Export CSV
        </Button>
      </div>
      <GlassCard className="overflow-x-auto p-2">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-3 py-2">Employee</th>
              {(Object.keys(STATUS_LABEL) as AttStatus[]).map((s) => (
                <th key={s} className="px-3 py-2 text-center">
                  {STATUS_LABEL[s]}
                </th>
              ))}
              <th className="px-3 py-2 text-center">Days worked</th>
            </tr>
          </thead>
          <tbody>
            {table.map(({ e, c, worked }) => (
              <tr key={e.id} className="border-t border-white/60">
                <td className="px-3 py-2">
                  <div className="font-medium text-neutral-900">{e.full_name}</div>
                  <div className="text-xs text-neutral-500">{e.employee_code}</div>
                </td>
                {(Object.keys(STATUS_LABEL) as AttStatus[]).map((s) => (
                  <td key={s} className="px-3 py-2 text-center text-neutral-700">
                    {c[s] || '·'}
                  </td>
                ))}
                <td className="px-3 py-2 text-center font-semibold text-neutral-900">{worked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
