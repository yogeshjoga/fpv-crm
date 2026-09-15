import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Download, FileText, GraduationCap, Lock, PlayCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { useCourseTimeTracker } from '../../lib/useTimeTracker';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, PageHeader, Spinner, useToast } from '../../components/ui/kit';

/** Convert common video URLs to an embeddable src; null if we can't. */
function embedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v'))
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes('vimeo.com')) return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean).pop()}`;
    return null;
  } catch {
    return null;
  }
}

interface ContentBlock {
  type: 'section' | 'list' | 'callout' | 'paragraph';
  key: number;
  title?: string;
  subtitle?: string | null;
  body?: string;
  heading?: string | null;
  items?: string[];
  pipeStyle?: boolean;
  label?: string;
  text?: string;
}

/**
 * Lesson content is authored as plain text with a lightweight convention rather
 * than markdown/HTML: "-- Title - Subtitle --" or "=== Title - Subtitle ==="
 * section headers, a "Heading" line followed by "* item" bullets (or a single
 * "Key value | Key value" line), and a "Label -- warning text" or "! warning
 * text" callout. This turns that into styled blocks instead of printing the
 * raw markers verbatim.
 */
/** Tidies the plain-text " -- " aside convention into a real em dash for display. */
const tidy = (s: string) => s.replace(/ -- /g, ' — ');

function parseLessonContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  content.split(/\n\s*\n/).forEach((raw, i) => {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;

    const headerMatch = lines[0].match(/^(?:--|===)\s*(.+?)\s*(?:--|===)$/);
    if (headerMatch) {
      const titleLine = headerMatch[1];
      const split = titleLine.match(/^(.+?)\s-\s(.+)$/);
      blocks.push({
        type: 'section',
        key: i,
        title: split ? split[1] : titleLine,
        subtitle: split ? split[2] : null,
        body: tidy(lines.slice(1).join(' ')),
      });
      return;
    }

    const bulletLines = lines.filter((l) => l.startsWith('*'));
    if (bulletLines.length && bulletLines.length >= lines.length - 1) {
      const heading = lines[0].startsWith('*') ? null : lines[0];
      const items = (heading ? lines.slice(1) : lines).map((l) => tidy(l.replace(/^\*\s*/, '')));
      blocks.push({ type: 'list', key: i, heading, items });
      return;
    }
    if (lines.length === 1 && lines[0].includes(' | ')) {
      blocks.push({ type: 'list', key: i, heading: null, items: lines[0].split('|').map((s) => tidy(s.trim())), pipeStyle: true });
      return;
    }

    const bangMatch = raw.match(/^!\s*([\s\S]+)$/);
    if (bangMatch) {
      blocks.push({ type: 'callout', key: i, label: 'Watch out', text: tidy(bangMatch[1].trim()) });
      return;
    }
    const calloutMatch = raw.match(/^([A-Za-z][A-Za-z ]{1,20}?)\s--\s([\s\S]+)$/);
    if (calloutMatch) {
      blocks.push({ type: 'callout', key: i, label: calloutMatch[1], text: tidy(calloutMatch[2].trim()) });
      return;
    }

    blocks.push({ type: 'paragraph', key: i, text: tidy(lines.join(' ')) });
  });
  return blocks;
}

/** "Key: value" (or, for a pipe-separated spec line, "Key value") -> [key, rest]; [null, item] if there's no key. */
function splitKV(item: string, pipeStyle?: boolean): [string | null, string] {
  if (pipeStyle) {
    const idx = item.indexOf(' ');
    return idx > -1 ? [item.slice(0, idx), item.slice(idx + 1)] : [null, item];
  }
  const idx = item.indexOf(': ');
  return idx > -1 && idx < 30 ? [item.slice(0, idx), item.slice(idx + 2)] : [null, item];
}

function LessonContent({ content }: { content: string }) {
  const blocks = useMemo(() => parseLessonContent(content), [content]);
  return (
    <div className="mt-2 space-y-3 text-sm text-neutral-600">
      {blocks.map((b) => {
        if (b.type === 'paragraph') return <p key={b.key}>{b.text}</p>;
        if (b.type === 'section')
          return (
            <div key={b.key} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-neutral-900">{b.title}</span>
                {b.subtitle && <Badge tone="blue">{b.subtitle}</Badge>}
              </div>
              <p className="mt-1.5">{b.body}</p>
            </div>
          );
        if (b.type === 'list')
          return (
            <div key={b.key}>
              {b.heading && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">{b.heading}</div>}
              <ul className="space-y-1">
                {b.items!.map((item, idx) => {
                  const [k, v] = splitKV(item, b.pipeStyle);
                  return (
                    <li key={idx} className="flex gap-1.5 pl-1">
                      <span className="text-neutral-300">•</span>
                      <span>
                        {k ? (
                          <>
                            <strong className="font-medium text-neutral-800">{k}:</strong> {v}
                          </>
                        ) : (
                          v
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        if (b.type === 'callout')
          return (
            <div key={b.key} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <p>
                <strong>{b.label}.</strong> {b.text}
              </p>
            </div>
          );
        return null;
      })}
    </div>
  );
}

/** Inline image preview for a lesson resource stored in course-resources. */
function ImageResource({ path, name }: { path: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    supabase.storage.from('course-resources').createSignedUrl(path, 600).then(({ data }) => live && setUrl(data?.signedUrl ?? null));
    return () => {
      live = false;
    };
  }, [path]);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={name} className="max-h-48 rounded-xl border border-white/60 object-contain" />
    </a>
  );
}

export function CourseViewer() {
  const { slug } = useParams();
  const { profile } = useAuth();
  const toast = useToast();
  const uid = profile?.id ?? '';

  const q = useQuery(async () => {
    const course = (await unwrap(
      supabase
        .from('courses')
        .select(
          'id, title, slug, description, pass_pct, exam_time_limit_min, exam_question_count, max_attempts, cooldown_hours, ' +
            'modules(id, title, position, lessons(id, title, position, kind, content, video_url, embed_url, lesson_resources(id, file_name, file_path, mime)))',
        )
        .eq('slug', slug as string)
        .single(),
    )) as any;

    // Scope to the current user explicitly: staff RLS on these tables returns
    // every student's rows, which would break the .maybeSingle() calls and
    // pollute attempt counts when a staff account uses the student view.
    const [enrollment, attempts, cert] = await Promise.all([
      unwrap(supabase.from('enrollments').select('id, status').eq('course_id', course.id).eq('student_id', uid).maybeSingle()) as Promise<any>,
      unwrap(supabase.from('exam_attempts').select('*').eq('course_id', course.id).eq('student_id', uid).order('attempt_no', { ascending: false })) as Promise<any[]>,
      unwrap(supabase.from('certificates').select('id, cert_id_string').eq('course_id', course.id).eq('student_id', uid).eq('revoked', false).maybeSingle()) as Promise<any>,
    ]);
    return { course, enrollment, attempts, cert };
  }, [slug, uid]);

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

  // Only track time while the student actually has access — call unconditionally
  // (before the early returns below) since hooks can't be called conditionally.
  const trackedEnrollment = q.data?.enrollment?.status;
  useCourseTimeTracker(
    trackedEnrollment === 'active' || trackedEnrollment === 'completed' ? q.data?.course?.id : null,
  );

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
  const hasAccess = enrollment?.status === 'active' || enrollment?.status === 'completed';

  return (
    <div>
      <PageHeader
        title={course.title}
        actions={enrollment ? <Badge tone={enrollment.status === 'completed' ? 'green' : 'blue'}>{enrollment.status}</Badge> : <Badge tone="red">not enrolled</Badge>}
      />

      {!hasAccess ? (
        <GlassCard className="flex flex-col items-center gap-3 p-10 text-center">
          <Lock size={26} className="text-neutral-400" />
          <div className="text-lg font-semibold text-neutral-900">You don't have access to this course</div>
          <p className="max-w-sm text-sm text-neutral-500">
            {enrollment?.status === 'revoked'
              ? 'Your enrollment in this course was revoked. Contact an administrator if you think this is a mistake.'
              : 'An administrator needs to enroll you before you can view the lessons and take the exam.'}
          </p>
          <Link to="/app/courses" className="mt-1 text-sm font-medium text-blue-600 hover:underline">
            Back to catalog
          </Link>
        </GlassCard>
      ) : (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {course.description && (
            <GlassCard className="p-5">
              <LessonContent content={course.description} />
            </GlassCard>
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

                      {(l.kind ?? 'article') === 'article' && l.content && <LessonContent content={l.content} />}

                      {l.kind === 'video' && l.video_url && (
                        embedSrc(l.video_url) ? (
                          <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-white/60">
                            <iframe src={embedSrc(l.video_url)!} className="h-full w-full" allowFullScreen title={l.title} />
                          </div>
                        ) : (
                          <a href={l.video_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                            <PlayCircle size={15} /> Watch video
                          </a>
                        )
                      )}

                      {l.kind === 'embed' && l.embed_url && (
                        <div className="mt-3 h-[75vh] min-h-[520px] overflow-hidden rounded-xl border border-white/60">
                          <iframe
                            src={l.embed_url}
                            className="h-full w-full"
                            allowFullScreen
                            title={l.title}
                            allow="fullscreen; accelerometer; gyroscope"
                          />
                        </div>
                      )}

                      {!!l.lesson_resources?.length && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {l.lesson_resources.map((r: any) =>
                            (r.mime ?? '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(r.file_name) ? (
                              <ImageResource key={r.id} path={r.file_path} name={r.file_name} />
                            ) : (
                              <button
                                key={r.id}
                                onClick={() => download(r.file_path, r.file_name)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-white"
                              >
                                {downloading === r.file_path ? '…' : <FileText size={13} />} {r.file_name}
                                <Download size={12} />
                              </button>
                            ),
                          )}
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
      )}
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
