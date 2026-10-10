import { Laptop, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { useQuery, unwrap } from '../lib/useQuery';
import { GlassCard } from './ui/shared';
import { Button, useToast } from './ui/kit';

interface Device {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** The computers that skip the two-step code. Remove one and it asks for the code again at its next sign-in. */
export function TrustedDevices() {
  const toast = useToast();
  const { mfa, signOut } = useAuth();
  const q = useQuery(() => unwrap(supabase.from('trusted_devices').select('id, label, created_at, last_used_at, expires_at').order('last_used_at', { ascending: false })) as Promise<Device[]>, []);
  if (!mfa.enrolled && !(q.data?.length ?? 0)) return null;

  const remove = async (id: string | null) => {
    if (!confirm(id ? 'Remove this device? It will ask for the code at its next sign-in.' : 'Remove every trusted device? All of them will ask for the code again.')) return;
    const { error } = await supabase.rpc('revoke_trusted_device', id ? { p_id: id } : {});
    if (error) return toast(error.message, 'error');
    toast(id ? 'Device removed' : 'All devices removed');
    q.refetch();
    // this session may have been one of them: sign out so it signs back in the strict way
    if (!id) void signOut();
  };

  return (
    <GlassCard className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-neutral-900">Trusted devices</div>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            A computer you tick &ldquo;Don&rsquo;t ask again on this device&rdquo; for signs in with your password alone for 30 days of use. Any other computer still asks for the code. Remove a computer you no longer use or have lost.
          </p>
        </div>
        {!!q.data?.length && (
          <Button variant="secondary" onClick={() => remove(null)}>
            Remove all
          </Button>
        )}
      </div>
      {!q.data?.length ? (
        <p className="mt-4 text-sm text-neutral-500">No trusted devices. Every sign-in asks for the code.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {q.data.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/60 px-4 py-3 text-sm">
              <span className="flex items-center gap-3">
                <Laptop size={18} className="text-neutral-400" />
                <span>
                  <span className="font-medium text-neutral-900">{d.label || 'Browser'}</span>
                  <span className="block text-xs text-neutral-500">
                    Trusted {day(d.created_at)} · last used {day(d.last_used_at)} · stays trusted until {day(d.expires_at)} if unused
                  </span>
                </span>
              </span>
              <button onClick={() => remove(d.id)} className="text-neutral-300 hover:text-red-500" aria-label="Remove this device">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
