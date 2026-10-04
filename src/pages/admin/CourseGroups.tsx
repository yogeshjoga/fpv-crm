import { useMemo, useState } from 'react';
import { BookOpen, FolderPlus, Layers3, ShieldCheck, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { invokeFn } from '../../lib/functions';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
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
type GroupCoordinator = Tables<'course_group_coordinators'>;

export function CourseGroups() {
  const { profile } = useAuth();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('course-groups');
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [coursesFor, setCoursesFor] = useState<Group | null>(null);
  const [studentsFor, setStudentsFor] = useState<Group | null>(null);
  const [coordinatorsFor, setCoordinatorsFor] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState<Group | null>(null);
  // 'all' = opened from the page header (pick any groups); a group = opened from that group's Students window
  const [addingPeople, setAddingPeople] = useState<'all' | Group | null>(null);

  const q = useQuery(async () => {
    const [groups, courses, students, coordinators, groupCourses, groupMembers, groupCoordinators] = await Promise.all([
      unwrap(supabase.from('course_groups').select('*').order('created_at', { ascending: false })) as Promise<Group[]>,
      unwrap(supabase.from('courses').select('*').order('title')) as Promise<Course[]>,
      unwrap(supabase.from('profiles').select('*').eq('role', 'student').is('archived_at', null).order('full_name')) as Promise<Profile[]>,
      unwrap(supabase.from('profiles').select('*').eq('role', 'coordinator').is('archived_at', null).order('full_name')) as Promise<Profile[]>,
      unwrap(supabase.from('course_group_courses').select('*')) as Promise<GroupCourse[]>,
      unwrap(supabase.from('course_group_members').select('*')) as Promise<GroupMember[]>,
      unwrap(supabase.from('course_group_coordinators').select('*')) as Promise<GroupCoordinator[]>,
    ]);
    return { groups, courses, students, coordinators, groupCourses, groupMembers, groupCoordinators };
  }, []);

  const countsFor = (groupId: string) => ({
    courses: (q.data?.groupCourses ?? []).filter((gc) => gc.group_id === groupId).length,
    students: (q.data?.groupMembers ?? []).filter((gm) => gm.group_id === groupId).length,
    coordinators: (q.data?.groupCoordinators ?? []).filter((gc) => gc.group_id === groupId).length,
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
          writable && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setAddingPeople('all')}>
                <UserPlus size={16} /> Add people by email
              </Button>
              <Button onClick={() => setCreating(true)}>
                <FolderPlus size={16} /> New group
              </Button>
            </div>
          )
        }
      />

      {q.loading ? (
        <Spinner />
      ) : !q.data?.groups.length ? (
        <EmptyState
          icon={<Layers3 size={22} />}
          title="No course groups yet"
          description="Create a group for a workshop, add its courses, then add the enrolled students."
          action={writable && <Button onClick={() => setCreating(true)}>New group</Button>}
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
                  {writable && (
                    <button
                      onClick={() => setDeleting(g)}
                      className="text-neutral-400 hover:text-red-600"
                      title="Delete group"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {g.description && <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{g.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                  <Badge tone="blue">{counts.courses} course{counts.courses === 1 ? '' : 's'}</Badge>
                  <Badge tone="green">{counts.students} student{counts.students === 1 ? '' : 's'}</Badge>
                  <Badge tone="amber">{counts.coordinators} coordinator{counts.coordinators === 1 ? '' : 's'}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setCoursesFor(g)}>
                    <BookOpen size={14} /> Courses
                  </Button>
                  <Button variant="secondary" onClick={() => setStudentsFor(g)}>
                    <UsersIcon size={14} /> Students
                  </Button>
                  <Button variant="secondary" onClick={() => setCoordinatorsFor(g)}>
                    <ShieldCheck size={14} /> Coordinators
                  </Button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {addingPeople && writable && (
        <AddPeopleModal
          groups={q.data?.groups ?? []}
          courses={q.data?.courses ?? []}
          defaultGroupId={addingPeople === 'all' ? null : addingPeople.id}
          onClose={() => setAddingPeople(null)}
          onDone={q.refetch}
        />
      )}

      <CreateGroupModal
        open={creating && writable}
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
          writable={writable}
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
          writable={writable}
          onAddByEmail={() => setAddingPeople(studentsFor)}
          onClose={() => setStudentsFor(null)}
          onChanged={q.refetch}
        />
      )}

      {coordinatorsFor && (
        <GroupCoordinatorsModal
          group={coordinatorsFor}
          allCoordinators={q.data?.coordinators ?? []}
          memberIds={new Set(
            (q.data?.groupCoordinators ?? []).filter((gc) => gc.group_id === coordinatorsFor.id).map((gc) => gc.coordinator_id),
          )}
          adminId={profile!.id}
          writable={writable}
          onClose={() => setCoordinatorsFor(null)}
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
  writable,
  onClose,
  onChanged,
}: {
  group: Group;
  allCourses: Course[];
  groupCourseIds: Set<string>;
  memberIds: string[];
  writable: boolean;
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
        {writable
          ? 'Adding a course here immediately enrolls every student already in this group.'
          : 'You have read-only access to Course Groups.'}
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
                  disabled={!writable}
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
  writable,
  onAddByEmail,
  onClose,
  onChanged,
}: {
  group: Group;
  allStudents: Profile[];
  memberIds: Set<string>;
  courseIds: string[];
  adminId: string;
  writable: boolean;
  onAddByEmail: () => void;
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
        {writable
          ? 'Adding a student here immediately enrolls them in every course currently in this group.'
          : 'You have read-only access to Course Groups.'}
      </p>
      <div className="mb-3 flex items-center gap-2">
        <TextInput placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {writable && (
          <Button variant="secondary" onClick={onAddByEmail} className="shrink-0">
            <UserPlus size={15} /> Add by email
          </Button>
        )}
      </div>
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
                  disabled={!writable}
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

/** Who supervises this group — unlike students, assigning a coordinator here
 * doesn't touch enrollments at all; it's a pure responsibility assignment. */
function GroupCoordinatorsModal({
  group,
  allCoordinators,
  memberIds,
  adminId,
  writable,
  onClose,
  onChanged,
}: {
  group: Group;
  allCoordinators: Profile[];
  memberIds: Set<string>;
  adminId: string;
  writable: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return allCoordinators.filter((p) => p.full_name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s));
  }, [allCoordinators, search]);

  const toggle = async (coordinator: Profile, add: boolean) => {
    setBusy(coordinator.id);
    if (add) {
      const { error } = await supabase
        .from('course_group_coordinators')
        .insert({ group_id: group.id, coordinator_id: coordinator.id, added_by: adminId });
      if (error) {
        setBusy(null);
        return toast(error.message, 'error');
      }
      toast('Coordinator assigned');
    } else {
      const { error } = await supabase
        .from('course_group_coordinators')
        .delete()
        .match({ group_id: group.id, coordinator_id: coordinator.id });
      if (error) {
        setBusy(null);
        return toast(error.message, 'error');
      }
      toast('Coordinator removed');
    }
    setBusy(null);
    onChanged();
  };

  return (
    <Modal open onClose={onClose} title={`Coordinators — ${group.name}`} wide>
      <p className="mb-3 text-xs text-neutral-500">
        {writable
          ? "Assigning a coordinator here doesn't change anyone's course access — it just marks who's responsible for this group."
          : 'You have read-only access to Course Groups.'}
      </p>
      {!allCoordinators.length ? (
        <p className="text-sm text-neutral-500">No coordinator accounts yet — promote a student to "coordinator" from Users first.</p>
      ) : (
        <>
          <TextInput placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />
          {!rows.length ? (
            <p className="text-sm text-neutral-500">No coordinators match.</p>
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
                      label={memberIds.has(p.id) ? 'Assigned' : 'Not assigned'}
                      checked={memberIds.has(p.id)}
                      disabled={!writable}
                      onChange={(e) => toggle(p, e.target.checked)}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

type AddResult = { email: string; outcome: 'created' | 'existing' | 'skipped'; note?: string; email_sent?: boolean; temp_password?: string };

/**
 * Add people straight from their email addresses, with no registration form. Existing students are
 * reused; new addresses get an account and an emailed temporary password. Everyone is put into the
 * chosen groups and enrolled in every course those groups hold.
 */
function AddPeopleModal({
  groups,
  courses,
  defaultGroupId,
  onClose,
  onDone,
}: {
  groups: Group[];
  courses: Course[];
  defaultGroupId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set(defaultGroupId ? [defaultGroupId] : []));
  const [courseIds, setCourseIds] = useState<Set<string>>(new Set());
  const [showCourses, setShowCourses] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ created: number; existing: number; skipped: number; granted_courses: number; results: AddResult[] } | null>(null);

  const toggle = (set: Set<string>, id: string, on: boolean, apply: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    apply(next);
  };

  // one person per line: "email" or "email, name" (comma, tab or semicolon)
  const people = useMemo(
    () =>
      text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [email, ...rest] = l.split(/[,;\t]/);
          return { email: email.trim(), full_name: rest.join(' ').trim() };
        }),
    [text],
  );

  const submit = async () => {
    if (!people.length) return toast('Type or paste at least one email address', 'error');
    if (!groupIds.size && !courseIds.size) return toast('Pick at least one group or course to give them', 'error');
    setBusy(true);
    try {
      const res = await invokeFn<NonNullable<typeof report>>('add-students', {
        people,
        group_ids: [...groupIds],
        course_ids: [...courseIds],
      });
      setReport(res);
      onDone();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (report) {
    const attention = report.results.filter((r) => r.outcome === 'skipped' || r.temp_password);
    return (
      <Modal open onClose={onClose} title="People added" wide>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Badge tone="green">{report.created} new account{report.created === 1 ? '' : 's'}</Badge>
          <Badge tone="blue">{report.existing} existing student{report.existing === 1 ? '' : 's'}</Badge>
          {report.skipped > 0 && <Badge tone="amber">{report.skipped} skipped</Badge>}
          <Badge tone="neutral">{report.granted_courses} course{report.granted_courses === 1 ? '' : 's'} granted each</Badge>
        </div>
        <p className="mb-3 text-sm text-neutral-600">New students were emailed their sign-in details. Existing students were simply added.</p>
        {attention.length > 0 && (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {attention.map((r) => (
              <div key={r.email} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <div className="font-medium">{r.email}</div>
                {r.note && <div className="text-xs">{r.note}</div>}
                {r.temp_password && (
                  <div className="text-xs">
                    The email could not be sent. Temporary password: <span className="font-mono font-semibold">{r.temp_password}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Add people by email" wide>
      <p className="mb-3 text-xs text-neutral-500">
        No registration form needed. Type or paste one person per line, as <span className="font-mono">email</span> or{' '}
        <span className="font-mono">email, name</span>. Existing students are reused; new emails get an account and a temporary password by email.
      </p>
      <TextArea
        rows={6}
        placeholder={'asha@example.com, Asha Rao\nravi@example.com'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-1 text-xs text-neutral-400">{people.length} {people.length === 1 ? 'person' : 'people'}</div>

      <div className="mt-4 text-sm font-medium text-neutral-800">Add them to these groups (batches)</div>
      {!groups.length ? (
        <p className="mt-1 text-sm text-neutral-500">No course groups yet. Create one first, or pick courses below.</p>
      ) : (
        <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id} className="rounded-xl border border-white/60 bg-white/40 px-3 py-2">
              <Checkbox label={g.name} checked={groupIds.has(g.id)} onChange={(e) => toggle(groupIds, g.id, e.target.checked, setGroupIds)} />
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={() => setShowCourses((v) => !v)} className="mt-4 text-sm font-medium text-blue-600 hover:underline">
        {showCourses ? 'Hide' : 'Also give'} individual courses{courseIds.size ? ` (${courseIds.size})` : ''}
      </button>
      {showCourses && (
        <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
          {courses.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/60 bg-white/40 px-3 py-2">
              <Checkbox label={c.title} checked={courseIds.has(c.id)} onChange={(e) => toggle(courseIds, c.id, e.target.checked, setCourseIds)} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Adding…' : `Add ${people.length || ''} ${people.length === 1 ? 'person' : 'people'}`.replace('  ', ' ')}
        </Button>
      </div>
    </Modal>
  );
}
