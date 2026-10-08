// Keeps the login token for protected course files (/api/private) in an HttpOnly cookie.
// The browser cannot read or copy an HttpOnly cookie from JavaScript, so page scripts never see this copy of
// the token. The app posts its current access token here after sign-in and every refresh, and deletes it at sign-out.

const SUPABASE_URL = 'https://txbrnewcztixcagdnnfx.supabase.co';
const ANON_KEY = 'sb_publishable_3U5FgNr8wNimcWj8j5pQ9Q_VwF3_c-2';

const clear = 'egr_at=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false; // a browser always sends Origin on these requests
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function expiryOf(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp : 0;
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clear);
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = typeof req.body?.access_token === 'string' ? req.body.access_token : '';
  if (!token || token.length > 4096) return res.status(400).json({ error: 'Missing token' });

  // only a token Supabase itself accepts may be stored
  const check = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!check.ok) {
    res.setHeader('Set-Cookie', clear);
    return res.status(401).json({ error: 'Invalid session' });
  }
  const maxAge = Math.max(60, expiryOf(token) - Math.floor(Date.now() / 1000));
  res.setHeader('Set-Cookie', `egr_at=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`);
  return res.status(204).end();
}
