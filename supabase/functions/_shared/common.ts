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

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A primary call-to-action button for email bodies. */
export function emailButton(href: string, label: string): string {
  return (
    `<a href="${esc(href)}" style="display:inline-block;background:#0a0a0a;color:#ffffff;` +
    `text-decoration:none;font-weight:600;font-size:14px;line-height:1;padding:13px 26px;` +
    `border-radius:10px;margin:4px 0">${esc(label)}</a>`
  );
}

/** A labelled key/value card — used for login credentials. */
export function emailKeyValueCard(rows: { label: string; value: string; mono?: boolean; big?: boolean }[]): string {
  const cells = rows
    .map(
      (r) =>
        `<div style="margin-bottom:12px">` +
        `<div style="color:#8a8a8a;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">${esc(r.label)}</div>` +
        `<div style="${r.mono ? 'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' : ''}` +
        `font-size:${r.big ? '18px' : '14px'};font-weight:${r.big ? '700' : '500'};color:#0a0a0a;word-break:break-all">${esc(r.value)}</div>` +
        `</div>`,
    )
    .join('');
  return (
    `<div style="background:#f6f6f6;border:1px solid #e8e8e8;border-radius:12px;padding:18px 18px 6px;margin:18px 0">` +
    cells +
    `</div>`
  );
}

export interface OrgBranding {
  org_name?: string | null;
  logo_url?: string | null;
  signatory_name?: string | null;
  signatory_title?: string | null;
  signatory_image_url?: string | null;
  support_email?: string | null;
}

/**
 * Wrap an email body in the org's branded header (logo, or a text wordmark fallback)
 * and a signature footer (signature image + name/title when set, org contact email).
 * Accepts either a full branding object, or (for older call sites) just a logo URL.
 */
