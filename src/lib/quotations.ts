import type { Tables } from './database.types';

export type Quotation = Tables<'quotations'>;
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type ProgrammeType = 'workshop' | 'training' | 'event' | 'demo';
export type DeliveryMode = 'onsite' | 'online' | 'at_egire' | 'hybrid';

export interface QuoteItem {
  description: string;
  qty: number;
  unit: string;
  rate: number;
}

export const STATUS_LABEL: Record<QuoteStatus, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', expired: 'Expired' };
export const STATUS_TONE: Record<QuoteStatus, 'neutral' | 'blue' | 'green' | 'red' | 'amber'> = {
  draft: 'neutral',
  sent: 'blue',
  accepted: 'green',
  declined: 'red',
  expired: 'amber',
};
export const PROGRAMME_LABEL: Record<ProgrammeType, string> = { workshop: 'Workshop', training: 'Training programme', event: 'Event', demo: 'Demo session' };
export const MODE_LABEL: Record<DeliveryMode, string> = {
  onsite: "At the client's venue",
  online: 'Online',
  at_egire: 'At an EgireRobotics location',
  hybrid: 'Hybrid (online and in person)',
};

/** Starting points for the form. Everything can be edited per quotation before the PDF is made. */
export const TOPIC_SUGGESTIONS = [
  'Introduction to drones and FPV flying',
  'Drone safety, rules and regulations in India',
  'FPV simulator practice',
  'Building and soldering an FPV drone',
  'Flight controller setup and tuning',
  'Hands-on supervised flying',
  'Aerial mapping and photogrammetry basics',
  'AI and computer vision on drones',
  'Electronics and PCB basics for drones',
  'Live demo and Q&A',
];
export const DEFAULT_INCLUSIONS = [
  'Experienced trainers and a planned hands-on session',
  'Training material for every participant',
  'A participation certificate for every participant',
  'Safety briefing and supervised practical sessions',
];
export const DEFAULT_TERMS = [
  'Dates are confirmed once the advance payment is received.',
  'The client arranges the hall or venue, power supply and a projector or screen, unless agreed otherwise in writing.',
  'Rescheduling needs at least 7 days notice. Changes in the number of participants should be shared 5 days before the session.',
  'Travel and stay are charged as shown above. Anything not listed in this quotation is not included.',
].join('\n');
export const DEFAULT_PAYMENT = 'An advance to confirm the dates, and the balance on or before the day of the session. Payment details are shared with the confirmation.';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** The same sums the database does when it saves a quotation, so the screen and the saved PDF always agree. */
export function calcTotals(items: Pick<QuoteItem, 'qty' | 'rate'>[], discount: number, gstPercent: number) {
  const subtotal = round2(items.reduce((n, i) => n + round2((Number(i.qty) || 0) * (Number(i.rate) || 0)), 0));
  const taxable = Math.max(0, round2(subtotal - (Number(discount) || 0)));
  const gst = round2((taxable * (Number(gstPercent) || 0)) / 100);
  return { subtotal, taxable, gst, total: round2(taxable + gst) };
}

export function parseItems(v: unknown): QuoteItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    return { description: String(o.description ?? ''), qty: Number(o.qty ?? 0), unit: String(o.unit ?? ''), rate: Number(o.rate ?? 0) };
  });
}
export const parseList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);

/** Indian digit grouping: 1,50,000.00 */
export const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

/** Local calendar date as yyyy-mm-dd (not UTC), plus `days`. */
export function isoDate(offsetDays = 0, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function proposedDates(q: Pick<Quotation, 'proposed_start' | 'proposed_end' | 'dates_note'>) {
  const a = fmtDate(q.proposed_start);
  const b = fmtDate(q.proposed_end);
  const range = a && b && q.proposed_start !== q.proposed_end ? `${a} to ${b}` : a || b;
  return [range, q.dates_note.trim()].filter(Boolean).join(' · ') || 'To be fixed together with the client';
}

export function durationText(q: Pick<Quotation, 'duration_days' | 'hours_per_day'>) {
  const d = q.duration_days === null ? null : Number(q.duration_days);
  const h = q.hours_per_day === null ? null : Number(q.hours_per_day);
  const parts: string[] = [];
  if (d) parts.push(`${d} day${d === 1 ? '' : 's'}`);
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'} per day`);
  return parts.join(', ');
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below100 = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`);
const below1000 = (n: number) => `${n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' : ''}` : ''}${n % 100 ? below100(n % 100) : ''}`;

/** 54280.59 -> "Rupees Fifty-Four Thousand Two Hundred Eighty and Fifty-Nine Paise Only" (Indian lakh / crore system). */
export function amountInWords(amount: number) {
  const total = Math.round(Math.abs(amount) * 100);
  const rupees = Math.floor(total / 100);
  const paise = total % 100;
  if (rupees === 0 && paise === 0) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1000);
  const rest = rupees % 1000;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rest) parts.push(below1000(rest));
  const r = parts.join(' ');
  return `Rupees ${r || 'Zero'}${paise ? `${r ? ' and ' : ' '}${below100(paise)} Paise` : ''} Only`;
}
