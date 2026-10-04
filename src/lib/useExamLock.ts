import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * When the signed-in student has a scheduled exam window open (or an attempt running), study material is
 * locked in the database. This returns when the lock ends (ms since epoch), or null when there is none, so
 * screens can explain why content is empty. Rechecks every 30 seconds, so the page unlocks by itself.
 */
export function useExamLock(): number | null {
  const [until, setUntil] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data, error } = await supabase.rpc('exam_lock_until');
      if (!alive || error) return;
      setUntil(data ? new Date(data as string).getTime() : null);
    };
    check();
    const id = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return until;
}
