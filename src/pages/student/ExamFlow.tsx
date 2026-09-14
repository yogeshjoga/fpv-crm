import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Maximize, XCircle } from 'lucide-react';
import { invokeFn } from '../../lib/functions';
import { GlassCard } from '../../components/ui/shared';
import { Button, Spinner } from '../../components/ui/kit';

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
  questions: { id: string; prompt: string; type: 'single' | 'multi'; options: { id: string; label: string }[] }[];
}
interface SubmitResponse {
  score_pct: number;
  passed: boolean;
  grade_label?: string | null;
  correct_count: number;
  total: number;
  cert_id_string?: string;
  cooldown_until?: string;
  locked?: boolean;
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
    return (
      <GlassCard className="mx-auto max-w-lg p-8 text-center">
        {result.passed ? <CheckCircle2 className="mx-auto text-green-500" size={44} /> : <XCircle className="mx-auto text-red-500" size={44} />}
        <h2 className="mt-3 text-2xl font-semibold text-neutral-900">{result.passed ? 'You passed!' : 'Not this time'}</h2>
        <p className="mt-1 text-neutral-600">
          Score <span className="font-semibold text-neutral-900">{Number(result.score_pct)}%</span> — {result.correct_count}/{result.total} correct
        </p>
        {result.grade_label && (
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
        {!result.passed && (
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

  return (
    <div className="mx-auto max-w-3xl">
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
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-neutral-500">
          Question {current + 1} of {exam.questions.length} · {answeredCount} answered
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${remaining < 60 ? 'bg-red-100 text-red-700' : 'bg-white/70 text-neutral-700'}`}>
          <Clock size={15} /> {mmss}
        </div>
      </div>

      <GlassCard className="p-6">
        <p className="text-lg font-medium text-neutral-900">{q.prompt}</p>
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
        <Button variant="secondary" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
          <ChevronLeft size={16} /> Prev
        </Button>
        {current < exam.questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)}>
            Next <ChevronRight size={16} />
          </Button>
        ) : (
          <Button onClick={() => doSubmit(false)} loading={submitting}>
            Submit exam
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {exam.questions.map((qq, i) => (
          <button
            key={qq.id}
            onClick={() => setCurrent(i)}
            className={`h-8 w-8 rounded-lg text-xs font-medium ${
              i === current ? 'bg-[#1a1a1a] text-white' : (answers[qq.id] ?? []).length ? 'bg-blue-100 text-blue-700' : 'bg-white/60 text-neutral-500'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
