import { useMemo, useState } from 'react';
import { BookOpen, FolderPlus, Layers3, Trash2, Users as UsersIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { slugify } from '../../lib/slug';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, Checkbox, EmptyState, Field, Modal, PageHeader, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';
import type { Tables } from '../../lib/database.types';

type Group = Tables<'course_groups'>;
type Course = Tables<'courses'>;
type Profile = Tables<'profiles'>;
type GroupCourse = Tables<'course_group_courses'>;
type GroupMember = Tables<'course_group_members'>;

export function CourseGroups() {
  const { profile } = useAuth();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [coursesFor, setCoursesFor] = useState<Group | null>(null);
  const [studentsFor, setStudentsFor] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState<Group | null>(null);

  const q = useQuery(async () => {
    const [groups, courses, students, groupCourses, groupMembers] = await Promise.all([
      unwrap(supabase.from('course_groups').select('*').order('created_at', { ascending: false })) as Promise<Group[]>,
      unwrap(supabase.from('courses').select('*').order('title')) as Promise<Course[]>,
      unwrap(supabase.from('profiles').select('*').eq('role', 'student').is('archived_at', null).order('full_name')) as Promise<Profile[]>,
      unwrap(supabase.from('course_group_courses').select('*')) as Promise<GroupCourse[]>,
      unwrap(supabase.from('course_group_members').select('*')) as Promise<GroupMember[]>,
    ]);
    return { groups, courses, students, groupCourses, groupMembers };
  }, []);

  const countsFor = (groupId: string) => ({
    courses: (q.data?.groupCourses ?? []).filter((gc) => gc.group_id === groupId).length,
    students: (q.data?.groupMembers ?? []).filter((gm) => gm.group_id === groupId).length,
  });

  const deleteGroup = async (g: Group) => {
    const { error } = await supabase.from('course_groups').delete().eq('id', g.id);
    if (error) return toast(error.message, 'error');
    toast(`"${g.name}" deleted — existing enrollments were kept`);
    setDeleting(null);
    q.refetch();
  };

  return (
    <div>
      <PageHeader
        title="Course groups"
        subtitle="Bundle courses into a workshop and grant a batch of students access at once"
        actions={
          <Button onClick={() => setCreating(true)}>
            <FolderPlus size={16} /> New group
          </Button>
        }
      />

      {q.loading ? (
        <Spinner />
      ) : !q.data?.groups.length ? (
        <EmptyState
          icon={<Layers3 size={22} />}
          title="No course groups yet"
          description="Create a group for a workshop, add its courses, then add the enrolled students."
          action={<Button onClick={() => setCreating(true)}>New group</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.groups.map((g) => {
            const counts = countsFor(g.id);
            return (
              <GlassCard key={g.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-neutral-900">{g.name}</div>
                    <div className="mt-0.5 text-xs text-neutral-400">/{g.slug}</div>
                  </div>
                  <button
                    onClick={() => setDeleting(g)}
                    className="text-neutral-400 hover:text-red-600"
                    title="Delete group"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {g.description && <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{g.description}</p>}
                <div className="mt-3 flex gap-2 text-xs text-neutral-500">
                  <Badge tone="blue">{counts.courses} course{counts.courses === 1 ? '' : 's'}</Badge>
                  <Badge tone="green">{counts.students} student{counts.students === 1 ? '' : 's'}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setCoursesFor(g)}>
                    <BookOpen size={14} /> Courses
                  </Button>
                  <Button variant="secondary" onClick={() => setStudentsFor(g)}>
                    <UsersIcon size={14} /> Students
                  </Button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <CreateGroupModal
        open={creating}
        onClose={() => setCreating(false)}
        createdBy={profile!.id}
        onCreated={() => {
          setCreating(false);
          q.refetch();
        }}
      />

      {coursesFor && (
        <GroupCoursesModal
          group={coursesFor}
          allCourses={q.data?.courses ?? []}
          groupCourseIds={new Set((q.data?.groupCourses ?? []).filter((gc) => gc.group_id === coursesFor.id).map((gc) => gc.course_id))}
          memberIds={(q.data?.groupMembers ?? []).filter((gm) => gm.group_id === coursesFor.id).map((gm) => gm.student_id)}
          onClose={() => setCoursesFor(null)}
          onChanged={q.refetch}
        />
      )}

      {studentsFor && (
        <GroupStudentsModal
          group={studentsFor}
          allStudents={q.data?.students ?? []}
          memberIds={new Set((q.data?.groupMembers ?? []).filter((gm) => gm.group_id === studentsFor.id).map((gm) => gm.student_id))}
          courseIds={(q.data?.groupCourses ?? []).filter((gc) => gc.group_id === studentsFor.id).map((gc) => gc.course_id)}
          adminId={profile!.id}
          onClose={() => setStudentsFor(null)}
          onChanged={q.refetch}
        />
      )}

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete group">
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              This removes the group <strong>{deleting.name}</strong> and its course/student lists. It does{' '}
              <strong>not</strong> revoke any course access already granted — that's managed per-student from Users.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => deleteGroup(deleting)}>
                Delete group
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CreateGroupModal({
  open,
  onClose,
  createdBy,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  createdBy: string;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('course_groups').insert({
      name,
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
      description: description || null,
      created_by: createdBy,
    });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Group created');
    setName('');
    setDescription('');
    onCreated();
  };

  return (
    <Modal open={open} onClose={onClose} title="New course group">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" required>
          <TextInput required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="September FPV Workshop" />
        </Field>
        <Field label="Description">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this workshop for?" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create group
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function GroupCoursesModal({
  group,
  allCourses,
  groupCourseIds,
  memberIds,
  onClose,
  onChanged,
}: {
  group: Group;
  allCourses: Course[];
  groupCourseIds: Set<string>;
  memberIds: string[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (course: Course, add: boolean) => {
    setBusy(course.id);
    if (add) {
      const { error } = await supabase.from('course_group_courses').insert({ group_id: group.id, course_id: course.id });
      if (error) {
        setBusy(null);
        return toast(error.message, 'error');
      }
      // grant every current member of this group access to the newly added course
      if (memberIds.length) {
        const rows = memberIds.map((student_id) => ({ student_id, course_id: course.id, status: 'active' as const }));
        const { error: enrErr } = await supabase.from('enrollments').upsert(rows, { onConflict: 'student_id,course_id' });
        if (enrErr) {
          setBusy(null);
          return toast(`Course added, but enrolling members failed: ${enrErr.message}`, 'error');
        }
      }
      toast(memberIds.length ? `Added — ${memberIds.length} member(s) enrolled` : 'Course added to group');
    } else {
      const { error } = await supabase.from('course_group_courses').delete().match({ group_id: group.id, course_id: course.id });
      if (error) {
        setBusy(null);
        return toast(error.message, 'error');
      }
      toast('Removed from group (existing enrollments kept)');
    }
    setBusy(null);
    onChanged();
  };

  return (
    <Modal open onClose={onClose} title={`Courses — ${group.name}`} wide>
      <p className="mb-3 text-xs text-neutral-500">
        Adding a course here immediately enrolls every student already in this group.
      </p>
      {!allCourses.length ? (
        <p className="text-sm text-neutral-500">No courses yet.</p>
      ) : (
        <div className="max-h-[420px] space-y-2 overflow-y-auto">
          {allCourses.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/60 bg-white/40 px-3 py-2">
              <div>
                <span className="text-sm text-neutral-800">{c.title}</span>
                <span className="ml-2 text-xs text-neutral-400">{c.status}</span>
              </div>
              <span className={busy === c.id ? 'pointer-events-none opacity-50' : ''}>
                <Checkbox
                  label={groupCourseIds.has(c.id) ? 'In group' : 'Not in group'}
                  checked={groupCourseIds.has(c.id)}
                  onChange={(e) => toggle(c, e.target.checked)}
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

function GroupStudentsModal({
  group,
  allStudents,
  memberIds,
  courseIds,
  adminId,
  onClose,
  onChanged,
}: {
  group: Group;
  allStudents: Profile[];
  memberIds: Set<string>;
  courseIds: string[];
  adminId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return allStudents.filter((p) => p.full_name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s));
  }, [allStudents, search]);

  const toggle = async (student: Profile, add: boolean) => {
    setBusy(student.id);
    if (add) {
      const { error } = await supabase.from('course_group_members').insert({ group_id: group.id, student_id: student.id, added_by: adminId });
      if (error) {
        setBusy(null);
        return toast(error.message, 'error');
      }
      // grant access to every course currently in this group
      if (courseIds.length) {
        const rows = courseIds.map((course_id) => ({ student_id: student.id, course_id, status: 'active' as const }));
        const { error: enrErr } = await supabase.from('enrollments').upsert(rows, { onConflict: 'student_id,course_id' });
        if (enrErr) {
          setBusy(null);
          return toast(`Added to group, but enrolling failed: ${enrErr.message}`, 'error');
        }
      }
      toast(courseIds.length ? `Enrolled in ${courseIds.length} course(s)` : 'Added to group');
    } else {
      const { error } = await supabase.from('course_group_members').delete().match({ group_id: group.id, student_id: student.id });
      if (error) {
        setBusy(null);
        return toast(error.message, 'error');
      }
      toast('Removed from group (existing enrollments kept)');
    }
    setBusy(null);
    onChanged();
  };

  return (
    <Modal open onClose={onClose} title={`Students — ${group.name}`} wide>
      <p className="mb-3 text-xs text-neutral-500">
        Adding a student here immediately enrolls them in every course currently in this group.
      </p>
      <TextInput placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />
      {!rows.length ? (
        <p className="text-sm text-neutral-500">No students match.</p>
      ) : (
        <div className="max-h-[420px] space-y-2 overflow-y-auto">
          {rows.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/60 bg-white/40 px-3 py-2">
              <div>
                <span className="text-sm text-neutral-800">{p.full_name || p.email}</span>
                <span className="ml-2 text-xs text-neutral-400">{p.email}</span>
              </div>
              <span className={busy === p.id ? 'pointer-events-none opacity-50' : ''}>
                <Checkbox
                  label={memberIds.has(p.id) ? 'In group' : 'Not in group'}
                  checked={memberIds.has(p.id)}
                  onChange={(e) => toggle(p, e.target.checked)}
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
