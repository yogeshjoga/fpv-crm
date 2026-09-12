import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, EmptyState, PageHeader, Spinner } from '../../components/ui/kit';

interface Course {
  id: string;
  slug: string;
  title: string;
  summary: string;
  cover_image_url: string | null;
}

export function CourseCatalog() {
  const { profile } = useAuth();
  const uid = profile?.id ?? '';
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
                <div className="mt-4">
                  {enrolled ? (
                    <Link to={`/app/courses/${c.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                      Open course <ArrowRight size={14} />
                    </Link>
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
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
