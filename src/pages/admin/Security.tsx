import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, EmptyState, PageHeader, Select, Spinner } from '../../components/ui/kit';
import { MfaSetup } from '../../components/MfaSetup';

interface AuditRow {
  id: number;
  at: string;
  actor: string | null;
  actor_role: string | null;
  action: string;
  table_name: string;
  row_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

const TABLE_LABEL: Record<string, string> = {
  profiles: 'User account',
  role_module_access: 'Access matrix',
  org_settings: 'Company settings',
  staff_details: 'Staff details',
  certificates: 'Certificate',
};
const ACTION_TONE = { INSERT: 'green', UPDATE: 'blue', DELETE: 'red' } as const;

const show = (v: Record<string, unknown> | null) =>
  v
    ? Object.entries(v)
        .map(([k, x]) => `${k}: ${typeof x === 'string' ? x : JSON.stringify(x)}`)
        .join(', ')
    : '';

/** Security for every staff member (two-step verification) and, for a super admin, the log of privileged changes. */
export function Security() {
  const { isSuperAdmin } = useAuth();
  const [table, setTable] = useState('all');

  const log = useQuery(async () => {
    if (!isSuperAdmin) return { rows: [] as AuditRow[], names: {} as Record<string, string> };
    const rows = (await unwrap(supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(300))) as unknown as AuditRow[];
    const ids = [...new Set(rows.flatMap((r) => [r.actor, r.table_name === 'profiles' ? r.row_id : null]).filter((x): x is string => !!x))];
    const names: Record<string, string> = {};
    if (ids.length) {
      const people = (await unwrap(supabase.from('profiles').select('id, full_name, email').in('id', ids))) as { id: string; full_name: string; email: string }[];
      for (const p of people) names[p.id] = p.full_name || p.email;
    }
    return { rows, names };
  }, [isSuperAdmin]);

  const rows = useMemo(() => (log.data?.rows ?? []).filter((r) => table === 'all' || r.table_name === table), [log.data, table]);
  const names = log.data?.names ?? {};

  return (
    <div className="space-y-6">
      <PageHeader title="Security" subtitle="Protect your account, and review privileged changes made in the system" />
      <MfaSetup />

      {isSuperAdmin && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
              <ScrollText size={16} /> Audit log
            </h2>
            <Select value={table} onChange={(e) => setTable(e.target.value)} className="!w-auto text-sm">
              <option value="all">Everything</option>
              {Object.entries(TABLE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          {log.loading && !log.data ? (
            <Spinner />
          ) : !rows.length ? (
            <EmptyState title="Nothing logged yet" description="Role changes, suspensions, access changes, company settings and certificate revocations appear here. The log cannot be edited or deleted." />
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <GlassCard key={r.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge tone={ACTION_TONE[r.action as keyof typeof ACTION_TONE] ?? 'neutral'}>{r.action}</Badge>
                      <span className="font-medium text-neutral-900">{TABLE_LABEL[r.table_name] ?? r.table_name}</span>
                      {r.table_name === 'profiles' && r.row_id && <span className="text-neutral-600">{names[r.row_id] ?? r.row_id}</span>}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {new Date(r.at).toLocaleString()} · by {r.actor ? names[r.actor] ?? r.actor_role ?? 'staff' : 'the system'}
                    </div>
                  </div>
                  {(r.old_data || r.new_data) && (
                    <div className="mt-2 grid gap-1 text-xs text-neutral-600 sm:grid-cols-2">
                      {r.old_data && <div className="break-words rounded-lg bg-red-50/70 px-2 py-1">Before: {show(r.old_data)}</div>}
                      {r.new_data && <div className="break-words rounded-lg bg-green-50/70 px-2 py-1">After: {show(r.new_data)}</div>}
                    </div>
                  )}
                </GlassCard>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
