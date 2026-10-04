// Serves course material that used to sit in /public (where anyone on the internet could
// download it without logging in). Every request must carry a valid Supabase session —
// either an `Authorization: Bearer` header or the `egr_at` cookie the app sets at sign-in —
// for an ACTIVE account, and, per area, enrollment in the right course / membership of the
// right course group (staff always pass). vercel.json rewrites the original public URLs
// (/study-guides/*, /fpv-build-lab/*, /images/fpv-fundamentals/*) here, so existing lesson
// content and resource links keep working.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

// Same public values the browser bundle ships with (vercel.json build env is not available to
// functions at runtime). The anon key alone grants nothing — RLS decides everything.
const SUPABASE_URL = 'https://txbrnewcztixcagdnnfx.supabase.co';
const ANON_KEY = 'sb_publishable_3U5FgNr8wNimcWj8j5pQ9Q_VwF3_c-2';

const ROOT = path.join(process.cwd(), 'private');
const STAFF_ROLES = ['instructor', 'coordinator', 'admin', 'super_admin'];

const RULES = [
  { prefix: 'study-guides/', group: 'c42608e8-e821-44dd-b5bd-afc993e3e145' }, // Sivani FPV course group
  { prefix: 'fpv-build-lab/', course: '7c1d96db-919c-4f27-8979-bbb15b30e686' }, // Virtual FPV Build
  { prefix: 'images/fpv-fundamentals/', course: '9df973c6-eacf-406c-8893-9d0d58d199eb' }, // FPV Drone Fundamentals
];

const TYPES = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

// Short-lived memo so a page that pulls a dozen files does not make a dozen identical checks.
const memo = new Map();
const TTL_MS = 60_000;
async function remember(key, compute) {
  const hit = memo.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = await compute();
  memo.set(key, { value, exp: Date.now() + TTL_MS });
  if (memo.size > 500) for (const [k, v] of memo) if (v.exp < Date.now()) memo.delete(k);
  return value;
}

async function rest(pathAndQuery, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  return res.ok ? res.json() : null;
}

function tokenFrom(req) {
  const header = req.headers.authorization ?? '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === 'egr_at') return decodeURIComponent(v.join('='));
  }
  return '';
}

async function identify(token) {
  return remember(`id|${token}`, async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const user = await res.json();
    const rows = await rest(`profiles?select=role,status&id=eq.${encodeURIComponent(user.id)}`, token);
    const profile = rows?.[0];
    if (!profile || profile.status !== 'active') return null;
    return { id: user.id, role: profile.role };
  });
}

// While a student has a scheduled exam window open (or an attempt running) study material is locked.
async function examLocked(token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exam_lock_until`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) return true; // fail closed
  return (await res.json()) !== null;
}

async function allowed(rule, who, token) {
  if (STAFF_ROLES.includes(who.role)) return true;
  if (await examLocked(token)) return false;
  return remember(`rule|${who.id}|${rule.prefix}`, async () => {
    if (rule.course) {
      const rows = await rest(
        `enrollments?select=id&student_id=eq.${who.id}&course_id=eq.${rule.course}&status=in.(active,completed)&limit=1`,
        token,
      );
      return !!rows?.length;
    }
    const rows = await rest(`course_group_members?select=group_id&student_id=eq.${who.id}&group_id=eq.${rule.group}&limit=1`, token);
    return !!rows?.length;
  });
}

function deny(req, res, status, message) {
  res.setHeader('Cache-Control', 'private, no-store');
  const wantsPage = (req.headers.accept ?? '').includes('text/html') || req.headers['sec-fetch-dest'] === 'document';
  if (!wantsPage) {
    res.status(status).send(message);
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(status).send(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${status === 401 ? 'Sign in required' : 'Not available'}</title>` +
      `<body style="font-family:system-ui,sans-serif;max-width:28rem;margin:18vh auto;padding:0 1rem;color:#1a1a1a">` +
      `<h1 style="font-size:1.25rem">${message}</h1>` +
      `<p style="color:#555">${status === 401 ? 'Please sign in to the EgireRobotics portal first, then open this link again.' : 'Your account does not have access to this material.'}</p>` +
      `<p><a href="/login" style="color:#1a1a1a;font-weight:600">Go to sign in</a></p></body>`,
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const raw = String(req.query.p ?? '');
  const rel = path.posix.normalize(`/${raw}`).slice(1);
  const rule = RULES.find((r) => rel.startsWith(r.prefix));
  if (!raw || raw.includes('\0') || rel.split('/').includes('..') || !rule) return deny(req, res, 404, 'Not found');

  const token = tokenFrom(req);
  if (!token) return deny(req, res, 401, 'Sign in required');
  const who = await identify(token);
  if (!who) return deny(req, res, 401, 'Sign in required');
  if (!(await allowed(rule, who, token))) return deny(req, res, 403, 'Not available for your account');

  const file = path.join(ROOT, rel);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!file.startsWith(ROOT + path.sep) || !type) return deny(req, res, 404, 'Not found');
  let info;
  try {
    info = await stat(file);
    if (!info.isFile()) return deny(req, res, 404, 'Not found');
  } catch {
    return deny(req, res, 404, 'Not found');
  }

  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', info.size);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (type.includes('wordprocessingml')) res.setHeader('Content-Disposition', `attachment; filename="${path.basename(file)}"`);
  if (req.method === 'HEAD') return res.status(200).end();
  res.status(200);
  createReadStream(file).pipe(res);
}
