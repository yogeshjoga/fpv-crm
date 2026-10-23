import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

/**
 * Public requirement form for quotations. An admin shares a link  /quote/<token>  with one client; the client picks what
 * they expect (simulation, piloting, theory, PID, PCB reverse engineering, research...) and the admin turns the answers
 * into a quotation.
 *
 * Body: { action: 'load', token }                          -> what the form needs (catalog, prefilled contact, earlier answers)
 *       { action: 'submit', token, answers, website? }     -> validates and saves the answers
 *
 * Safety (see .claude/skills/fpv-crm-security-guidelines):
 *  - No login, so everything is checked here: the token must exist, not be expired and not already be quoted or closed.
 *    An unknown, expired or closed link all get the same answer, so nobody can probe for valid links.
 *  - Every answer is validated against the catalog below. Free text is length-limited and stored as text; nothing the client
 *    types is ever sent anywhere else. Only the admin who made the link (and other staff) can read the answers.
 *  - Rate limited by network and by link; a hidden "website" field catches bots; payload capped.
 *  - Self-contained on purpose (like `mcp`): no shared mail helpers, nothing is emailed to the client from here.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
type Json = Record<string, unknown>;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function clientIp(req: Request) {
  const fwd = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? (req.headers.get('x-forwarded-for') ?? '').split(',')[0];
  return (fwd ?? '').trim() || 'unknown';
}
async function rateLimit(scope: string, subject: string, max: number, windowSec: number) {
  const { data, error } = await admin.rpc('rate_limit_hit', { p_key: `${scope}:${await sha256Hex(subject)}`, p_max: max, p_window_seconds: windowSec });
  if (error) throw new HttpError(503, 'Please try again in a moment.'); // fail closed
  if (data === false) throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.');
}

// ---------- what the client can choose (FPV only) ----------

interface Choice { key: string; label: string }
interface Option { key: string; label: string; kind: 'one' | 'many'; choices: Choice[]; required?: boolean }
interface Module {
  key: string;
  title: string;
  blurb: string;
  /** Real flying: cannot be delivered online. */
  inPerson?: boolean;
  /** Days are asked for. Theory is hours only. */
  useDays: boolean;
  minDays: number;
  defaultDays: number;
  minHours: number;
  defaultHours: number;
  /** Fixed hour choices instead of a free number (theory). */
  hoursChoices?: number[];
  options: Option[];
}
const c = (...labels: string[]): Choice[] => labels.map((label) => ({ key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), label }));

const MODULES: Module[] = [
  {
    key: 'simulation', title: 'Simulation training', blurb: 'Learn to fly on an FPV simulator before touching a real drone: stick control, line tracking, freestyle basics.',
    useDays: true, minDays: 5, defaultDays: 5, minHours: 15, defaultHours: 15,
    options: [
      { key: 'level', label: 'Where should it start?', kind: 'one', required: true, choices: c('Complete beginners', 'Some simulator practice', 'Already fly real FPV') },
      { key: 'computers', label: 'Computers for the simulator', kind: 'one', required: true, choices: c('Participants bring their own laptops', 'We arrange a computer lab', 'We need EgireRobotics to provide them') },
    ],
  },
  {
    key: 'piloting', title: 'Piloting (real flying)', blurb: 'Supervised flying with real FPV drones, from a first hover to controlled flight.',
    inPerson: true, useDays: true, minDays: 1, defaultDays: 2, minHours: 4, defaultHours: 8,
    options: [
      { key: 'level', label: 'Level', kind: 'one', required: true, choices: c('Beginner', 'Intermediate', 'Advanced') },
      { key: 'drones', label: 'Drones to fly', kind: 'many', required: true, choices: c('Indoor tiny whoops', 'Outdoor 5-inch FPV', 'Long-range FPV') },
      { key: 'space', label: 'Flying space we can offer', kind: 'one', choices: c('Indoor hall', 'Open ground', 'Both', 'Not decided yet') },
    ],
  },
  {
    key: 'theory', title: 'Theory', blurb: 'The background in short: how FPV works, parts, batteries and safety. Kept minimal by default.',
    useDays: false, minDays: 0, defaultDays: 0, minHours: 2, defaultHours: 2, hoursChoices: [2, 4, 6, 8],
    options: [
      { key: 'topics', label: 'Topics', kind: 'many', choices: c('How FPV works', 'Drone parts and what each does', 'Batteries and charging safety', 'Safety and flying rules in India', 'Radio links and video systems') },
    ],
  },
  {
    key: 'pid', title: 'PID and tuning', blurb: 'How the flight controller decides how to fly, and how to tune it so the drone flies the way you want.',
    useDays: true, minDays: 1, defaultDays: 1, minHours: 4, defaultHours: 6,
    options: [
      { key: 'level', label: 'Depth', kind: 'one', required: true, choices: c('Basics', 'Intermediate', 'Advanced') },
      { key: 'topics', label: 'Topics', kind: 'many', choices: c('PID tuning in Betaflight', 'Filters and noise', 'Rates and stick feel', 'Blackbox log analysis') },
    ],
  },
  {
    key: 'pcb', title: 'PCB reverse engineering', blurb: 'Open up FPV electronics and learn how they are built: read a board, trace it and rebuild the schematic.',
    useDays: true, minDays: 1, defaultDays: 1, minHours: 6, defaultHours: 8,
    options: [
      { key: 'level', label: 'Depth', kind: 'one', required: true, choices: c('Introduction', 'Intermediate', 'Advanced') },
      { key: 'topics', label: 'Boards to work on', kind: 'many', choices: c('Flight controller board', 'ESC (motor controller) board', 'Video transmitter board', 'Soldering and rework') },
    ],
  },
  {
    key: 'build', title: 'Build and configure an FPV drone', blurb: 'Assemble, solder and set up a working FPV drone from parts.',
    useDays: true, minDays: 1, defaultDays: 2, minHours: 6, defaultHours: 12,
    options: [
      { key: 'size', label: 'Drone to build', kind: 'one', required: true, choices: c('Tiny whoop', '5-inch freestyle', 'Long-range') },
      { key: 'kits', label: 'Parts and kits', kind: 'one', required: true, choices: c('Participants buy kits', 'Institution buys kits', 'Not decided yet') },
    ],
  },
  {
    key: 'research', title: 'Research level', blurb: 'Go deeper than a course: measure, analyse and write up something new about FPV systems.',
    useDays: true, minDays: 1, defaultDays: 3, minHours: 8, defaultHours: 20,
    options: [
      { key: 'level', label: 'Level', kind: 'one', required: true, choices: c('Introductory', 'Intermediate', 'Research grade') },
      { key: 'topics', label: 'Research areas', kind: 'many', required: true, choices: c('Video link and latency', 'Control loops and filters', 'Motors, ESCs and propellers', 'Autonomy and computer vision for FPV', 'Flight firmware internals') },
    ],
  },
];

