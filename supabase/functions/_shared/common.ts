// Shared helpers for EgireRobotics edge functions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

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

/** A short URL-safe temporary password (hex + a couple of symbols). */
export function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `Egr-${hex}`;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Wrap an email body in the EgireRobotics header + founder footer. */
export function emailShell(bodyHtml: string): string {
  return (
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px;color:#1a1a1a">` +
    `<div style="border-bottom:2px solid #1a1a1a;padding-bottom:10px;margin-bottom:20px">` +
    `<span style="font-weight:800;letter-spacing:2px;font-size:16px">EGIRE ROBOTICS</span>` +
    `<span style="display:block;margin-top:2px;color:#8a8a8a;font-size:10px;letter-spacing:3px">EXPLORE &middot; ENGINEER &middot; EXCEL</span>` +
    `</div>` +
    bodyHtml +
    `<div style="border-top:1px solid #ececec;margin-top:26px;padding-top:12px;color:#8a8a8a;font-size:12px;line-height:1.6">` +
    `<strong style="color:#555">Yogesh Joga</strong> &mdash; Founder, EgireRobotics<br/>` +
    `contact@egirerobotics.com &middot; egirerobotics.com` +
    `</div></div>`
  );
}

/** SMTP settings, from env secrets first, else the service-only mail_config table. */
async function resolveMail(): Promise<{
  host?: string;
  port: number;
  tls: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo: string;
  resendKey?: string;
}> {
  const env = (k: string) => Deno.env.get(k) ?? undefined;
  let host = env('SMTP_HOST');
  let port = Number(env('SMTP_PORT') ?? '465');
  let tls = (env('SMTP_TLS') ?? 'true') !== 'false';
  let user = env('SMTP_USER') ?? '';
  let pass = env('SMTP_PASS') ?? '';
  let from = env('MAIL_FROM') ?? env('CERT_EMAIL_FROM') ?? '';
  let replyTo = env('MAIL_REPLY_TO') ?? '';
  const resendKey = env('RESEND_API_KEY');

  if (!host && !resendKey) {
    try {
      const { data } = await adminClient()
        .from('mail_config')
        .select('smtp_host, smtp_port, smtp_user, smtp_pass, smtp_tls, mail_from, mail_reply_to')
        .eq('id', true)
        .maybeSingle();
      if (data) {
        host = data.smtp_host ?? host;
        port = data.smtp_port ?? port;
        tls = data.smtp_tls ?? tls;
        user = data.smtp_user ?? user;
        pass = data.smtp_pass ?? pass;
        from = from || (data.mail_from ?? '');
        replyTo = replyTo || (data.mail_reply_to ?? '');
      }
    } catch (e) {
      console.error('mail_config lookup failed', e);
    }
  }

  return {
    host,
    port,
    tls,
    user,
    pass,
    from: from || 'EgireRobotics <contact@egirerobotics.com>',
    replyTo: replyTo || 'contact@egirerobotics.com',
    resendKey,
  };
}

/**
 * Send a transactional email. Transport is chosen by config:
 *   1. SMTP host set (env SMTP_HOST or mail_config.smtp_host) -> SMTP
 *   2. RESEND_API_KEY                                         -> Resend HTTP API
 *   3. neither                                                -> logged and skipped
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}): Promise<{ sent: boolean; skipped?: string }> {
  const cfg = await resolveMail();
  const from = cfg.from;
  const replyTo = cfg.replyTo;

  if (cfg.host) {
    try {
      const client = new SMTPClient({
        connection: {
          hostname: cfg.host,
          port: cfg.port,
          tls: cfg.tls,
          auth: { username: cfg.user, password: cfg.pass },
        },
      });
      await client.send({
        from,
        to: opts.to,
        replyTo,
        subject: opts.subject,
        html: opts.html,
        attachments: opts.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          encoding: 'base64',
          contentType: 'application/pdf',
        })),
      });
      await client.close();
      return { sent: true };
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      console.error('SMTP error', msg);
      return { sent: false, skipped: `smtp_error: ${msg}`.slice(0, 300) };
    }
  }

  const key = cfg.resendKey;
  if (!key) {
    console.log(`[email skipped — no transport] to=${opts.to} subject="${opts.subject}"`);
    return { sent: false, skipped: 'no_transport' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: opts.to, reply_to: replyTo, subject: opts.subject, html: opts.html, attachments: opts.attachments }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return { sent: false, skipped: `resend_${res.status}` };
  }
  return { sent: true };
}
