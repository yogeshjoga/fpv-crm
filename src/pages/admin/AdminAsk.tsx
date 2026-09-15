import { useMemo, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { invokeFn } from '../../lib/functions';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';

interface Thread {
  id: string;
  subject: string;
  status: string;
  updated_at: string;
  student: { full_name: string; email: string } | null;
}
interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

const toneFor = (status: string): 'green' | 'neutral' | 'amber' =>
  status === 'answered' ? 'green' : status === 'closed' ? 'neutral' : 'amber';

export function AdminAsk() {
  const { canWrite } = useAdminAccess();
  const writable = canWrite('ask');
  const [filter, setFilter] = useState<'open' | 'answered' | 'closed' | 'all'>('open');
  const [open, setOpen] = useState<Thread | null>(null);

  const q = useQuery(async () => {
    let sel = supabase
      .from('support_threads')
      .select('id, subject, status, updated_at, student:profiles!support_threads_student_id_fkey(full_name, email)')
      .order('updated_at', { ascending: false });
    if (filter !== 'all') sel = sel.eq('status', filter);
    return { threads: (await unwrap(sel)) as Thread[] };
  }, [filter]);

  if (q.loading) return <Spinner />;
  const threads = q.data?.threads ?? [];

  return (
    <div>
      <PageHeader
        title="Questions"
        subtitle="What students have asked, from any course or the build lab"
        actions={
          <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-36">
            <option value="open">Open</option>
            <option value="answered">Answered</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </Select>
        }
      />
      {!threads.length ? (
        <EmptyState icon={<MessageCircle size={22} />} title="Nothing here" description="No questions match this filter." />
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <button key={t.id} onClick={() => setOpen(t)} className="block w-full text-left">
              <GlassCard className="flex items-center justify-between gap-3 p-4 transition-transform hover:-translate-y-0.5">
                <div className="min-w-0">
                  <div className="truncate font-medium text-neutral-900">{t.subject}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {t.student?.full_name || t.student?.email} · {new Date(t.updated_at).toLocaleString()}
                  </div>
                </div>
                <Badge tone={toneFor(t.status)}>{t.status}</Badge>
              </GlassCard>
            </button>
          ))}
        </div>
      )}

      {open && (
        <ThreadModal
          thread={open}
          writable={writable}
          onClose={() => {
            setOpen(null);
            q.refetch();
          }}
        />
      )}
    </div>
  );
}

function ThreadModal({ thread, writable, onClose }: { thread: Thread; writable: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const q = useQuery(async () => {
    const messages = (await unwrap(
      supabase.from('support_messages').select('id, thread_id, sender_id, body, created_at').eq('thread_id', thread.id).order('created_at'),
    )) as Message[];
    return { messages };
  }, [thread.id]);

  const messages = useMemo(() => q.data?.messages ?? [], [q.data]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('support_messages').insert({ thread_id: thread.id, sender_id: profile!.id, body: reply.trim() });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    invokeFn('ask-notify', { thread_id: thread.id }).catch(() => {});
    setReply('');
    q.refetch();
  };

  const closeThread = async () => {
    await supabase.from('support_threads').update({ status: 'closed' }).eq('id', thread.id);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`${thread.subject} — ${thread.student?.full_name || thread.student?.email}`} wide>
      {q.loading ? (
        <Spinner />
      ) : (
        <div className="mb-4 max-h-96 space-y-3 overflow-y-auto pr-1">
          {messages.map((m) => {
            const mine = m.sender_id === profile?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-[#1a1a1a] text-white' : 'bg-white/70 text-neutral-800'}`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <div className={`mt-1 text-[10px] ${mine ? 'text-white/60' : 'text-neutral-400'}`}>{new Date(m.created_at).toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {writable ? (
        <form onSubmit={send} className="flex gap-2">
          <TextInput className="flex-1" placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
          <Button type="submit" loading={busy}>
            <Send size={14} />
          </Button>
          {thread.status !== 'closed' && (
            <Button type="button" variant="ghost" onClick={closeThread}>
              Close
            </Button>
          )}
        </form>
      ) : (
        <p className="text-xs text-neutral-400">You have read-only access to Questions.</p>
      )}
    </Modal>
  );
}
