import type { Tables } from './database.types';

export type OrgChart = Tables<'org_charts'>;
export type Accent = 'slate' | 'blue' | 'green' | 'amber' | 'rose' | 'violet';

export interface PersonProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
}
export interface EmployeeRecord {
  id: string;
  full_name: string;
  designation: string;
  employment_type: string;
  status: string;
  profile_id: string | null;
  email: string;
}
/** A node as the page uses it: the stored row plus the account or HR record it points at, if any. */
export interface OrgNodeView {
  id: string;
  chart_id: string;
  parent_id: string | null;
  kind: 'person' | 'group';
  profile_id: string | null;
  employee_id: string | null;
  is_external: boolean;
  until: string | null;
  label: string;
  title: string;
  image_url: string | null;
  note: string;
  accent: Accent;
  sort_order: number;
  profile: PersonProfile | null;
  employee: EmployeeRecord | null;
}

export const ACCENTS: Record<Accent, { ring: string; chip: string; label: string }> = {
  slate: { ring: 'border-neutral-300', chip: 'bg-neutral-100 text-neutral-700', label: 'Grey' },
  blue: { ring: 'border-blue-400', chip: 'bg-blue-100 text-blue-700', label: 'Blue' },
  green: { ring: 'border-green-400', chip: 'bg-green-100 text-green-700', label: 'Green' },
  amber: { ring: 'border-amber-400', chip: 'bg-amber-100 text-amber-700', label: 'Amber' },
  rose: { ring: 'border-rose-400', chip: 'bg-rose-100 text-rose-700', label: 'Red' },
  violet: { ring: 'border-violet-400', chip: 'bg-violet-100 text-violet-700', label: 'Violet' },
};

export const displayName = (n: OrgNodeView) => n.profile?.full_name?.trim() || n.employee?.full_name?.trim() || n.label || n.profile?.email || 'Unnamed';
/** The account whose leads count for this box: its own account, or the login of the HR record it points at. */
export const profileIdOf = (n: OrgNodeView) => n.profile_id ?? n.employee?.profile_id ?? null;
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** A temporary person whose end date has passed. */
export const hasEnded = (n: OrgNodeView) => n.is_external && !!n.until && n.until < todayIso();
export const sourceLabel = (n: OrgNodeView) =>
  n.kind === 'group' ? 'Team' : n.is_external ? 'Outside the organisation' : n.employee ? (n.employee.employment_type === 'internship' ? 'Intern' : 'Employee') : n.profile ? 'User account' : 'Person';
