import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

const TICK_MS = 15_000;
const FLUSH_MS = 60_000;

/**
 * Accumulates active (tab-visible) time and periodically flushes it to an RPC
 * via `rpcName(rpcArg, seconds)`. Used for both per-course student study time
 * and per-staff admin-panel activity time — same accumulate/flush shape,
 * different RPC + argument.
 */
function useAccumulatedTime(enabled: boolean, flush: (seconds: number) => void) {
  const secondsRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    if (!enabled) return;
    lastTickRef.current = Date.now();
    secondsRef.current = 0;

    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible') {
        secondsRef.current += (now - lastTickRef.current) / 1000;
      }
      lastTickRef.current = now;
    };
    const doFlush = () => {
      tick();
      const whole = Math.round(secondsRef.current);
      if (whole > 0) {
        flushRef.current(whole);
        secondsRef.current = 0;
      }
    };

    const tickTimer = window.setInterval(tick, TICK_MS);
    const flushTimer = window.setInterval(doFlush, FLUSH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') doFlush();
      else lastTickRef.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', doFlush);

    return () => {
      window.clearInterval(tickTimer);
      window.clearInterval(flushTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', doFlush);
      doFlush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

/** Tracks active time on a course's page while `courseId` is set. */
export function useCourseTimeTracker(courseId: string | null | undefined) {
  useAccumulatedTime(!!courseId, (seconds) => {
    supabase.rpc('increment_study_time', { p_course_id: courseId, p_seconds: seconds }).then(({ error }) => {
      if (error) console.error('study time flush failed', error.message);
    });
  });
}

/** Tracks active time anywhere in the admin panel. */
export function useStaffActivityTracker(enabled: boolean) {
  useAccumulatedTime(enabled, (seconds) => {
    supabase.rpc('increment_staff_activity', { p_seconds: seconds }).then(({ error }) => {
      if (error) console.error('staff activity flush failed', error.message);
    });
  });
}
