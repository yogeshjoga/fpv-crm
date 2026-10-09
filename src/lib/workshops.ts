export type GroupKind = 'regular' | 'workshop' | 'event';

export const KIND_LABEL: Record<GroupKind, string> = { workshop: 'Workshop', event: 'Event', regular: 'Regular batch' };
export const KIND_TONE: Record<GroupKind, 'blue' | 'amber' | 'neutral'> = { workshop: 'blue', event: 'amber', regular: 'neutral' };
export const STUDENT_KIND_LABEL = { workshop: 'Workshop student', event: 'Event student', normal: 'Normal student' } as const;
export const STUDENT_KIND_TONE = { workshop: 'blue', event: 'amber', normal: 'neutral' } as const;

export interface WorkshopOverview {
  group_id: string;
  students: number;
  exam_takers: number;
  avg_best_score: number | null;
  passed_students: number;
  certificates: number;
  reviews: number;
  avg_rating: number | null;
}

export interface RosterRow {
  student_id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  joined_at: string;
  courses_enrolled: number;
  attempts: number;
  best_score: number | null;
  courses_passed: number;
  certificates: number;
  marks_total: number | null;
  study_seconds: number;
  review_rating: number | null;
}

/** Where a workshop or event stands from its dates. */
export function runState(g: { starts_on: string | null; ends_on: string | null }, today = new Date().toISOString().slice(0, 10)): 'upcoming' | 'live' | 'done' | 'undated' {
  if (!g.starts_on && !g.ends_on) return 'undated';
  if (g.starts_on && today < g.starts_on) return 'upcoming';
  if (g.ends_on && today > g.ends_on) return 'done';
  return 'live';
}

export const RUN_LABEL = { upcoming: 'Upcoming', live: 'Running', done: 'Completed', undated: 'No dates' } as const;
export const RUN_TONE = { upcoming: 'blue', live: 'green', done: 'neutral', undated: 'neutral' } as const;

export const fmtDay = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export const hours = (seconds: number) => (seconds >= 3600 ? `${(seconds / 3600).toFixed(1)} h` : seconds > 0 ? `${Math.round(seconds / 60)} min` : '0');
