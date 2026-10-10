// "Don't ask for the two-step code again on this device".
// After someone passes the code, the browser asks this endpoint to trust the device: the database creates a secret device
// token and it is kept here in an HttpOnly cookie, so page scripts can never read it. On the next password sign-in the browser
// asks this endpoint to restore trust: the cookie token is checked by the database and, if it is good, that one session is
// marked trusted. A password alone from a device without the cookie is still asked for the code.

const SUPABASE_URL = 'https://txbrnewcztixcagdnnfx.supabase.co';
const ANON_KEY = 'sb_publishable_3U5FgNr8wNimcWj8j5pQ9Q_VwF3_c-2';

const COOKIE = 'egr_dt';
const MAX_AGE = 180 * 24 * 3600; // the database decides how long a device really stays trusted (30 days of use, 180 at most)
const base = `Path=/api/device; HttpOnly; Secure; SameSite=Strict`;

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function cookieToken(req) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return '';
}

async function rpc(name, jwt, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: await res.json() };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; ${base}`);
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, access_token: jwt, label } = req.body ?? {};
  if (typeof jwt !== 'string' || !jwt || jwt.length > 4096) return res.status(400).json({ error: 'Missing token' });

  if (action === 'trust') {
    const out = await rpc('trust_this_device', jwt, { p_label: typeof label === 'string' ? label.slice(0, 120) : '' });
    if (!out.ok || typeof out.data !== 'string') return res.status(out.status === 401 || out.status === 403 ? 403 : 400).json({ error: 'Could not trust this device' });
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(out.data)}; Max-Age=${MAX_AGE}; ${base}`);
    return res.status(200).json({ trusted: true });
  }

  if (action === 'restore') {
    const token = cookieToken(req);
    if (!token) return res.status(200).json({ trusted: false });
    const out = await rpc('trust_session', jwt, { p_token: token });
    if (!out.ok) return res.status(200).json({ trusted: false });
    if (out.data !== true) res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; ${base}`); // expired or revoked: forget it
    return res.status(200).json({ trusted: out.data === true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
