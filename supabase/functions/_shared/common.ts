// Shared helpers for EgireRobotics edge functions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Resolve the calling user from the request's JWT. Throws on failure. */
export async function requireUser(req: Request, admin = adminClient()) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '').trim();
  if (!jwt) throw new HttpError(401, 'Missing authorization header');
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) throw new HttpError(401, 'Invalid session');
  return data.user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fire a transactional email through Resend. No-ops when RESEND_API_KEY is unset. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}): Promise<{ sent: boolean; skipped?: string }> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('CERT_EMAIL_FROM') ?? 'EgireRobotics <onboarding@resend.dev>';
  if (!key) {
    console.log(`[email skipped — no RESEND_API_KEY] to=${opts.to} subject="${opts.subject}"`);
    return { sent: false, skipped: 'no_api_key' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html, attachments: opts.attachments }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return { sent: false, skipped: `resend_${res.status}` };
  }
  return { sent: true };
}
