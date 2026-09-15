import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, PageHeader, Spinner, TextInput, useToast } from '../../components/ui/kit';

interface Cert {
  id: string;
  cert_id_string: string;
  score_pct: number;
  issued_at: string;
  revoked: boolean;
  revoked_reason: string | null;
  student: { full_name: string; email: string } | null;
  course: { title: string } | null;
}

export function AdminCertificates() {
  const { canWrite } = useAdminAccess();
  const writable = canWrite('certificates');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useQuery<Cert[]>(
    () =>
      unwrap(
        supabase
          .from('certificates')
          .select('id, cert_id_string, score_pct, issued_at, revoked, revoked_reason, student:profiles!certificates_student_id_fkey(full_name, email), course:courses(title)')
          .order('issued_at', { ascending: false }),
      ) as Promise<Cert[]>,
    [],
  );

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return (q.data ?? []).filter(
      (c) =>
        c.cert_id_string.toLowerCase().includes(s) ||
        c.student?.full_name.toLowerCase().includes(s) ||
        c.student?.email.toLowerCase().includes(s),
    );
  }, [q.data, search]);

  const toggleRevoke = async (c: Cert) => {
    const revoked = !c.revoked;
    let reason: string | null = null;
    if (revoked) {
      reason = prompt('Reason for revoking this certificate?') || 'Revoked by administrator';
    }
    const { error } = await supabase.from('certificates').update({ revoked, revoked_reason: reason }).eq('id', c.id);
    if (error) return toast(error.message, 'error');
    toast(revoked ? 'Certificate revoked' : 'Certificate reinstated');
    q.refetch();
  };

  return (
    <div>
      <PageHeader
        title="Certificates"
        subtitle="All issued certificates"
        actions={<TextInput placeholder="Search ID or student…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />}
      />
      {q.loading ? (
        <Spinner />
      ) : !rows.length ? (
        <EmptyState icon={<ScrollText size={22} />} title="No certificates issued yet" />
      ) : (
        <GlassCard className="overflow-x-auto p-2">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3">Certificate ID</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Status</th>
                {writable && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono text-neutral-800">{c.cert_id_string}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{c.student?.full_name}</div>
                    <div className="text-xs text-neutral-500">{c.student?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{c.course?.title}</td>
                  <td className="px-4 py-3">{Number(c.score_pct)}%</td>
                  <td className="px-4 py-3 text-neutral-500">{new Date(c.issued_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {c.revoked ? <Badge tone="red">revoked</Badge> : <Badge tone="green">valid</Badge>}
                  </td>
                  {writable && (
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" onClick={() => toggleRevoke(c)}>
                        {c.revoked ? 'Reinstate' : 'Revoke'}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}
    </div>
  );
}