const AUDIENCE = c('School students', 'College students', 'Faculty and staff', 'Working professionals', 'A mix');
const EXPERIENCE = c('Nobody has flown a drone', 'A few have flown drones', 'Most have flown FPV');
const MODE = c('In person at our venue', 'Online', 'Hybrid (online and in person)');

// ---------- validation ----------

const oneLine = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const multiLine = (v: unknown, max: number) => String(v ?? '').replace(/\r\n/g, '\n').replace(/[^\S\n]+/g, ' ').trim().slice(0, max);
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (msg: string): never => {
  throw new HttpError(400, msg);
};
const intIn = (v: unknown, min: number, max: number, what: string) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  if (!Number.isInteger(n) || n < min || n > max) return fail(`${what} must be a whole number from ${min} to ${max}.`);
  return n;
};
const isoDay = (v: unknown, what: string) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) return fail(`${what} is not a valid date.`);
  return s;
};

function validate(raw: unknown) {
  if (!isObj(raw)) return fail('Please fill in the form.');
  const contact = isObj(raw.contact) ? raw.contact : {};
  const name = oneLine(contact.name, 120);
  if (!name) fail('Please enter your name.');
  const email = oneLine(contact.email, 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Please enter a valid email address so we can send the quotation.');
  const phone = oneLine(contact.phone, 30);
  if (phone && (phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) fail('Please enter a valid phone number.');
  const organisation = oneLine(contact.organisation, 200);
  if (!organisation) fail('Please enter your college, club or company.');

  const ev = isObj(raw.event) ? raw.event : {};
  const participants = intIn(ev.participants, 1, 5000, 'The number of participants');
  const audience = AUDIENCE.find((x) => x.key === ev.audience) ?? fail('Please choose who the participants are.');
  const experience = EXPERIENCE.find((x) => x.key === ev.experience) ?? fail('Please choose their experience.');
  const mode = MODE.find((x) => x.key === ev.mode) ?? fail('Please choose how you would like the sessions held.');
  const today = new Date().toISOString().slice(0, 10);
  const start = isoDay(ev.start, 'The preferred start date');
  const end = isoDay(ev.end, 'The preferred end date');
  if (start && start < today) fail('The preferred start date has already passed.');
  if (start && start > new Date(Date.now() + 800 * 86400000).toISOString().slice(0, 10)) fail('The preferred start date is too far away.');
  if (end && start && end < start) fail('The end date cannot be before the start date.');
  if (end && !start) fail('Please also give a start date, or clear the end date.');
  const venue = oneLine(ev.venue, 240);
  if (mode.key !== 'online' && !venue) fail('Please tell us the venue or city.');

  const picked = isObj(raw.modules) ? raw.modules : {};
  const modules: Json[] = [];
  for (const m of MODULES) {
    const sel = picked[m.key];
    if (!isObj(sel) || sel.selected !== true) continue;
    if (m.inPerson && mode.key === 'online') fail(`${m.title} needs an in-person session. Choose in person or hybrid, or remove it.`);
    const days = m.useDays ? intIn(sel.days, m.minDays, 30, `${m.title}: the number of days`) : null;
    const hours = intIn(sel.hours, m.minHours, 400, `${m.title}: the number of hours`);
    if (m.hoursChoices && !m.hoursChoices.includes(hours)) fail(`${m.title}: please choose one of ${m.hoursChoices.join(', ')} hours.`);
    if (days !== null && hours > days * 10) fail(`${m.title}: ${hours} hours do not fit in ${days} day${days === 1 ? '' : 's'}. Add days or reduce the hours.`);
    const given = isObj(sel.options) ? sel.options : {};
    const options: Json[] = [];
    for (const o of m.options) {
      const v = given[o.key];
      const values = (Array.isArray(v) ? v : v === undefined || v === '' ? [] : [v]).map((x) => o.choices.find((ch) => ch.key === x)).filter((x): x is Choice => !!x);
      if (o.kind === 'one' && values.length > 1) fail(`${m.title}: choose only one for "${o.label}".`);
      if (o.required && !values.length) fail(`${m.title}: please choose "${o.label}".`);
      if (values.length) options.push({ key: o.key, label: o.label, values: values.map((x) => x.label) });
    }
    modules.push({ key: m.key, title: m.title, days, hours, options });
  }
  if (!modules.length) fail('Please choose at least one thing you would like us to cover.');

  return {
    contact: { name, designation: oneLine(contact.designation, 160), organisation, email, phone },
    event: {
      participants, audience: audience.label, experience: experience.label, mode: mode.label, mode_key: mode.key,
      start, end, flexible: ev.flexible === true, venue, certificates: ev.certificates === true,
    },
    modules,
    budget: oneLine(raw.budget, 200),
    notes: multiLine(raw.notes, 1500),
  };
}

// ---------- handler ----------

const GONE = 'This link is not valid any more. Please ask EgireRobotics for a new one.';

async function findRequest(token: unknown) {
  const t = String(token ?? '');
  if (!/^[a-f0-9]{32}$/.test(t)) throw new HttpError(404, GONE);
  const { data } = await admin
    .from('quote_requests')
    .select('id, status, client_name, organisation, client_email, client_phone, expires_at, answers, submit_count')
    .eq('token', t)
    .maybeSingle();
  if (!data || new Date(data.expires_at).getTime() < Date.now() || data.status === 'closed') throw new HttpError(404, GONE);
  return { row: data, token: t };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const raw = await req.text();
    if (raw.length > 40_000) throw new HttpError(413, 'That is too much text.');
    let body: Json;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'Invalid request.');
    }
    if (!isObj(body)) throw new HttpError(400, 'Invalid request.');
    const ip = clientIp(req);

    if (body.action === 'load') {
      await rateLimit('qr-load-ip', ip, 60, 10 * 60);
      const { row } = await findRequest(body.token);
      return json({
        locked: row.status === 'quoted',
        status: row.status,
        contact: { name: row.client_name, organisation: row.organisation, email: row.client_email ?? '', phone: row.client_phone },
        answers: row.status === 'submitted' || row.status === 'quoted' ? row.answers : null,
        catalog: { modules: MODULES, audience: AUDIENCE, experience: EXPERIENCE, mode: MODE },
      });
    }

    if (body.action === 'submit') {
      // Bots fill every field. Pretend it worked so they learn nothing.
      if (String(body.website ?? '').trim()) return json({ ok: true });
      await rateLimit('qr-submit-ip', ip, 10, 10 * 60);
      const { row, token } = await findRequest(body.token);
      await rateLimit('qr-submit-token', token, 20, 24 * 3600);
      if (row.status === 'quoted') throw new HttpError(409, 'A quotation has already been prepared from this form. Please contact EgireRobotics to change anything.');
      const answers = validate(body.answers);

      const { error } = await admin
        .from('quote_requests')
        .update({ answers, status: 'submitted', submitted_at: new Date().toISOString(), submit_count: (row.submit_count ?? 0) + 1 })
        .eq('id', row.id)
        .neq('status', 'quoted');
      if (error) {
        console.error('quote request save failed', error.message);
        throw new HttpError(500, 'We could not save your answers. Please try again.');
      }

      // Telling the team is best effort: the answers are already saved.
      try {
        const { data: staff } = await admin.from('profiles').select('id').in('role', ['admin', 'super_admin']).eq('status', 'active').is('archived_at', null);
        const summary = (answers.modules as Json[]).map((m) => String(m.title)).join(', ');
        for (const s of staff ?? []) {
          await admin.from('notifications').insert({
            recipient_id: s.id,
            title: `${row.submit_count ? 'Updated requirements' : 'Requirements received'}: ${answers.contact.organisation}`,
            body: `${answers.contact.name} · ${answers.event.participants} participants · ${summary}`.slice(0, 300),
            kind: 'quote_request',
            link: '/admin/quotations/requests',
          });
        }
      } catch (e) {
        console.error('quote request notification failed', (e as Error)?.message);
      }
      return json({ ok: true });
    }

    throw new HttpError(400, 'Invalid request.');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('quote-request error', (e as Error)?.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
