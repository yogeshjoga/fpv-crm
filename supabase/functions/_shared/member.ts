// Helpers for the website member sign-in functions (email codes).
import { HttpError } from './common.ts';

export const STAFF_ROLES = ['instructor', 'coordinator', 'admin', 'super_admin'];

export function normaliseEmail(value: unknown): string {
  const email = String(value ?? '').trim().toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Please enter a valid email address.');
  return email;
}

/** A keyed hash of the code. The key is the service-role key, which never leaves the server, so a leaked row cannot be brute-forced offline without it. */
export async function hashCode(email: string, code: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'no-key'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${email}:${code}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Escape a value for use in a Postgres ILIKE pattern, so an address with _ or % matches only itself. */
export const likeExact = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Cloudflare Turnstile check for the website. Active only when MEMBER_TURNSTILE_SECRET_KEY is set for the project's functions;
 * the website shows the widget when VITE_TURNSTILE_SITE_KEY is set. Kept separate from the registration form's key.
 */
export async function memberCaptcha(token: unknown, ip: string) {
  const secret = Deno.env.get('MEMBER_TURNSTILE_SECRET_KEY');
  if (!secret) return;
  if (typeof token !== 'string' || !token || token.length > 4096) throw new HttpError(400, 'Please complete the human check and try again.');
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== 'unknown') body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const out = (await res.json().catch(() => ({}))) as { success?: boolean };
  if (!out.success) throw new HttpError(400, 'The human check failed. Please try again.');
}
