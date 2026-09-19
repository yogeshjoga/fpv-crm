import { useMemo, useState } from 'react';
import { IdCard as IdCardIcon, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { invokeFn } from '../../lib/functions';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';

interface Card {
  id: string;
  card_number: string;
  issued_at: string;
  valid_until: string | null;
  last_emailed_at: string | null;
  pdf_path: string;
  student: { id: string; full_name: string; email: string } | null;
  course: { title: string } | null;
}

interface StudentOption {
  id: string;
  full_name: string;
  email: string;
}

export function IdCards() {
  const { canWrite } = useAdminAccess();
  const writable = canWrite('id-cards');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const q = useQuery<{ cards: Card[]; studentsWithoutCard: StudentOption[] }>(async () => {
    const [cards, students] = await Promise.all([
      unwrap(
        supabase
          .from('id_cards')
          .select(
            'id, card_number, issued_at, valid_until, last_emailed_at, pdf_path, ' +
              'student:profiles!id_cards_student_id_fkey(id, full_name, email), course:courses(title)',
          )
          .order('issued_at', { ascending: false }),
      ) as Promise<Card[]>,
      unwrap(
        supabase.from('profiles').select('id, full_name, email').eq('role', 'student').eq('status', 'active').is('archived_at', null),
      ) as Promise<StudentOption[]>,
    ]);
    const cardedIds = new Set(cards.map((c) => c.student?.id).filter(Boolean));
    return { cards, studentsWithoutCard: students.filter((s) => !cardedIds.has(s.id)) };
  }, []);

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return (q.data?.cards ?? []).filter(
      (c) =>
        c.card_number.toLowerCase().includes(s) ||
        c.student?.full_name.toLowerCase().includes(s) ||
        c.student?.email.toLowerCase().includes(s),
    );
  }, [q.data, search]);

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from('id-cards').createSignedUrl(path, 120);
    if (error || !data) return toast('Could not open the ID card', 'error');
    window.open(data.signedUrl, '_blank');
  };

  const resend = async (c: Card) => {
    setResendingId(c.id);
    try {
      await invokeFn('resend-id-card', { id_card_id: c.id });
      toast(`Resent to ${c.student?.email}`);
      q.refetch();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setResendingId(null);
    }
  };

  const [showGenerate, setShowGenerate] = useState(false);
  const [genStudent, setGenStudent] = useState('');

  const generate = async () => {
    if (!genStudent) return;
    setGenerating(true);
    try {
      await invokeFn('generate-id-card', { student_id: genStudent, course_id: null });
      toast('ID card generated and emailed');
      setShowGenerate(false);
      setGenStudent('');
      q.refetch();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="ID Cards"
        subtitle="Every student ID card issued — generated automatically when a registration is accepted"
        actions={
          <div className="flex items-center gap-2">
            {writable && !!q.data?.studentsWithoutCard.length && (
              <Button variant="secondary" onClick={() => setShowGenerate(true)}>
                <IdCardIcon size={14} /> Generate for a student
              </Button>
            )}
            <TextInput placeholder="Search ID or student…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          </div>
        }
      />

      {q.loading ? (
        <Spinner />
      ) : !rows.length ? (
        <EmptyState
          icon={<IdCardIcon size={22} />}
          title="No ID cards yet"
          description="A card is issued and emailed automatically the moment a registration is accepted."
        />
      ) : (
        <GlassCard className="overflow-x-auto p-2">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3">Card ID</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Valid until</th>
                <th className="px-4 py-3">Last emailed</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono text-neutral-800">{c.card_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{c.student?.full_name}</div>
                    <div className="text-xs text-neutral-500">{c.student?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{c.course?.title ?? <Badge tone="neutral">General</Badge>}</td>
                  <td className="px-4 py-3 text-neutral-500">{new Date(c.issued_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-neutral-500">{c.valid_until ? new Date(c.valid_until).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-neutral-500">{c.last_emailed_at ? new Date(c.last_emailed_at).toLocaleDateString() : 'never'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => download(c.pdf_path)}>
                        Download
                      </Button>
                      {writable && (
                        <Button variant="ghost" onClick={() => resend(c)} loading={resendingId === c.id}>
                          <Send size={13} /> Resend
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate an ID card">
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">
            Only active students without a card yet are listed — every new registration already gets one automatically on acceptance.
          </p>
          <Select value={genStudent} onChange={(e) => setGenStudent(e.target.value)}>
            <option value="">Choose a student…</option>
            {q.data?.studentsWithoutCard.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} — {s.email}
              </option>
            ))}
          </Select>
          <div className="flex justify-end">
            <Button onClick={generate} loading={generating} disabled={!genStudent}>
              Generate &amp; email
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
