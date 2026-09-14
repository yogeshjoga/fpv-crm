import { useMemo, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { invokeFn } from '../../lib/functions';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';

interface Thread {
  id: string;
  subject: string;
  status: string;
  updated_at: string;
}
interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

const toneFor = (status: string): 'green' | 'neutral' | 'blue' =>
  status === 'answered' ? 'green' : status === 'closed' ? 'neutral' : 'blue';

export function Ask() {
  const { profile } = useAuth();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Thread | null>(null);

  const q = useQuery(async () => {
    const threads = (await unwrap(
      supabase.from('support_threads').select('id, subject, status, updated_at').eq('student_id', profile?.id ?? '').order('updated_at', { ascending: false }),
    )) as Thread[];
    return { threads };
  }, [profile?.id]);

  if (q.loading) return <Spinner />;
  const threads = q.data?.threads ?? [];

  return (
    <div>
      <PageHeader
        title="Ask us"
        subtitle="Stuck on something, or just have a question? A real person reads these."
        actions={
          <Button onClick={() => setCreating(true)}>
            <MessageCircle size={15} /> New question
          </Button>
        }
      />
      {!threads.length ? (
        <EmptyState
          icon={<MessageCircle size={22} />}
          title="No questions yet"
          description="Ask anything about a course, the build lab, or your exam — an instructor will get notified right away."
          action={<Button onClick={() => setCreating(true)}>Ask a question</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {threads.map((t) => (
            <button key={t.id} onClick={() => setOpen(t)} className="text-left">
              <GlassCard className="flex items-center justify-between gap-3 p-4 transition-transform hover:-translate-y-0.5">
                <div className="min-w-0">
                  <div className="truncate font-medium text-neutral-900">{t.subject}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">{new Date(t.updated_at).toLocaleString()}</div>
                </div>
                <Badge tone={toneFor(t.status)}>{t.status}</Badge>
              </GlassCard>
            </button>
          ))}
        </div>
      )}

      {creating && (
        <NewThreadModal
          studentId={profile!.id}
          onClose={() => setCreating(false)}
          onCreated={(t) => {
            setCreating(false);
            q.refetch();
            setOpen(t);
          }}
        />
      )}
      {open && <ThreadModal thread={open} onClose={() => { setOpen(null); q.refetch(); }} />}
    </div>
  );
}

function NewThreadModal({ studentId, onClose, onCreated }: { studentId: string; onClose: () => void; onCreated: (t: Thread) => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setBusy(true);
    const { data: thread, error } = await supabase
      .from('support_threads')
      .insert({ student_id: studentId, subject: subject.trim() })
      .select('id, subject, status, updated_at')
      .single();
    if (error || !thread) {
      setBusy(false);
      return toast(error?.message ?? 'Could not create the thread', 'error');
    }
    const { error: msgErr } = await supabase.from('support_messages').insert({ thread_id: thread.id, sender_id: studentId, body: body.trim() });
    setBusy(false);
    if (msgErr) return toast(msgErr.message, 'error');
    invokeFn('ask-notify', { thread_id: thread.id }).catch(() => {});
    toast('Sent — an instructor will reply soon');
    onCreated(thread as Thread);
  };

  return (
    <Modal open onClose={onClose} title="Ask a question">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Subject">
          <TextInput required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Can't get my exam attempt to start" />
        </Field>
        <Field label="Your question">
          <TextArea required value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            <Send size={14} /> Send
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ThreadModal({ thread, onClose }: { thread: Thread; onClose: () => void }) {
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

  return (
    <Modal open onClose={onClose} title={thread.subject} wide>
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
      <form onSubmit={send} className="flex gap-2">
        <TextInput className="flex-1" placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
        <Button type="submit" loading={busy}>
          <Send size={14} />
        </Button>
      </form>
    </Modal>
  );
}
