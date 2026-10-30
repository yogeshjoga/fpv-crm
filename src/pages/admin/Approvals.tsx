import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { invokeFn } from '../../lib/functions';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, PageHeader, Spinner, useToast } from '../../components/ui/kit';
import { ClipboardCheck } from 'lucide-react';
import type { Tables } from '../../lib/database.types';

type Profile = Tables<'profiles'>;

export function Approvals() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('approvals');
  const q = useQuery<Profile[]>(
    () =>
      // website members (they signed in on the public site) stay pending on purpose. Only PAID members are listed here: they are the
      // ones an admin can accept for CRM access. Unpaid members are managed in the Members section.
      (unwrap(
        supabase
          .from('profiles')
          .select('*')
          .in('status', ['pending', 'suspended'])
          .order('created_at', { ascending: true }),
      ) as Promise<Profile[]>).then((rows) => rows.filter((r) => { const m = r as { account_kind?: string; is_paid?: boolean }; return m.account_kind !== 'member' || m.is_paid === true; })),
    [],
  );

  const setStatus = async (p: Profile, status: 'active' | 'suspended') => {
    const { error } = await supabase.from('profiles').update({ status }).eq('id', p.id);
    if (error) return toast(error.message, 'error');
    if (status === 'active') {
      invokeFn('notify', { kind: 'account_activated', user_id: p.id }).catch(() => {});
    }
    toast(status === 'active' ? `${p.full_name || p.email} activated` : `${p.full_name || p.email} suspended`);
    q.refetch();
  };

  return (
    <div>
      <PageHeader title="Account approvals" subtitle="Activate new sign-ups before they can enroll" />
      {q.loading ? (
        <Spinner />
      ) : !q.data?.length ? (
        <EmptyState icon={<ClipboardCheck size={22} />} title="Nothing to approve" description="New registrations will appear here." />
      ) : (
        <GlassCard className="divide-y divide-white/50 p-2">
          {q.data.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-medium text-neutral-900">{p.full_name || '—'}</div>
                <div className="text-sm text-neutral-500">{p.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={p.status === 'pending' ? 'amber' : 'red'}>{p.status}</Badge>
                {!writable && <span className="text-xs text-neutral-400">read-only</span>}
                {writable && p.status !== 'active' && <Button onClick={() => setStatus(p, 'active')}>Activate</Button>}
                {writable && p.status === 'pending' && (
                  <Button variant="ghost" onClick={() => setStatus(p, 'suspended')}>
                    Reject
                  </Button>
                )}
                {writable && p.status === 'suspended' && (
                  <Button variant="ghost" onClick={() => setStatus(p, 'active')}>
                    Reinstate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}
