import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { invokeFn } from '../../lib/functions';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, PageHeader, Spinner, useToast } from '../../components/ui/kit';
import { ClipboardCheck } from 'lucide-react';
import type { Tables } from '../../lib/database.types';

type Profile = Tables<'profiles'>;

export function Approvals() {
  const toast = useToast();
  const q = useQuery<Profile[]>(
    () =>
      unwrap(
        supabase
          .from('profiles')
          .select('*')
          .in('status', ['pending', 'suspended'])
          .order('created_at', { ascending: true }),
      ) as Promise<Profile[]>,
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
                {p.status !== 'active' && <Button onClick={() => setStatus(p, 'active')}>Activate</Button>}
                {p.status === 'pending' && (
                  <Button variant="ghost" onClick={() => setStatus(p, 'suspended')}>
                    Reject
                  </Button>
                )}
                {p.status === 'suspended' && (
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
