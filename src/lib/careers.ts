export type JobKind = 'internship' | 'full_time' | 'part_time' | 'contract';
export type WorkMode = 'onsite' | 'remote' | 'hybrid';
export type JobStatus = 'draft' | 'open' | 'closed';
export type AppStatus = 'applied' | 'in_review' | 'shortlisted' | 'interviewing' | 'offered' | 'hired' | 'rejected' | 'withdrawn';
export type RoundKind = 'screening' | 'online_test' | 'interview' | 'group_discussion' | 'hr' | 'final';
export type RoundStatus = 'pending' | 'scheduled' | 'completed' | 'passed' | 'failed' | 'no_show';
export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'yesno' | 'url';

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
}

export const KIND_LABEL: Record<JobKind, string> = {
  internship: 'Internship',
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
};
export const MODE_LABEL: Record<WorkMode, string> = { onsite: 'On-site', remote: 'Remote', hybrid: 'Hybrid' };
export const ROUND_KIND_LABEL: Record<RoundKind, string> = {
  screening: 'Screening',
  online_test: 'Online test',
  interview: 'Interview',
  group_discussion: 'Group discussion',
  hr: 'HR round',
  final: 'Final round',
};
export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: 'Short answer',
  textarea: 'Long answer',
  number: 'Number',
  select: 'Choose one',
  yesno: 'Yes / No',
  url: 'Link (URL)',
};

export const APP_STATUS_LABEL: Record<AppStatus, string> = {
  applied: 'Applied',
  in_review: 'In review',
  shortlisted: 'Shortlisted',
  interviewing: 'Interviewing',
  offered: 'Offer made',
  hired: 'Hired',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
};
export const APP_STATUS_TONE: Record<AppStatus, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  applied: 'neutral',
  in_review: 'blue',
  shortlisted: 'blue',
  interviewing: 'amber',
  offered: 'green',
  hired: 'green',
  rejected: 'red',
  withdrawn: 'neutral',
};
export const ROUND_STATUS_LABEL: Record<RoundStatus, string> = {
  pending: 'To be scheduled',
  scheduled: 'Scheduled',
  completed: 'Completed',
  passed: 'Passed',
  failed: 'Not cleared',
  no_show: 'Did not attend',
};
export const ROUND_STATUS_TONE: Record<RoundStatus, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  pending: 'neutral',
  scheduled: 'blue',
  completed: 'neutral',
  passed: 'green',
  failed: 'red',
  no_show: 'red',
};

/** Where a job stands for applicants right now. */
export function windowState(job: { status: string; apply_starts_at: string | null; apply_ends_at: string | null }, now = Date.now()): 'draft' | 'upcoming' | 'live' | 'closed' {
  if (job.status === 'draft') return 'draft';
  if (job.status === 'closed') return 'closed';
  const start = job.apply_starts_at ? new Date(job.apply_starts_at).getTime() : null;
  const end = job.apply_ends_at ? new Date(job.apply_ends_at).getTime() : null;
  if (start !== null && now < start) return 'upcoming';
  if (end !== null && now >= end) return 'closed';
  return 'live';
}

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const newFieldId = () => `f_${Math.random().toString(36).slice(2, 8)}`;

/** Parse the jsonb form definition defensively: whatever is stored, the form still renders. */
export function parseFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => ({
      id: String(f.id ?? newFieldId()),
      label: String(f.label ?? 'Question'),
      type: (['text', 'textarea', 'number', 'select', 'yesno', 'url'] as const).includes(f.type as FieldType) ? (f.type as FieldType) : 'text',
      required: !!f.required,
      options: Array.isArray(f.options) ? f.options.map(String) : undefined,
    }));
}
