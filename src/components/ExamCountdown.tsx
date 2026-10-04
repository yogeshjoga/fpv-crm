import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Timer } from 'lucide-react';
import { GlassCard } from './ui/shared';
import { Badge } from './ui/kit';

/** Re-renders every second so countdowns tick live. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface ExamScheduleCourse {
  id: string;
  slug: string;
  title: string;
  exam_access: string;
  exam_opens_at: string | null;
  exam_closes_at: string | null;
  exam_time_limit_min: number;
}

/** 'upcoming' (timer to open), 'live' (open now), or null when there is nothing to show. */
export function examPhase(c: ExamScheduleCourse, now: number): 'upcoming' | 'live' | null {
  if (c.exam_access !== 'scheduled') return null;
  const opens = c.exam_opens_at ? new Date(c.exam_opens_at).getTime() : null;
  const closes = c.exam_closes_at ? new Date(c.exam_closes_at).getTime() : null;
  if (opens !== null && now < opens) return 'upcoming';
  if (closes !== null && now >= closes) return null;
  return 'live';
}

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Compact "1d 02:14:33" text, for inline use. */
export function formatRemaining(ms: number) {
  const { d, h, m, s } = split(ms);
  return `${d > 0 ? `${d}d ` : ''}${pad(h)}:${pad(m)}:${pad(s)}`;
}

function Tile({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="flex min-w-[3.6rem] flex-col items-center rounded-2xl bg-white/70 px-3 py-2">
      <span className={`text-2xl font-semibold tabular-nums ${tone}`}>{pad(value)}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</span>
    </div>
  );
}

export function CountdownTiles({ ms, tone = 'text-neutral-900' }: { ms: number; tone?: string }) {
  const { d, h, m, s } = split(ms);
  return (
    <div className="flex items-center gap-2">
      {d > 0 && <Tile value={d} label="days" tone={tone} />}
      <Tile value={h} label="hrs" tone={tone} />
      <Tile value={m} label="min" tone={tone} />
      <Tile value={s} label="sec" tone={tone} />
    </div>
  );
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Dashboard card: exam timings plus a live timer to the opening (or closing) time. */
export function ExamScheduleCard({ course }: { course: ExamScheduleCourse }) {
  const now = useNow();
  const phase = examPhase(course, now);
  if (!phase) return null;

  const opens = course.exam_opens_at ? new Date(course.exam_opens_at).getTime() : null;
  const closes = course.exam_closes_at ? new Date(course.exam_closes_at).getTime() : null;
  const upcoming = phase === 'upcoming';

  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <CalendarClock size={17} className={upcoming ? 'text-amber-500' : 'text-green-600'} />
            Online exam · {course.title}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={upcoming ? 'amber' : 'green'}>{upcoming ? 'Starts soon' : 'Open now'}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
              <Timer size={13} /> {course.exam_time_limit_min} min once you start
            </span>
          </div>
          <dl className="mt-3 space-y-0.5 text-sm text-neutral-600">
            {opens !== null && (
              <div>
                <dt className="inline text-neutral-400">Opens </dt>
                <dd className="inline font-medium text-neutral-800">{when(course.exam_opens_at!)}</dd>
              </div>
            )}
            {closes !== null && (
              <div>
                <dt className="inline text-neutral-400">Closes </dt>
                <dd className="inline font-medium text-neutral-800">{when(course.exam_closes_at!)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          {upcoming && opens !== null ? (
            <>
              <div className="text-xs font-medium text-neutral-500">Exam opens in</div>
              <CountdownTiles ms={opens - now} tone="text-amber-600" />
            </>
          ) : closes !== null ? (
            <>
              <div className="text-xs font-medium text-neutral-500">Time left to start</div>
              <CountdownTiles ms={closes - now} tone="text-green-700" />
            </>
          ) : (
            <div className="text-sm font-medium text-green-700">Open — start any time</div>
          )}
          <Link to={`/app/courses/${course.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
            {upcoming ? 'View course' : 'Start exam'} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}

/** Live "opens in …" timer for the course page, shown under the gate message. */
export function ExamOpensTimer({ opensAt }: { opensAt: string }) {
  const now = useNow();
  const ms = new Date(opensAt).getTime() - now;
  if (ms <= 0) return <div className="mt-2 text-xs font-medium text-amber-800">Opening now — refresh the page.</div>;
  return (
    <div className="mt-2">
      <div className="mb-1 text-xs font-medium text-amber-800">Opens in</div>
      <CountdownTiles ms={ms} tone="text-amber-600" />
    </div>
  );
}
