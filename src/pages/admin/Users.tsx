import { useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { invokeFn } from '../../lib/functions';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, Checkbox, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';
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

export function Users() {
  const { profile: me } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [manage, setManage] = useState<Profile | null>(null);

  const q = useQuery(async () => {
    const [profiles, courses, enrollments] = await Promise.all([
      unwrap(supabase.from('profiles').select('*').order('created_at', { ascending: false })) as Promise<Profile[]>,
      unwrap(supabase.from('courses').select('id, title').eq('status', 'published').order('title')) as Promise<CourseRow[]>,
      unwrap(supabase.from('enrollments').select('student_id, course_id, status')) as Promise<EnrollmentRow[]>,
    ]);
    return { profiles, courses, enrollments };
  }, []);

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return (q.data?.profiles ?? []).filter(
      (p) => p.full_name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s),
    );
  }, [q.data, search]);

  const update = async (id: string, patch: Partial<Profile>) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    if (error) return toast(error.message, 'error');
    toast('Updated');
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
        actions={<TextInput placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />}
      />
      {q.loading ? (
        <Spinner />
      ) : (
        <GlassCard className="overflow-x-auto p-2">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Courses</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {rows.map((p) => {
                const isSelf = p.id === me?.id;
                const enrolledCount = activeCourseIds(p.id).size;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-neutral-900">{p.full_name || '—'}</td>
                    <td className="px-4 py-3 text-neutral-500">{p.email}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={p.role}
                        disabled={isSelf}
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
                      {isSelf ? (
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
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-white"
                        >
                          <GraduationCap size={13} />
                          {enrolledCount ? `${enrolledCount} enrolled` : 'Manage access'}
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{new Date(p.created_at).toLocaleDateString()}</td>
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
    </div>
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
