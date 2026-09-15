import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { invokeFn } from '../../lib/functions';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';

interface Req {
  id: string;
  status: string;
  submitted_at: string;
  review_note: string | null;
  course: { id: string; title: string } | null;
  student: { id: string; full_name: string; email: string } | null;
  form: { title: string } | null;
  enrollment_request_answers: {
    id: string;
    value_text: string | null;
    value_json: unknown;
    file_path: string | null;
    field: { label: string; field_type: string } | null;
  }[];
}

export function EnrollmentRequests({ formId }: { formId?: string }) {
  const { profile } = useAuth();
  const { canWrite } = useAdminAccess();
  const writable = canWrite(formId ? 'forms' : 'enrollments');
  const toast = useToast();
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [viewing, setViewing] = useState<Req | null>(null);
  const [note, setNote] = useState('');

  const q = useQuery<Req[]>(() => {
    let sel = supabase
      .from('enrollment_requests')
      .select(
        'id, status, submitted_at, review_note, course:courses(id, title), student:profiles!enrollment_requests_student_id_fkey(id, full_name, email), form:enrollment_forms(title), ' +
          'enrollment_request_answers(id, value_text, value_json, file_path, field:enrollment_form_fields(label, field_type))',
      )
      .order('submitted_at', { ascending: false });
    if (formId) sel = sel.eq('form_id', formId);
    if (filter !== 'all') sel = sel.eq('status', filter);
    return unwrap(sel) as Promise<Req[]>;
  }, [filter, formId]);

  const decide = async (r: Req, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('enrollment_requests')
      .update({ status, reviewed_by: profile!.id, reviewed_at: new Date().toISOString(), review_note: note || null })
      .eq('id', r.id);
    if (error) return toast(error.message, 'error');

    if (status === 'approved' && r.student && r.course) {
      const { error: enrErr } = await supabase.from('enrollments').upsert(
        { student_id: r.student.id, course_id: r.course.id, source_request_id: r.id, status: 'active', enrolled_by: profile!.id },
        { onConflict: 'student_id,course_id' },
      );
      if (enrErr) return toast(enrErr.message, 'error');
      invokeFn('notify', { kind: 'enrollment_approved', user_id: r.student.id, course_id: r.course.id }).catch(() => {});
    }
    toast(status === 'approved' ? 'Enrolled' : 'Request rejected');
    setViewing(null);
    setNote('');
    q.refetch();
  };

  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from('enrollment-uploads').createSignedUrl(path, 120);
    if (data) window.open(data.signedUrl, '_blank');
  };

  return (
    <div>
      <PageHeader
        title={formId ? 'Form responses' : 'Enrollment requests'}
        subtitle="Review and approve applicants"
        actions={
          <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-40">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </Select>
        }
      />

      {q.loading ? (
        <Spinner />
      ) : !q.data?.length ? (
        <EmptyState icon={<Inbox size={22} />} title="Nothing here" description="Requests will show up as students submit forms." />
      ) : (
        <GlassCard className="divide-y divide-white/50 p-2">
          {q.data.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-medium text-neutral-900">{r.student?.full_name || r.student?.email}</div>
                <div className="text-sm text-neutral-500">
                  {r.course?.title} · {new Date(r.submitted_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{r.status}</Badge>
                <Button variant="secondary" onClick={() => { setViewing(r); setNote(r.review_note ?? ''); }}>
                  {writable ? 'Review' : 'View'}
                </Button>
              </div>
            </div>
          ))}
        </GlassCard>
      )}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Enrollment request" wide>
        {viewing && (
          <div className="space-y-4">
            <div className="text-sm">
              <div className="font-medium text-neutral-900">{viewing.student?.full_name}</div>
              <div className="text-neutral-500">{viewing.student?.email}</div>
              <div className="mt-1 text-neutral-500">
                {viewing.course?.title} — form “{viewing.form?.title}”
              </div>
            </div>

            <div className="rounded-2xl border border-white/60 bg-white/40 p-4">
              <dl className="space-y-2 text-sm">
                {viewing.enrollment_request_answers.map((a) => (
                  <div key={a.id} className="grid grid-cols-[160px_1fr] gap-3">
                    <dt className="text-neutral-500">{a.field?.label ?? 'Field'}</dt>
                    <dd className="text-neutral-900">
                      {a.file_path ? (
                        <button onClick={() => openFile(a.file_path!)} className="text-blue-600 underline">
                          View uploaded file
                        </button>
                      ) : Array.isArray(a.value_json) ? (
                        (a.value_json as string[]).join(', ')
                      ) : (
                        a.value_text || '—'
                      )}
                    </dd>
                  </div>
                ))}
                {!viewing.enrollment_request_answers.length && <p className="text-neutral-400">No custom fields.</p>}
              </dl>
            </div>

            {viewing.status === 'pending' && writable && (
              <>
                <TextInput placeholder="Review note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button variant="danger" onClick={() => decide(viewing, 'rejected')}>
                    Reject
                  </Button>
                  <Button onClick={() => decide(viewing, 'approved')}>Approve &amp; enroll</Button>
                </div>
              </>
            )}
            {viewing.status === 'pending' && !writable && (
              <p className="text-xs text-neutral-400">You have read-only access here — a super admin or a write-enabled instructor can approve or reject this.</p>
            )}
            {viewing.status !== 'pending' && viewing.review_note && (
              <p className="text-sm text-neutral-500">Note: {viewing.review_note}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