export const EMPLOYMENT_TYPE_LABEL: Record<string, string> = { internship: 'Intern', full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract' };
export const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
/** Picture shown on the node: the one typed in for this node, else the staff account's own photo. Always https. */
export const photoOf = (n: OrgNodeView) => {
  const u = n.image_url || n.profile?.avatar_url || null;
  return u && /^https:\/\//i.test(u) ? u : null;
};

/* ───────────── layout: a tidy tree, computed here so nothing about positions is stored ───────────── */

export const NODE_W = 230;
export const NODE_H = 96;
const GAP_X = 34;
const GAP_Y = 70;

export type Direction = 'TB' | 'LR';

export function childrenMap(nodes: OrgNodeView[]) {
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map<string | null, OrgNodeView[]>();
  for (const n of nodes) {
    const key = n.parent_id && ids.has(n.parent_id) ? n.parent_id : null;
    kids.set(key, [...(kids.get(key) ?? []), n]);
  }
  for (const list of kids.values()) list.sort((a, b) => a.sort_order - b.sort_order || displayName(a).localeCompare(displayName(b)));
  return kids;
}

/** Everyone below a node, and the node itself. */
export function subtreeIds(nodes: OrgNodeView[], rootId: string): string[] {
  const kids = childrenMap(nodes);
  const out: string[] = [];
  const walk = (id: string) => {
    out.push(id);
    for (const c of kids.get(id) ?? []) walk(c.id);
  };
  walk(rootId);
  return out;
}

export function layoutTree(nodes: OrgNodeView[], direction: Direction) {
  const kids = childrenMap(nodes);
  const unitAcross = direction === 'TB' ? NODE_W + GAP_X : NODE_H + GAP_X;
  const unitDown = direction === 'TB' ? NODE_H + GAP_Y : NODE_W + GAP_Y;
  const span = new Map<string, number>();
  const measure = (id: string): number => {
    const c = kids.get(id) ?? [];
    const w = c.length ? c.reduce((n, k) => n + measure(k.id), 0) : unitAcross;
    span.set(id, Math.max(w, unitAcross));
    return span.get(id)!;
  };
  const pos = new Map<string, { x: number; y: number }>();
  const place = (id: string, left: number, depth: number) => {
    const w = span.get(id)!;
    const center = left + w / 2 - unitAcross / 2;
    pos.set(id, direction === 'TB' ? { x: center, y: depth * unitDown } : { x: depth * unitDown, y: center });
    let cursor = left;
    for (const c of kids.get(id) ?? []) {
      place(c.id, cursor, depth + 1);
      cursor += span.get(c.id)!;
    }
  };
  let cursor = 0;
  for (const r of kids.get(null) ?? []) {
    measure(r.id);
    place(r.id, cursor, 0);
    cursor += span.get(r.id)!;
  }
  return pos;
}

/* ───────────── performance numbers ───────────── */

export interface OwnerRow {
  owner: string | null;
  src: 'enquiry' | 'registration';
  total: number;
  open: number;
  won: number;
  lost: number;
  fees: number;
}
export interface WeekRow {
  owner: string | null;
  week: string;
  n: number;
}
export interface KpiSummary {
  owners: OwnerRow[];
  created: WeekRow[];
  closed: WeekRow[];
}
export interface Metrics {
  leads: number;
  open: number;
  won: number;
  lost: number;
  fees: number;
  conversion: number; // admissions / leads, 0 to 1
  registrations: { total: number; open: number; won: number; lost: number };
  enquiries: { total: number; open: number; won: number; lost: number };
}

export const emptyMetrics = (): Metrics => ({
  leads: 0, open: 0, won: 0, lost: 0, fees: 0, conversion: 0,
  registrations: { total: 0, open: 0, won: 0, lost: 0 },
  enquiries: { total: 0, open: 0, won: 0, lost: 0 },
});

/** Add up the numbers of several owners (one person, or a whole team). Pass `null` inside the list for unassigned leads. */
export function metricsFor(summary: KpiSummary | null, owners: (string | null)[]): Metrics {
  const m = emptyMetrics();
  if (!summary) return m;
  const want = new Set(owners);
  for (const r of summary.owners) {
    if (!want.has(r.owner)) continue;
    const bucket = r.src === 'registration' ? m.registrations : m.enquiries;
    bucket.total += r.total; bucket.open += r.open; bucket.won += r.won; bucket.lost += r.lost;
    m.leads += r.total; m.open += r.open; m.won += r.won; m.lost += r.lost; m.fees += Number(r.fees);
  }
  m.conversion = m.leads ? m.won / m.leads : 0;
  return m;
}

/** Weekly leads generated and admissions closed for a set of owners, oldest week first, with empty weeks filled in. */
export function weeklySeries(summary: KpiSummary | null, owners: (string | null)[]) {
  if (!summary) return [] as { week: string; leads: number; admissions: number }[];
  const want = new Set(owners);
  const by = new Map<string, { week: string; leads: number; admissions: number }>();
  const row = (w: string) => by.get(w) ?? by.set(w, { week: w, leads: 0, admissions: 0 }).get(w)!;
  for (const r of summary.created) if (want.has(r.owner)) row(r.week).leads += r.n;
  for (const r of summary.closed) if (want.has(r.owner)) row(r.week).admissions += r.n;
  const weeks = [...by.keys()].sort();
  if (!weeks.length) return [];
  const out: { week: string; leads: number; admissions: number }[] = [];
  const end = new Date(`${weeks[weeks.length - 1]}T00:00:00Z`);
  for (let d = new Date(`${weeks[0]}T00:00:00Z`); d <= end; d = new Date(d.getTime() + 7 * 86_400_000)) {
    const key = d.toISOString().slice(0, 10);
    out.push(by.get(key) ?? { week: key, leads: 0, admissions: 0 });
    if (out.length > 120) break;
  }
  return out;
}

export type Period = '30d' | '90d' | 'year' | 'all';
export const PERIOD_LABEL: Record<Period, string> = { '30d': 'Last 30 days', '90d': 'Last 90 days', year: 'This year', all: 'All time' };
export function periodRange(p: Period): { from: string | null; to: string | null } {
  const now = new Date();
  if (p === 'all') return { from: null, to: null };
  if (p === 'year') return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to: null };
  const days = p === '30d' ? 30 : 90;
  return { from: new Date(now.getTime() - days * 86_400_000).toISOString(), to: null };
}

export const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
/** Rupees in Indian grouping with no paise: ₹1,26,000 */
export const inr0 = (n: number) => `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;
