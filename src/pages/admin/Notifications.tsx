import { useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { invokeFn } from '../../lib/functions';
import { GlassCard } from '../../components/ui/shared';
import { Button, EmptyState, Field, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';

const AUDIENCES = [
  { value: 'all_students', label: 'All active students' },
  { value: 'course', label: 'Students in a course' },
  { value: 'all_staff', label: 'All staff' },
] as const;

export function Notifications() {
  const { canWrite } = useAdminAccess();
  const writable = canWrite('notifications');
  const toast = useToast();
  const [audienceType, setAudienceType] = useState<'all_students' | 'course' | 'all_staff'>('all_students');
  const [courseId, setCourseId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const q = useQuery(async () => {
    const [courses, broadcasts] = await Promise.all([
      unwrap(supabase.from('courses').select('id, title').order('title')) as Promise<any[]>,
      unwrap(
        supabase
          .from('broadcasts')
          .select('id, subject, audience_type, recipient_count, email_sent, sent_at, sender:profiles!broadcasts_sent_by_fkey(full_name)')
          .order('sent_at', { ascending: false })
          .limit(30),
      ) as Promise<any[]>,
    ]);
    return { courses, broadcasts };
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return toast('Subject is required', 'error');
    if (audienceType === 'course' && !courseId) return toast('Pick a course', 'error');
    if (!confirm('Send this notification now?')) return;
    setBusy(true);
    try {
      const res = await invokeFn<{ recipient_count: number; email_sent: number }>('broadcast', {
        subject,
        body,
        audience_type: audienceType,
        audience_ref: audienceType === 'course' ? { course_id: courseId } : {},
      });
      toast(`Sent to ${res.recipient_count} people (${res.email_sent} emails)`);
      setSubject('');
      setBody('');
      q.refetch();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Send an in-app + email notification to a group" />

      <div className={`grid gap-6 ${writable ? 'lg:grid-cols-[420px_1fr]' : ''}`}>
        {writable && (
          <GlassCard className="p-5">
            <form onSubmit={send} className="space-y-4">
              <Field label="Audience">
                <Select value={audienceType} onChange={(e) => setAudienceType(e.target.value as typeof audienceType)}>
                  {AUDIENCES.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </Select>
              </Field>
              {audienceType === 'course' && (
                <Field label="Course">
                  <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                    <option value="">Select…</option>
                    {q.data?.courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Subject" required>
                <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} />
              </Field>
              <Field label="Message">
                <TextArea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[140px]" />
              </Field>
              <Button type="submit" loading={busy} className="w-full">
                <Send size={15} /> Send now
              </Button>
            </form>
          </GlassCard>
        )}

        <div>
          <div className="mb-2 text-sm font-semibold text-neutral-700">Recent broadcasts</div>
          {q.loading ? (
            <Spinner />
          ) : !q.data?.broadcasts.length ? (
            <EmptyState icon={<Megaphone size={22} />} title="Nothing sent yet" />
          ) : (
            <GlassCard className="divide-y divide-white/50 p-2">
              {q.data.broadcasts.map((b) => (
                <div key={b.id} className="px-4 py-3">
                  <div className="font-medium text-neutral-900">{b.subject}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {b.audience_type.replace('_', ' ')} · {b.recipient_count} recipients · {b.email_sent} emails ·{' '}
                    {new Date(b.sent_at).toLocaleString()} · {b.sender?.full_name ?? '—'}
                  </div>
                </div>
              ))}
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