export function emailShell(bodyHtml: string, branding?: OrgBranding | string | null): string {
  const org: OrgBranding = typeof branding === 'string' || branding == null ? { logo_url: branding } : branding;
  const orgName = org.org_name || 'EgireRobotics';

  const header = org.logo_url
    ? `<img src="${esc(org.logo_url)}" alt="${esc(orgName)}" height="38" style="height:38px;width:auto;border:0;display:block" />`
    : `<span style="font-weight:800;letter-spacing:2px;font-size:18px;color:#0a0a0a">${esc(orgName.toUpperCase())}</span>` +
      `<span style="display:block;margin-top:3px;color:#9a9a9a;font-size:10px;letter-spacing:3px">EXPLORE &middot; ENGINEER &middot; EXCEL</span>`;

  const signatoryName = org.signatory_name || 'Yogesh Joga';
  const signatoryTitle = org.signatory_title || `Founder, ${orgName}`;
  const supportEmail = org.support_email || 'contact@egirerobotics.com';
  const signatureImg = org.signatory_image_url
    ? `<img src="${esc(org.signatory_image_url)}" alt="${esc(signatoryName)}" height="30" style="height:30px;width:auto;display:block;margin-bottom:6px" />`
    : '';

  return (
    `<div style="background:#f0f0f0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">` +
    `<div style="max-width:544px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e8e8">` +
    `<div style="padding:22px 28px;border-bottom:1px solid #efefef">${header}</div>` +
    `<div style="padding:28px;color:#1a1a1a;font-size:15px;line-height:1.65">` +
    bodyHtml +
    `</div>` +
    `<div style="padding:18px 28px;border-top:1px solid #efefef;color:#9a9a9a;font-size:12px;line-height:1.7">` +
    signatureImg +
    `<strong style="color:#555">${esc(signatoryName)}</strong> &mdash; ${esc(signatoryTitle)}<br/>` +
    `<a href="mailto:${esc(supportEmail)}" style="color:#9a9a9a;text-decoration:none">${esc(supportEmail)}</a> &middot; egirerobotics.com` +
    `</div></div></div>`
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
  let resendKey = env('RESEND_API_KEY');

  // Always consult mail_config for whatever isn't already set via env — in particular
  // resend_api_key must be checked independently of whether an env SMTP_HOST happens to
  // be set, so a configured Resend key always wins regardless of leftover SMTP env vars.
  try {
    const { data } = await adminClient()
      .from('mail_config')
      .select('smtp_host, smtp_port, smtp_user, smtp_pass, smtp_tls, mail_from, mail_reply_to, resend_api_key')
      .eq('id', true)
      .maybeSingle();
    if (data) {
      resendKey = resendKey || data.resend_api_key || undefined;
      if (!host) {
        host = data.smtp_host ?? host;
        port = data.smtp_port ?? port;
        tls = data.smtp_tls ?? tls;
        user = data.smtp_user ?? user;
        pass = data.smtp_pass ?? pass;
      }
      from = from || (data.mail_from ?? '');
      replyTo = replyTo || (data.mail_reply_to ?? '');
    }
  } catch (e) {
    console.error('mail_config lookup failed', e);
  }

  return {
    host,
    port,
    tls,
    user,
    pass,
    from: from || 'EgireRobotics <contact@egirerobotics.com>',
    replyTo: replyTo || 'contact@egirerobotics.com',
    // Resend is preferred over SMTP: GoDaddy's SMTP relay rejects Edge Functions'
    // shared/rotating cloud IPs with a 535 regardless of password correctness.
    resendKey,
  };
}

/**
 * Send a transactional email. Transport is chosen by config:
 *   1. Resend API key (env RESEND_API_KEY or mail_config.resend_api_key) -> Resend HTTP API
 *   2. SMTP host set (env SMTP_HOST or mail_config.smtp_host)            -> SMTP
 *   3. neither                                                          -> logged and skipped
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

  if (cfg.resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: opts.to, reply_to: replyTo, subject: opts.subject, html: opts.html, attachments: opts.attachments }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('Resend error', res.status, body);
      return { sent: false, skipped: `resend_error_${res.status}: ${body}`.slice(0, 300) };
    }
    return { sent: true };
  }

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

  console.log(`[email skipped — no transport] to=${opts.to} subject="${opts.subject}"`);
  return { sent: false, skipped: 'no_transport' };
}

/** The caller's IP as seen by the platform proxy (first hop of x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? (req.headers.get('x-forwarded-for') ?? '').split(',')[0];
  return (fwd ?? '').trim() || 'unknown';
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fixed-window rate limit kept in the database, so it holds across every function instance.
 * Throws 429 once `max` calls have been made with the same key inside `windowSec` seconds.
 * The key is hashed, so no IP address or email is stored in the limiter.
 */
export async function rateLimit(admin: ReturnType<typeof adminClient>, scope: string, subject: string, max: number, windowSec: number) {
  const key = `${scope}:${await sha256Hex(subject)}`;
  const { data, error } = await admin.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: windowSec });
  if (error) throw new HttpError(503, 'Please try again in a moment.'); // fail closed
  if (data === false) throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.');
}

/** Cloudflare Turnstile check. Active only when TURNSTILE_SECRET_KEY is configured for the function. */
export async function verifyCaptcha(token: unknown, ip: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return;
  if (typeof token !== 'string' || !token || token.length > 4096) throw new HttpError(400, 'Please complete the human check and try again.');
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== 'unknown') body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const out = (await res.json().catch(() => ({}))) as { success?: boolean };
  if (!out.success) throw new HttpError(400, 'The human check failed. Please try again.');
}

/**
 * Like requireUser, but for privileged actions: a person who turned on two-step verification must have passed it
 * for this session (aal2). A stolen password alone then cannot create users, accept registrations and so on.
 */
export async function requireStrongUser(req: Request, admin = adminClient()) {
  const user = await requireUser(req, admin);
  let aal = 'aal1';
  let sessionId = '';
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    aal = payload.aal ?? 'aal1';
    sessionId = payload.session_id ?? '';
  } catch {
    /* the token was already verified by requireUser; an unreadable aal counts as aal1 */
  }
  if (aal !== 'aal2') {
    const { data } = await admin.rpc('user_has_mfa', { p_uid: user.id });
    if (data === true) {
      // a session let in on a trusted device (the person chose "don't ask again here") counts as having passed the code
      const trusted = sessionId ? (await admin.rpc('trusted_session_valid', { p_uid: user.id, p_session: sessionId })).data === true : false;
      if (!trusted) throw new HttpError(401, 'Two-step verification is required. Sign out, sign in again and enter your code.');
    }
  }
  return user;
}
