import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, FileText, GraduationCap, Lock, PlayCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, PageHeader, Spinner, useToast } from '../../components/ui/kit';

export function CourseViewer() {
  const { slug } = useParams();
  const toast = useToast();

  const q = useQuery(async () => {
    const course = (await unwrap(
      supabase
        .from('courses')
        .select(
          'id, title, slug, description, pass_pct, exam_time_limit_min, exam_question_count, max_attempts, cooldown_hours, ' +
            'modules(id, title, position, lessons(id, title, position, content, video_url, lesson_resources(id, file_name, file_path, mime)))',
        )
        .eq('slug', slug as string)
        .single(),
    )) as any;

    const [enrollment, attempts, cert] = await Promise.all([
      unwrap(supabase.from('enrollments').select('id, status').eq('course_id', course.id).maybeSingle()) as Promise<any>,
      unwrap(supabase.from('exam_attempts').select('*').eq('course_id', course.id).order('attempt_no', { ascending: false })) as Promise<any[]>,
      unwrap(supabase.from('certificates').select('id, cert_id_string').eq('course_id', course.id).eq('revoked', false).maybeSingle()) as Promise<any>,
    ]);
    return { course, enrollment, attempts, cert };
  }, [slug]);

  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (path: string, name: string) => {
    setDownloading(path);
    const { data, error } = await supabase.storage.from('course-resources').createSignedUrl(path, 120);
    setDownloading(null);
    if (error || !data) return toast('Could not open that file', 'error');
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = name;
    a.target = '_blank';
    a.click();
  };

  if (q.loading) return <Spinner />;
  if (q.error) return <p className="text-sm text-red-600">{q.error}</p>;

  const { course, enrollment, attempts, cert } = q.data!;
  const modules = [...(course.modules ?? [])].sort((a: any, b: any) => a.position - b.position);

  const latest = attempts[0];
  const attemptsUsed = attempts.filter((a: any) => a.status !== 'in_progress').length;
  const bestScore = attempts.reduce((m: number, a: any) => Math.max(m, Number(a.score_pct ?? 0)), 0);
  const locked = latest?.locked;
  const cooldownActive = latest?.cooldown_until && new Date(latest.cooldown_until) > new Date();
  const canStart =
    enrollment?.status === 'active' && !cert && !locked && !cooldownActive && attemptsUsed < course.max_attempts;

  return (
    <div>
      <PageHeader
        title={course.title}
        actions={enrollment ? <Badge tone={enrollment.status === 'completed' ? 'green' : 'blue'}>{enrollment.status}</Badge> : <Badge tone="red">not enrolled</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {course.description && (
            <GlassCard className="p-5 text-sm leading-relaxed text-neutral-600 whitespace-pre-wrap">{course.description}</GlassCard>
          )}
          {modules.map((m: any, mi: number) => {
            const lessons = [...(m.lessons ?? [])].sort((a: any, b: any) => a.position - b.position);
            return (
              <GlassCard key={m.id} className="p-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Module {mi + 1}</div>
                <div className="text-lg font-semibold text-neutral-900">{m.title}</div>
                <div className="mt-4 space-y-4">
                  {lessons.map((l: any, li: number) => (
                    <div key={l.id} className="rounded-2xl border border-white/60 bg-white/40 p-4">
                      <div className="flex items-center gap-2 font-medium text-neutral-900">
                        <span className="text-neutral-400">{mi + 1}.{li + 1}</span> {l.title}
                      </div>
                      {l.content && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{l.content}</p>}
                      {l.video_url && (
                        <a href={l.video_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                          <PlayCircle size={15} /> Watch video
                        </a>
                      )}
                      {!!l.lesson_resources?.length && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {l.lesson_resources.map((r: any) => (
                            <button
                              key={r.id}
                              onClick={() => download(r.file_path, r.file_name)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-white"
                            >
                              {downloading === r.file_path ? '…' : <FileText size={13} />} {r.file_name}
                              <Download size={12} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {!lessons.length && <p className="text-sm text-neutral-400">No lessons yet.</p>}
                </div>
              </GlassCard>
            );
          })}
          {!modules.length && <p className="text-sm text-neutral-400">Course content is being prepared.</p>}
        </div>

        {/* exam panel */}
        <div>
          <GlassCard className="sticky top-6 p-5">
            <div className="flex items-center gap-2 font-semibold text-neutral-900">
              <GraduationCap size={18} /> Final exam
            </div>
            <dl className="mt-4 space-y-1.5 text-sm">
              <Row k="Questions" v={course.exam_question_count} />
              <Row k="Time limit" v={`${course.exam_time_limit_min} min`} />
              <Row k="Pass mark" v={`${course.pass_pct}%`} />
              <Row k="Attempts" v={`${attemptsUsed} / ${course.max_attempts}`} />
              {bestScore > 0 && <Row k="Best score" v={`${bestScore}%`} />}
            </dl>

            <div className="mt-4">
              {cert ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  Passed 🎉 —{' '}
                  <Link to="/app/certificates" className="font-medium underline">
                    view certificate
                  </Link>
                </div>
              ) : locked ? (
                <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <Lock size={15} /> Attempts exhausted. Ask an instructor to reset.
                </div>
              ) : cooldownActive ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Next attempt available {new Date(latest.cooldown_until).toLocaleString()}
                </div>
              ) : canStart ? (
                <Link to={`/app/courses/${course.slug}/exam`}>
                  <Button className="w-full">Start exam</Button>
                </Link>
              ) : (
                <p className="text-sm text-neutral-500">
                  {enrollment?.status === 'active' ? 'Exam unavailable right now.' : 'Enroll to unlock the exam.'}
                </p>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{k}</span>
      <span className="font-medium text-neutral-900">{v}</span>
    </div>
  );
}
