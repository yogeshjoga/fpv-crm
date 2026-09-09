import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';
import type { Tables } from '../../lib/database.types';

type Profile = Tables<'profiles'>;
const ROLES = ['student', 'instructor', 'super_admin'] as const;
const STATUSES = ['pending', 'active', 'suspended'] as const;

export function Users() {
  const { profile: me } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useQuery<Profile[]>(
    () => unwrap(supabase.from('profiles').select('*').order('created_at', { ascending: false })) as Promise<Profile[]>,
    [],
  );

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return (q.data ?? []).filter((p) => p.full_name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s));
  }, [q.data, search]);

  const update = async (id: string, patch: Partial<Profile>) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    if (error) return toast(error.message, 'error');
    toast('Updated');
    q.refetch();
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage roles and account status"
        actions={<TextInput placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />}
      />
      {q.loading ? (
        <Spinner />
      ) : (
        <GlassCard className="overflow-x-auto p-2">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {rows.map((p) => {
                const isSelf = p.id === me?.id;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-neutral-900">{p.full_name || '—'}</td>
                    <td className="px-4 py-3 text-neutral-500">{p.email}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={p.role}
                        disabled={isSelf}
                        onChange={(e) => update(p.id, { role: e.target.value as Profile['role'] })}
                        className="w-40 py-1.5"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <Badge tone="blue">{p.status}</Badge>
                      ) : (
                        <Select
                          value={p.status}
                          onChange={(e) => update(p.id, { status: e.target.value as Profile['status'] })}
                          className="w-36 py-1.5"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </GlassCard>
      )}
    </div>
  );
}
