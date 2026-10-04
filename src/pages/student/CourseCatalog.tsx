import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { EmptyState, PageHeader, Spinner, useToast } from '../../components/ui/kit';
import { ExamStatusPill, examStillRelevant, useNow, type ExamScheduleCourse } from '../../components/ExamCountdown';

interface Course extends ExamScheduleCourse {
  summary: string;
  cover_image_url: string | null;
}

/**
 * Students see only the courses they are enrolled in — the database enforces this too
 * (courses RLS), so a student cannot list the rest of the catalog even by calling the API.
 * Staff see every published course and can preview one as a student.
 */
export function CourseCatalog() {
  const { profile, isStaff } = useAuth();
  const toast = useToast();
  const uid = profile?.id ?? '';
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery(async () => {
    // Scoped to the current user explicitly — staff RLS would otherwise return every
    // student's enrollments and mislabel course cards.
    const [courses, enrollments, certs, attempts] = await Promise.all([
      unwrap(
        supabase
          .from('courses')
          .select('id, slug, title, summary, cover_image_url, max_attempts, exam_name, exam_access, exam_opens_at, exam_closes_at, exam_time_limit_min')
          .eq('status', 'published')
          .order('title'),
      ) as Promise<Course[]>,
      unwrap(supabase.from('enrollments').select('course_id, status, extra_attempts').eq('student_id', uid)) as Promise<{ course_id: string; status: string; extra_attempts: number }[]>,
      unwrap(supabase.from('certificates').select('course_id').eq('student_id', uid).eq('revoked', false)) as Promise<{ course_id: string }[]>,
      unwrap(supabase.from('exam_attempts').select('course_id, status').eq('student_id', uid)) as Promise<{ course_id: string; status: string }[]>,
    ]);
    const finishedAttempts: Record<string, number> = {};
    for (const a of attempts) if (a.status !== 'in_progress') finishedAttempts[a.course_id] = (finishedAttempts[a.course_id] ?? 0) + 1;
    return { courses, enrollments, done: { certCourseIds: certs.map((c) => c.course_id), finishedAttempts } };
  }, [uid]);

  const now = useNow(30_000);
  if (q.loading) return <Spinner />;
  if (q.error) return <p className="text-sm text-red-600">{q.error}</p>;

  const { courses, enrollments, done } = q.data!;
  const isEnrolled = (courseId: string) => enrollments.some((e) => e.course_id === courseId && e.status !== 'revoked');
  const visible = isStaff ? courses : courses.filter((c) => isEnrolled(c.id));

  const startPreview = async (courseId: string) => {
    setBusy(courseId);
    const { error } = await supabase
      .from('enrollments')
      .upsert({ student_id: uid, course_id: courseId, status: 'active', enrolled_by: uid }, { onConflict: 'student_id,course_id' });
    setBusy(null);
    if (error) return toast(error.message, 'error');
    q.refetch();
  };

  const endPreview = async (courseId: string) => {
    setBusy(courseId);
    const { error } = await supabase.from('enrollments').update({ status: 'revoked' }).match({ student_id: uid, course_id: courseId });
    setBusy(null);
    if (error) return toast(error.message, 'error');
    toast('Preview ended');
    q.refetch();
  };

  return (
    <div>
      <PageHeader
        title={isStaff ? 'Course catalog' : 'My courses'}
        subtitle={isStaff ? 'Published FPV & drone training courses' : 'The courses you are enrolled in'}
      />
      {!visible.length ? (
        <EmptyState
          icon={<BookOpen size={22} />}
          title={isStaff ? 'No published courses yet' : "You aren't enrolled in a course yet"}
          description={isStaff ? 'Check back soon.' : 'Once your instructor enrolls you, your courses will appear here.'}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const enrolled = isEnrolled(c.id);

            return (
              <GlassCard key={c.id} className="flex flex-col p-5">
                <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100">
                  {c.cover_image_url ? (
                    <img src={c.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <BookOpen className="text-blue-400" size={32} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-neutral-900">{c.title}</div>
                  <p className="mt-1 line-clamp-3 text-sm text-neutral-500">{c.summary}</p>
                  {enrolled && examStillRelevant({ ...c, max_attempts: c.max_attempts! + (enrollments.find((e) => e.course_id === c.id)?.extra_attempts ?? 0) }, now, done) && <ExamStatusPill course={c} />}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  {enrolled ? (
                    <Link to={`/app/courses/${c.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                      Open course <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <button
                      onClick={() => startPreview(c.id)}
                      disabled={busy === c.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-white disabled:opacity-50"
                    >
                      <Eye size={13} /> {busy === c.id ? 'Starting…' : 'Preview as student'}
                    </button>
                  )}
                  {enrolled && isStaff && (
                    <button
                      onClick={() => endPreview(c.id)}
                      disabled={busy === c.id}
                      className="text-xs text-neutral-400 hover:text-red-500 disabled:opacity-50"
                    >
                      End preview
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
