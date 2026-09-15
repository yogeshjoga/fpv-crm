import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Eye, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, EmptyState, PageHeader, Spinner, useToast } from '../../components/ui/kit';

interface Course {
  id: string;
  slug: string;
  title: string;
  summary: string;
  cover_image_url: string | null;
}

export function CourseCatalog() {
  const { profile, isStaff } = useAuth();
  const toast = useToast();
  const uid = profile?.id ?? '';
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery(async () => {
    // enrollments / requests are scoped to the current user explicitly — staff
    // RLS would otherwise return every student's rows and mislabel course cards.
    const [courses, enrollments, requests, forms] = await Promise.all([
      unwrap(supabase.from('courses').select('id, slug, title, summary, cover_image_url').eq('status', 'published').order('title')) as Promise<Course[]>,
      unwrap(supabase.from('enrollments').select('course_id, status').eq('student_id', uid)) as Promise<{ course_id: string; status: string }[]>,
      unwrap(supabase.from('enrollment_requests').select('course_id, status').eq('student_id', uid)) as Promise<{ course_id: string; status: string }[]>,
      unwrap(supabase.from('enrollment_forms').select('course_id, slug').eq('is_open', true)) as Promise<{ course_id: string; slug: string }[]>,
    ]);
    return { courses, enrollments, requests, forms };
  }, [uid]);

  if (q.loading) return <Spinner />;
  if (q.error) return <p className="text-sm text-red-600">{q.error}</p>;

  const { courses, enrollments, requests, forms } = q.data!;

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
      <PageHeader title="Course catalog" subtitle="Published FPV & drone training courses" />
      {!courses.length ? (
        <EmptyState icon={<BookOpen size={22} />} title="No published courses yet" description="Check back soon." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => {
            const enrolled = enrollments.find((e) => e.course_id === c.id);
            const requested = requests.find((r) => r.course_id === c.id && r.status === 'pending');
            const form = forms.find((f) => f.course_id === c.id);

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
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  {enrolled ? (
                    <Link to={`/app/courses/${c.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                      Open course <ArrowRight size={14} />
                    </Link>
                  ) : isStaff ? (
                    <button
                      onClick={() => startPreview(c.id)}
                      disabled={busy === c.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-white disabled:opacity-50"
                    >
                      <Eye size={13} /> {busy === c.id ? 'Starting…' : 'Preview as student'}
                    </button>
                  ) : requested ? (
                    <Badge tone="amber">Enrollment pending review</Badge>
                  ) : form ? (
                    <Link to={`/enroll/${form.slug}`} className="inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white">
                      Enroll <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-neutral-400">
                      <Lock size={14} /> Enrollment closed
                    </span>
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
