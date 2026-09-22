import { useMemo, useState } from 'react';
import { CreditCard, Download, Eye, GraduationCap, RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { invokeFn } from '../../lib/functions';
import { useQuery, unwrap } from '../../lib/useQuery';
import { AnswerValue } from '../../components/FormAnswerValue';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, Checkbox, Field, Modal, PageHeader, PasswordInput, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';
import type { Tables } from '../../lib/database.types';

type Profile = Tables<'profiles'>;
const ROLES = ['student', 'instructor', 'super_admin'] as const;
const STATUSES = ['pending', 'active', 'suspended'] as const;

interface CourseRow {
  id: string;
  title: string;
}
interface EnrollmentRow {
  student_id: string;
  course_id: string;
  status: string;
}

interface RegistrationDetail {
  id: string;
  source: 'registration_form' | 'google_form' | 'csv';
  answers: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected';
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  payment_status: 'unpaid' | 'paid' | 'waived';
  payment_amount: number | null;
  payment_ref: string | null;
  payment_method: string | null;
  requested_course: { title: string } | null;
}

interface IdCardDetail {
  card_number: string;
  card_type: string;
  pdf_path: string;
  issued_at: string;
  valid_until: string | null;
}

export function Users() {
  const { profile: me } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [manage, setManage] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState<Profile | null>(null);
  const [viewing, setViewing] = useState<Profile | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const q = useQuery(async () => {
    const [profiles, courses, enrollments] = await Promise.all([
      unwrap(supabase.from('profiles').select('*').order('created_at', { ascending: false })) as Promise<Profile[]>,
      unwrap(supabase.from('courses').select('id, title').eq('status', 'published').order('title')) as Promise<CourseRow[]>,
      unwrap(supabase.from('enrollments').select('student_id, course_id, status')) as Promise<EnrollmentRow[]>,
    ]);
    return { profiles, courses, enrollments };
  }, []);

  const activeSuperAdmins = useMemo(
    () => (q.data?.profiles ?? []).filter((p) => p.role === 'super_admin' && !p.archived_at),
    [q.data],
  );

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return (q.data?.profiles ?? [])
      .filter((p) => showArchived || !p.archived_at)
      .filter((p) => p.full_name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s));
  }, [q.data, search, showArchived]);

  const update = async (id: string, patch: Partial<Profile>) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    if (error) return toast(error.message, 'error');
    toast('Updated');
    q.refetch();
  };

  const restore = async (p: Profile) => {
    const res = await invokeFn<{ error?: string }>('admin-delete-user', { user_id: p.id, restore: true }).catch(
      (e) => ({ error: (e as Error).message }),
    );
    if (res.error) return toast(res.error, 'error');
    toast('Restored');
    q.refetch();
  };

  const activeCourseIds = (studentId: string) =>
    new Set(
      (q.data?.enrollments ?? [])
        .filter((e) => e.student_id === studentId && e.status === 'active')
        .map((e) => e.course_id),
    );

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage roles and account status"
        actions={
          <div className="flex items-center gap-3">
            <Checkbox label="Show deleted" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            <TextInput placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          </div>
        }
      />
      {q.loading ? (
        <Spinner />
      ) : (
        <GlassCard className="overflow-x-auto p-2">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Courses</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {rows.map((p) => {
                const isSelf = p.id === me?.id;
                const enrolledCount = activeCourseIds(p.id).size;
                const archived = !!p.archived_at;
                const isLastSuperAdmin = p.role === 'super_admin' && !archived && activeSuperAdmins.length <= 1;
                return (
                  <tr key={p.id} className={archived ? 'opacity-50' : ''}>
                    <td className="px-4 py-3 font-medium text-neutral-900">{p.full_name || '—'}</td>
                    <td className="px-4 py-3 text-neutral-500">{p.email}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={p.role}
                        disabled={isSelf || archived}
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
                      {archived ? (
                        <Badge tone="red">deleted</Badge>
                      ) : isSelf ? (
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
                    <td className="px-4 py-3">
                      {p.role === 'student' ? (
                        <button
                          onClick={() => setManage(p)}
                          disabled={archived}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-white disabled:opacity-50"
                        >
                          <GraduationCap size={13} />
                          {enrolledCount ? `${enrolledCount} enrolled` : 'Manage access'}
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewing(p)}
                        title="View profile"
                        className="mr-2 inline-flex items-center gap-1.5 rounded-full p-1.5 text-neutral-400 hover:bg-black/[0.05] hover:text-neutral-700"
                      >
                        <Eye size={15} />
                      </button>
                      {archived ? (
                        <button
                          onClick={() => restore(p)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                        >
                          <RotateCcw size={13} /> Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleting(p)}
                          disabled={isSelf || isLastSuperAdmin}
                          title={isSelf ? "You can't delete your own account" : isLastSuperAdmin ? 'At least one super admin must remain' : 'Delete user'}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-neutral-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </GlassCard>
      )}

      {manage && (
        <ManageAccessModal
          student={manage}
          courses={q.data?.courses ?? []}
          activeCourseIds={activeCourseIds(manage.id)}
          adminId={me!.id}
          onClose={() => setManage(null)}
          onChanged={q.refetch}
        />
      )}

      {deleting && (
        <DeleteUserModal target={deleting} onClose={() => setDeleting(null)} onDeleted={q.refetch} />
      )}

      {viewing && (
        <ProfileModal
          student={viewing}
          courses={q.data?.courses ?? []}
          activeCourseIds={activeCourseIds(viewing.id)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function DeleteUserModal({ target, onClose, onDeleted }: { target: Profile; onClose: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await invokeFn<{ deleted?: boolean; error?: string }>('admin-delete-user', {
      user_id: target.id,
      confirm_password: password,
    }).catch((e) => ({ error: (e as Error).message }));
    setBusy(false);
    if (res.error) return setError(res.error);
    toast(`${target.full_name || target.email} deleted`);
    onDeleted();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Delete user">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-neutral-600">
          This removes <strong>{target.full_name || target.email}</strong>&apos;s access immediately — they're
          logged out and blocked from signing back in. Their enrollments, exam history and certificates are kept,
          and you can restore the account later from &quot;Show deleted&quot;.
        </p>
        <Field label="Confirm your password to continue" error={error}>
          <PasswordInput autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={busy}>
            Delete user
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ManageAccessModal({
  student,
  courses,
  activeCourseIds,
  adminId,
  onClose,
  onChanged,
}: {
  student: Profile;
  courses: CourseRow[];
  activeCourseIds: Set<string>;
  adminId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (courseId: string, enrol: boolean) => {
    setBusy(courseId);
    if (enrol) {
      const { error } = await supabase.from('enrollments').upsert(
        { student_id: student.id, course_id: courseId, status: 'active', enrolled_by: adminId },
        { onConflict: 'student_id,course_id' },
      );
      setBusy(null);
      if (error) return toast(error.message, 'error');
      invokeFn('notify', { kind: 'enrollment_approved', user_id: student.id, course_id: courseId }).catch(() => {});
      toast('Enrolled');
    } else {
      const { error } = await supabase
        .from('enrollments')
        .update({ status: 'revoked' })
        .match({ student_id: student.id, course_id: courseId });
      setBusy(null);
      if (error) return toast(error.message, 'error');
      toast('Access revoked');
    }
    onChanged();
  };

  return (
    <Modal open onClose={onClose} title={`Course access — ${student.full_name || student.email}`}>
      {!courses.length ? (
        <p className="text-sm text-neutral-500">No published courses.</p>
      ) : (
        <div className="space-y-2">
          {courses.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/60 bg-white/40 px-3 py-2">
              <span className="text-sm text-neutral-800">{c.title}</span>
              <span className={busy === c.id ? 'pointer-events-none opacity-50' : ''}>
                <Checkbox
                  label={activeCourseIds.has(c.id) ? 'Enrolled' : 'No access'}
                  checked={activeCourseIds.has(c.id)}
                  onChange={(e) => toggle(c.id, e.target.checked)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

/** Everything staff would want to see about a student in one place: photo, contact
 * info, active enrollments, their ID card, and the original registration intake
 * (form answers, uploaded documents, payment) that was captured before they were
 * accepted — that record lives on, but nothing on the Users page surfaced it. */
function ProfileModal({
  student,
  courses,
  activeCourseIds,
  onClose,
}: {
  student: Profile;
  courses: CourseRow[];
  activeCourseIds: Set<string>;
  onClose: () => void;
}) {
  const toast = useToast();

  const q = useQuery(async () => {
    const [registration, card] = await Promise.all([
      unwrap(
        supabase
          .from('registrations')
          .select(
            'id, source, answers, status, review_note, reviewed_at, created_at, payment_status, payment_amount, payment_ref, payment_method, requested_course:courses(title)',
          )
          .eq('created_profile_id', student.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as Promise<RegistrationDetail | null>,
      unwrap(
        supabase
          .from('id_cards')
          .select('card_number, card_type, pdf_path, issued_at, valid_until')
          .eq('student_id', student.id)
          .maybeSingle(),
      ) as Promise<IdCardDetail | null>,
    ]);
    return { registration, card };
  }, [student.id]);

  const downloadCard = async (path: string) => {
    const { data, error } = await supabase.storage.from('id-cards').createSignedUrl(path, 120);
    if (error || !data) return toast('Could not open the ID card', 'error');
    window.open(data.signedUrl, '_blank');
  };

  const enrolledTitles = courses.filter((c) => activeCourseIds.has(c.id)).map((c) => c.title);
  const reg = q.data?.registration ?? null;
  const card = q.data?.card ?? null;
  const answers = Object.entries(reg?.answers ?? {});

  return (
    <Modal open onClose={onClose} title="Student profile" wide>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          {student.avatar_url ? (
            <img
              src={student.avatar_url}
              alt={student.full_name}
              className="h-16 w-16 rounded-full border border-white/60 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/60 bg-white/60 text-lg font-semibold text-neutral-500">
              {(student.full_name || student.email).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-base font-semibold text-neutral-900">{student.full_name || '—'}</div>
            <div className="text-sm text-neutral-500">
              {student.email}
              {student.phone ? ` · ${student.phone}` : ''}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge tone="neutral">{student.role}</Badge>
              <Badge tone={student.status === 'active' ? 'green' : student.status === 'suspended' ? 'red' : 'amber'}>
                {student.status}
              </Badge>
              <span className="text-xs text-neutral-400">Joined {new Date(student.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {q.loading ? (
          <Spinner />
        ) : (
          <>
            <div className="rounded-2xl border border-white/60 bg-white/40 p-4">
              <div className="mb-2 text-sm font-medium text-neutral-700">Enrolled courses</div>
              {enrolledTitles.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {enrolledTitles.map((t) => (
                    <Badge key={t} tone="blue">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-400">No active course access.</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/60 bg-white/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium text-neutral-700">ID card</div>
                {card && (
                  <Button variant="ghost" onClick={() => downloadCard(card.pdf_path)}>
                    <Download size={13} /> Download
                  </Button>
                )}
              </div>
              {card ? (
                <div className="text-sm text-neutral-600">
                  <span className="font-mono">{card.card_number}</span> · {card.card_type} · issued{' '}
                  {new Date(card.issued_at).toLocaleDateString()}
                  {card.valid_until && ` · valid until ${new Date(card.valid_until).toLocaleDateString()}`}
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-neutral-400">
                  <CreditCard size={14} /> No ID card issued yet.
                </p>
              )}
            </div>

            {reg && (
              <div className="rounded-2xl border border-white/60 bg-white/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-neutral-700">Registration details</div>
                  <Badge tone={reg.payment_status === 'unpaid' ? 'neutral' : 'green'}>
                    {reg.payment_status === 'waived' ? 'fee waived' : reg.payment_status}
                    {reg.payment_amount ? ` · ₹${reg.payment_amount.toLocaleString('en-IN')}` : ''}
                  </Badge>
                </div>
                {reg.requested_course?.title && (
                  <div className="mb-2 text-sm text-neutral-500">Requested: {reg.requested_course.title}</div>
                )}
                {!!answers.length && (
                  <dl className="space-y-2 text-sm">
                    {answers.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[160px_1fr] gap-3">
                        <dt className="text-neutral-500">{k}</dt>
                        <dd className="text-neutral-900">
                          <AnswerValue value={v} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {reg.review_note && <p className="mt-2 text-xs text-neutral-400">Note: {reg.review_note}</p>}
              </div>
            )}
          </>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
