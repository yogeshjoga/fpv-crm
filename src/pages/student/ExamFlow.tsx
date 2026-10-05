import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, ListChecks, Lock, Maximize, X, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { invokeFn } from '../../lib/functions';
import { GlassCard } from '../../components/ui/shared';
import { Button, Modal, Spinner, useToast } from '../../components/ui/kit';
import { useAuth } from '../../auth/AuthProvider';
import { downloadReviewPdf } from '../../lib/reviewPdf';
import { ExamReviewList } from '../../components/ExamReviewList';

function isFullscreenActive() {
  return !!document.fullscreenElement;
}

async function enterFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {
    // ignore — some browsers/contexts (e.g. embedded iframes) block fullscreen; the overlay will just keep prompting
  }
}

function exitFullscreen() {
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
  if (!isFullscreenActive()) return;
  (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())?.catch?.(() => {});
}

interface StartResponse {
  attempt_id: string;
  expires_at: string;
  time_limit_min: number;
  allow_backtrack: boolean;
  questions: { id: string; prompt: string; type: 'single' | 'multi'; options: { id: string; label: string }[] }[];
}
interface ReviewItem {
  question_id: string;
  prompt: string;
  type: 'single' | 'multi';
  your_answers: string[];
  correct_answers: string[];
  explanation: string;
}
interface SubmitResponse {
  score_pct: number;
  passed: boolean;
  grade_label?: string | null;
  correct_count: number;
  wrong_count?: number;
  review?: ReviewItem[];
  total: number;
  cert_id_string?: string;
  /** Passed, but an admin issues the certificate later. */
  certificate_pending?: boolean;
  cooldown_until?: string;
  locked?: boolean;
  /** Composite courses: the online exam is one part of a 100-mark assessment. */
  composite?: boolean;
  exam_marks?: number;
  exam_max?: number;
}

type Phase = 'loading' | 'error' | 'ready' | 'exam' | 'result';

