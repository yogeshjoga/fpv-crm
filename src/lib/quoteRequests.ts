import type { Tables } from './database.types';
import type { DeliveryMode } from './quotations';

export type QuoteRequest = Tables<'quote_requests'>;
export type RequestStatus = 'open' | 'submitted' | 'quoted' | 'closed';

export interface RequestOption {
  key: string;
  label: string;
  values: string[];
}
export interface RequestModule {
  key: string;
  title: string;
  days: number | null;
  hours: number;
  options: RequestOption[];
}
/** What the public form saves (see the `quote-request` function). Labels are stored with the answers, so this page needs no catalog. */
export interface RequestAnswers {
  contact: { name: string; designation: string; organisation: string; email: string; phone: string };
  event: {
    participants: number;
    audience: string;
    experience: string;
    mode: string;
    mode_key: string;
    start: string | null;
    end: string | null;
    flexible: boolean;
    venue: string;
    certificates: boolean;
  };
  modules: RequestModule[];
  budget: string;
  notes: string;
}

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = { open: 'Waiting for the client', submitted: 'Answered', quoted: 'Quoted', closed: 'Closed' };
export const REQUEST_STATUS_TONE: Record<RequestStatus, 'neutral' | 'blue' | 'green' | 'amber'> = { open: 'amber', submitted: 'blue', quoted: 'green', closed: 'neutral' };

/** The client's link. The path is not a secret on its own: the long random part is. */
export const requestUrl = (token: string) => `${window.location.origin}/quote/${token}`;

export function parseAnswers(v: unknown): RequestAnswers | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const a = v as Partial<RequestAnswers>;
  if (!a.contact || !a.event || !Array.isArray(a.modules)) return null;
  return a as RequestAnswers;
}

/** Choices about the room, kit and computers: useful to the admin, but not teaching topics. */
const LOGISTICS = new Set(['computers', 'space', 'kits']);

export const moduleTime = (m: RequestModule) => `${m.days ? `${m.days} day${m.days === 1 ? '' : 's'}, ` : ''}${m.hours} hour${m.hours === 1 ? '' : 's'}`;
const detail = (m: RequestModule, logistics: boolean) =>
  m.options.filter((o) => LOGISTICS.has(o.key) === logistics).map((o) => o.values.join(', ')).filter(Boolean).join('; ');

/** One readable line per module, for the admin and for the quotation's topic list. */
export function moduleLine(m: RequestModule) {
  const d = detail(m, false);
  return `${m.title}: ${moduleTime(m)}${d ? ` (${d})` : ''}`;
}

const MODE_MAP: Record<string, DeliveryMode> = { 'in-person-at-our-venue': 'onsite', online: 'online', 'hybrid-online-and-in-person': 'hybrid' };

/** What a quotation can start with, from a client's answers. Prices are left for the admin. */
export function draftFromAnswers(a: RequestAnswers) {
  const days = a.modules.reduce((n, m) => n + (m.days ?? 0), 0);
  const hours = a.modules.reduce((n, m) => n + m.hours, 0);
  const SHORT: Record<string, string> = { simulation: 'simulation', piloting: 'piloting', theory: 'theory', pid: 'PID tuning', pcb: 'PCB reverse engineering', build: 'drone building', research: 'research' };
  const titles = a.modules.map((m) => SHORT[m.key] ?? m.title.toLowerCase());
  const nice = titles.length > 1 ? `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}` : titles[0] ?? '';
  const logistics = a.modules.flatMap((m) => m.options.filter((o) => LOGISTICS.has(o.key)).map((o) => `${m.title}, ${o.label.toLowerCase()}: ${o.values.join(', ')}`));
  const notes = [
    `Requirements from the client: ${a.event.audience.toLowerCase()}; ${a.event.experience.toLowerCase()}.`,
    ...logistics,
    a.notes ? `Client's notes: ${a.notes}` : '',
  ].filter(Boolean).join('\n');
  return {
    client_name: a.contact.name,
    client_designation: a.contact.designation,
    organisation: a.contact.organisation,
    client_email: a.contact.email,
    client_phone: a.contact.phone,
    title: `FPV training: ${nice}`.slice(0, 160),
    participants: String(a.event.participants),
    duration_days: days ? String(days) : '',
    hours_per_day: days ? String(Math.round((hours / days) * 10) / 10) : '',
    mode: MODE_MAP[a.event.mode_key] ?? 'onsite',
    venue: a.event.venue,
    proposed_start: a.event.start ?? '',
    proposed_end: a.event.end ?? '',
    dates_note: a.event.flexible ? 'Flexible, to be fixed together' : '',
    topics: a.modules.map(moduleLine),
    lines: a.modules.map((m) => ({ description: `${m.title}: ${moduleTime(m)}`, qty: String(m.hours), unit: 'hours', rate: '' })),
    notes,
    wantsCertificates: a.event.certificates,
  };
}
