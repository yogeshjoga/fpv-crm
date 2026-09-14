/** A calendar day as returned by Postgres `date` columns: "YYYY-MM-DD". */
export type DayKey = string;

const DAY_MS = 86_400_000;

function toUTC(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Today's date as a DayKey, in the viewer's local calendar day. */
export function todayKey(): DayKey {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface StreakInfo {
  /** Consecutive active days through today, or through yesterday if today isn't logged yet (still "alive"). 0 once the gap is 2+ days. */
  current: number;
  /** Longest run of consecutive active days ever seen in the given data. */
  longest: number;
  activeToday: boolean;
  lastActiveDay: DayKey | null;
  totalActiveDays: number;
}

/** Computes current/longest streak from a list of "active" calendar days (duplicates fine). */
export function computeStreak(rawDays: DayKey[]): StreakInfo {
  const uniq = [...new Set(rawDays)].sort();
  if (!uniq.length) {
    return { current: 0, longest: 0, activeToday: false, lastActiveDay: null, totalActiveDays: 0 };
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < uniq.length; i++) {
    run = toUTC(uniq[i]) - toUTC(uniq[i - 1]) === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const last = uniq[uniq.length - 1];
  const today = todayKey();
  const gapDays = Math.round((toUTC(today) - toUTC(last)) / DAY_MS);

  let current = 0;
  if (gapDays <= 1) {
    current = 1;
    for (let i = uniq.length - 1; i > 0; i--) {
      if (toUTC(uniq[i]) - toUTC(uniq[i - 1]) === DAY_MS) current += 1;
      else break;
    }
  }

  return { current, longest, activeToday: gapDays === 0, lastActiveDay: last, totalActiveDays: uniq.length };
}

/** The last `count` calendar days ending today (oldest first), each flagged active or not. */
export function activityStrip(rawDays: DayKey[], count = 28): { day: DayKey; active: boolean }[] {
  const set = new Set(rawDays);
  const today = toUTC(todayKey());
  const out: { day: DayKey; active: boolean }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(today - i * DAY_MS);
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    out.push({ day: key, active: set.has(key) });
  }
  return out;
}