export function ExamFlow() {
  const { slug } = useParams();
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [exam, setExam] = useState<StartResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [fullscreen, setFullscreen] = useState(isFullscreenActive());
  const submittedRef = useRef(false);
  const startedRef = useRef(false);
  // Composite exams: the online exam is one module with its own pass mark, shown on the result.
  const [onlinePass, setOnlinePass] = useState<number | null>(null);
  const toast = useToast();
  const { profile } = useAuth();
  const [courseTitle, setCourseTitle] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [navOpen, setNavOpen] = useState(false); // question list drawer on small screens
  useEffect(() => {
    if (!result && !exam) return;
    supabase
      .from('courses')
      .select('title')
      .eq('slug', slug as string)
      .maybeSingle()
      .then(({ data }) => setCourseTitle(data?.title ?? ''));
  }, [result, exam, slug]);

  // keep the current question visible in the question list
  useEffect(() => {
    if (phase !== 'exam') return;
    document.getElementById(`qnav-${current}`)?.scrollIntoView({ block: 'nearest' });
  }, [current, phase]);
  useEffect(() => {
    if (!result?.composite) return;
    supabase
      .from('courses')
      .select('pass_marks_online')
      .eq('slug', slug as string)
      .maybeSingle()
      .then(({ data }) => setOnlinePass(data ? Number(data.pass_marks_online) : null));
  }, [result?.composite, slug]);

  // start (guarded against React 18 StrictMode double-invoke)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    invokeFn<StartResponse>('start-exam', { course_slug: slug })
      .then((data) => {
        setExam(data);
        setPhase('ready');
      })
      .catch((e) => {
        setErrorMsg(e.message);
        setPhase('error');
      });
  }, [slug]);

  // track fullscreen state throughout the exam, and always release it once the exam is over
  useEffect(() => {
    const onChange = () => setFullscreen(isFullscreenActive());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);
  useEffect(() => {
    if (phase === 'result' || phase === 'error') exitFullscreen();
  }, [phase]);
  useEffect(() => () => exitFullscreen(), []);

  const beginExam = useCallback(async () => {
    await enterFullscreen();
    setPhase('exam');
  }, []);

  const doSubmit = useCallback(
    async (auto = false) => {
      if (submittedRef.current || !exam) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const payload = {
          attempt_id: exam.attempt_id,
          answers: exam.questions.map((q) => ({ question_id: q.id, selected_option_ids: answers[q.id] ?? [] })),
        };
        const res = await invokeFn<SubmitResponse>('submit-exam', payload);
        setResult(res);
        setPhase('result');
      } catch (e) {
        setErrorMsg((auto ? 'Auto-submit failed: ' : '') + (e as Error).message);
        setPhase('error');
      } finally {
        setSubmitting(false);
      }
    },
    [exam, answers],
  );

  // countdown
  useEffect(() => {
    if (phase !== 'exam' || !exam) return;
    const tick = () => {
      const ms = new Date(exam.expires_at).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
      if (ms <= 0) doSubmit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, exam, doSubmit]);

  const mmss = useMemo(() => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [remaining]);

  if (phase === 'loading') return <Spinner label="Preparing your exam…" />;

  if (phase === 'error') {
    return (
      <GlassCard className="mx-auto max-w-lg p-8 text-center">
        <AlertTriangle className="mx-auto text-amber-500" size={36} />
        <h2 className="mt-3 text-lg font-semibold text-neutral-900">Can’t start the exam</h2>
        <p className="mt-2 text-sm text-neutral-600">{errorMsg}</p>
        <Link to={`/app/courses/${slug}`} className="mt-5 inline-block text-sm font-medium text-blue-600 hover:underline">
          Back to course
        </Link>
      </GlassCard>
    );
  }

  if (phase === 'ready' && exam) {
    return (
      <GlassCard className="mx-auto max-w-lg p-8 text-center">
        <Maximize className="mx-auto text-neutral-700" size={36} />
        <h2 className="mt-3 text-lg font-semibold text-neutral-900">Ready to begin</h2>
        <p className="mt-2 text-sm text-neutral-600">
          {exam.questions.length} questions · {exam.time_limit_min} minutes. This exam must be taken in fullscreen — if
          you exit fullscreen at any point, the exam will pause until you return.
          {!exam.allow_backtrack && ' Once you move past a question you cannot return to it, so answer carefully before advancing.'}
        </p>
        <Button className="mt-5" onClick={beginExam}>
          <Maximize size={16} /> Enter fullscreen &amp; start
        </Button>
        <Link to={`/app/courses/${slug}`} className="mt-4 block text-sm font-medium text-blue-600 hover:underline">
          Back to course
        </Link>
      </GlassCard>
    );
  }

  if (phase === 'result' && result) {
    const wrongCount = result.wrong_count ?? result.total - result.correct_count;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
      <GlassCard className="mx-auto max-w-lg p-8 text-center">
        {result.composite ? (
          <CheckCircle2 className="mx-auto text-blue-500" size={44} />
        ) : result.passed ? (
          <CheckCircle2 className="mx-auto text-green-500" size={44} />
        ) : (
          <XCircle className="mx-auto text-red-500" size={44} />
        )}
        <h2 className="mt-3 text-2xl font-semibold text-neutral-900">{result.composite ? 'Exam submitted' : result.passed ? 'You passed!' : 'Not this time'}</h2>
        <p className="mt-1 text-neutral-600">
          Score <span className="font-semibold text-neutral-900">{Number(result.score_pct)}%</span> — {result.correct_count}/{result.total} correct
          {wrongCount > 0 && (
            <>
              {' '}
              · <span className="font-semibold text-red-600">{wrongCount} wrong</span>
            </>
          )}
        </p>
        {result.composite && result.exam_marks !== undefined && (
          <p className="mt-3 text-lg text-neutral-700">
            Online exam marks: <span className="font-semibold text-neutral-900">{result.exam_marks} / {result.exam_max}</span>
          </p>
        )}
        {result.grade_label && !result.composite && (
          <p className="mt-2">
            <span
              className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                result.grade_label === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {result.grade_label}
            </span>
          </p>
        )}

        {result.passed && result.cert_id_string && (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Certificate <span className="font-mono font-semibold">{result.cert_id_string}</span> issued and emailed to you.
            <div className="mt-2">
              <Link to="/app/certificates" className="font-medium underline">
                View your certificates
              </Link>
            </div>
          </div>
        )}
        {result.passed && !result.composite && !result.cert_id_string && result.certificate_pending && (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Well done. Your certificate will be issued by your instructors, and you will be notified when it is ready.
          </div>
        )}
        {result.composite && (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left text-sm text-blue-900">
            {onlinePass !== null && result.exam_marks !== undefined && (
              <p className={`mb-2 font-semibold ${result.exam_marks + 1e-9 >= onlinePass ? 'text-green-700' : 'text-red-700'}`}>
                Online exam pass mark: {onlinePass} — {result.exam_marks + 1e-9 >= onlinePass ? 'you cleared this module ✓' : 'not cleared in this module'}
              </p>
            )}
            This was your one attempt. To clear the assessment you need the pass mark in every module — online exam, viva, simulation and free flight — so a
            high score in one cannot make up for missing another. Your instructors will finalise your report card and email your certificate.
          </div>
        )}
        {!result.composite && !result.passed && (
          <p className="mt-4 text-sm text-neutral-500">
            {result.locked
              ? 'You have used all attempts. An instructor can reset your exam.'
              : result.cooldown_until
                ? `You can retry after ${new Date(result.cooldown_until).toLocaleString()}.`
                : 'You may retry from the course page.'}
          </p>
        )}
        <Link to={`/app/courses/${slug}`} className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline">
          Back to course
        </Link>
      </GlassCard>

      {result.review && result.review.length > 0 && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-neutral-900">Review your {result.review.length} wrong {result.review.length === 1 ? 'answer' : 'answers'}</h3>
            <Button
              variant="secondary"
              loading={pdfBusy}
              onClick={async () => {
                setPdfBusy(true);
                try {
                  await downloadReviewPdf({
                    studentName: profile?.full_name || profile?.email || 'Student',
                    courseTitle: courseTitle || 'Online exam',
                    summary: `Score ${Number(result.score_pct)}% - ${result.correct_count}/${result.total} correct - ${wrongCount} wrong`,
                    items: result.review!,
                  });
                } catch (e) {
                  toast((e as Error).message || 'Could not create the PDF', 'error');
                } finally {
                  setPdfBusy(false);
                }
              }}
            >
              <Download size={15} /> Download PDF
            </Button>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Read the correct answer and the explanation for each question below — this is how you learn each topic{result.composite ? '.' : ' before your next attempt.'}{' '}
            A copy is saved: open the course page any time and choose “Wrong answers” under Your attempts.
          </p>
          <div className="mt-4">
            <ExamReviewList items={result.review} />
          </div>
        </section>
      )}
      </div>
    );
  }

  // exam
  if (!exam) return null;
  const q = exam.questions[current];
  const selected = answers[q.id] ?? [];
  const answeredCount = exam.questions.filter((qq) => (answers[qq.id] ?? []).length > 0).length;

  const toggle = (optId: string) => {
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      if (q.type === 'single') return { ...prev, [q.id]: [optId] };
      return { ...prev, [q.id]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
    });
  };

  const unanswered = exam.questions.length - answeredCount;
  const pct = Math.round((answeredCount / exam.questions.length) * 100);

  const questionList = (
    <>
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <ListChecks size={16} /> Questions
        </div>
        <div className="mt-1 text-xs text-neutral-500">
          {answeredCount} of {exam.questions.length} answered
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {exam.questions.map((qq, i) => {
          const locked = !exam.allow_backtrack && i < current;
          const done = (answers[qq.id] ?? []).length > 0;
          const here = i === current;
          return (
            <button
              key={qq.id}
              id={`qnav-${i}`}
              onClick={() => {
                if (locked) return;
                setCurrent(i);
                setNavOpen(false);
              }}
              disabled={locked}
              title={locked ? 'This exam does not allow returning to earlier questions' : undefined}
              className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                here ? 'bg-[#1a1a1a] text-white' : locked ? 'cursor-not-allowed text-neutral-300' : 'text-neutral-700 hover:bg-white/80'
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                  here ? 'bg-white/20 text-white' : done ? 'bg-blue-100 text-blue-700' : locked ? 'bg-neutral-100 text-neutral-300' : 'bg-white text-neutral-500'
                }`}
              >
                {i + 1}
              </span>
              <span className="line-clamp-2 min-w-0 flex-1 text-xs leading-snug">{qq.prompt}</span>
              {locked ? (
                <Lock size={12} className="mt-1 shrink-0" />
              ) : done ? (
                <CheckCircle2 size={14} className={`mt-1 shrink-0 ${here ? 'text-blue-300' : 'text-blue-500'}`} />
              ) : null}
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-br from-blue-50 via-white to-amber-50">
      {!fullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 text-center backdrop-blur-sm">
          <div className="max-w-sm rounded-3xl bg-white p-8">
            <AlertTriangle className="mx-auto text-amber-500" size={36} />
            <h2 className="mt-3 text-lg font-semibold text-neutral-900">Fullscreen required</h2>
            <p className="mt-2 text-sm text-neutral-600">
              You left fullscreen mode. Your exam is paused — the timer keeps running. Return to fullscreen to continue.
            </p>
            <Button className="mt-5" onClick={() => enterFullscreen()}>
              <Maximize size={16} /> Return to fullscreen
            </Button>
          </div>
        </div>
      )}

      {/* top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-white/70 bg-white/70 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setNavOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm md:hidden"
          >
            <ListChecks size={15} /> Questions
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-900">{courseTitle || 'Online exam'}</div>
            <div className="text-xs text-neutral-500">
              Question {current + 1} of {exam.questions.length} · {answeredCount} answered
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ${remaining < 60 ? 'bg-red-100 text-red-700' : 'bg-white text-neutral-700 shadow-sm'}`}>
            <Clock size={15} /> {mmss}
          </div>
          <Button onClick={() => setConfirmSubmit(true)} loading={submitting}>
            Submit exam
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* left: every question, click to jump */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-white/70 bg-white/50 backdrop-blur-xl md:flex">{questionList}</aside>

        {navOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-80 max-w-[85%] flex-col bg-white shadow-2xl">
              <button onClick={() => setNavOpen(false)} className="absolute right-3 top-3 rounded-full p-1 text-neutral-500 hover:bg-neutral-100" aria-label="Close">
                <X size={16} />
              </button>
              {questionList}
            </aside>
          </div>
        )}

        {/* right: the current question */}
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-10">
          <div className="mx-auto max-w-3xl">
            <GlassCard className="p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Question {current + 1}</div>
              <p className="mt-1 text-lg font-medium text-neutral-900">{q.prompt}</p>
              <p className="mt-1 text-xs text-neutral-400">{q.type === 'multi' ? 'Select all that apply' : 'Select one'}</p>
              <div className="mt-4 space-y-2">
                {q.options.map((o) => {
                  const on = selected.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggle(o.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                        on ? 'border-blue-400 bg-blue-50 text-blue-900' : 'border-white/60 bg-white/40 text-neutral-700 hover:bg-white/70'
                      }`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${q.type === 'single' ? 'rounded-full' : 'rounded-md'} ${on ? 'border-blue-500 bg-blue-500 text-white' : 'border-neutral-300'}`}>
                        {on && <CheckCircle2 size={14} />}
                      </span>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </GlassCard>

            <div className="mt-4 flex items-center justify-between">
              {exam.allow_backtrack ? (
                <Button variant="secondary" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
                  <ChevronLeft size={16} /> Prev
                </Button>
              ) : (
                <span />
              )}
              {current < exam.questions.length - 1 ? (
                <Button onClick={() => setCurrent((c) => c + 1)}>
                  Next <ChevronRight size={16} />
                </Button>
              ) : (
                <Button onClick={() => setConfirmSubmit(true)} loading={submitting}>
                  Submit exam
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>

      <Modal open={confirmSubmit} onClose={() => setConfirmSubmit(false)} title="Submit your exam?">
        <p className="text-sm text-neutral-600">
          {unanswered > 0
            ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Unanswered questions count as wrong.`
            : 'You have answered every question.'}{' '}
          {exam.allow_backtrack ? 'You can still go back and change answers before submitting.' : 'Once submitted you cannot change your answers.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmSubmit(false)}>
            Keep working
          </Button>
          <Button
            onClick={() => {
              setConfirmSubmit(false);
              doSubmit(false);
            }}
            loading={submitting}
          >
            Submit now
          </Button>
        </div>
      </Modal>
    </div>
  );
}
