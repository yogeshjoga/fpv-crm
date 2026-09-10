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

/**
 * Send a transactional email. Transport is chosen by env:
 *   1. SMTP_HOST set  -> SMTP (e.g. Titan: smtp.titan.email)
 *   2. RESEND_API_KEY -> Resend HTTP API
 *   3. neither        -> logged and skipped
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}): Promise<{ sent: boolean; skipped?: string }> {
  const from =
    Deno.env.get('MAIL_FROM') ??
    Deno.env.get('CERT_EMAIL_FROM') ??
    'EgireRobotics <contact@egirerobotics.com>';
  // Where student replies land. Defaults to the real Titan mailbox.
  const replyTo = Deno.env.get('MAIL_REPLY_TO') ?? 'contact@egirerobotics.com';

  const smtpHost = Deno.env.get('SMTP_HOST');
  if (smtpHost) {
    try {
      const client = new SMTPClient({
        connection: {
          hostname: smtpHost,
          port: Number(Deno.env.get('SMTP_PORT') ?? '465'),
          tls: (Deno.env.get('SMTP_TLS') ?? 'true') !== 'false',
          auth: {
            username: Deno.env.get('SMTP_USER') ?? '',
            password: Deno.env.get('SMTP_PASS') ?? '',
          },
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
      console.error('SMTP error', e);
      return { sent: false, skipped: 'smtp_error' };
    }
  }

  const key = Deno.env.get('RESEND_API_KEY');
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
