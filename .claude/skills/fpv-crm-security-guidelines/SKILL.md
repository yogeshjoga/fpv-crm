---
name: fpv-crm-security-guidelines
description: The mandatory security rules (OWASP Top 10 aligned) for every change in fpv-crm — database/RLS, SECURITY DEFINER functions, edge functions, public endpoints, uploads, frontend rendering, admin and super-admin protection, dependencies. Use this BEFORE writing or reviewing any migration, edge function, API route, storage bucket, form, upload, admin feature or auth change, and before every commit that touches them. New work must follow this checklist; do not ship something that fails it.
---

# fpv-crm security guidelines (apply to all new work)

Standing instruction from the owner: everything developed from now on follows good security practice and OWASP. Admin and super-admin surfaces get the strictest treatment. Nothing is "unhackable", so the goal is layers: every layer must hold on its own.

## Before you write code
1. **Who may do this?** Name the roles. Default is deny. Students must never be able to read or change another person's data.
2. **Where is it enforced?** In the database (RLS / SECURITY DEFINER function with its own check) or in an edge function. The UI hiding a button is never the control.
3. **What can an attacker send?** Treat every input (body, query, headers, file, URL, JSON answers, metadata) as hostile.

## Database (A01, A03, A04)
- Every new table: `enable row level security` and explicit policies in the same migration. Use `has_module_access(key, level)`, `is_staff()`, `is_super_admin()` or `auth.uid()` ownership. Never `using (true)` for write, never grant to `anon` unless the data is truly public.
- SECURITY DEFINER functions: `set search_path = public` (or empty), check the caller inside (`auth.uid()` / `has_module_access`), `revoke all ... from public, anon, authenticated` then grant only who needs it. Triggers and service-only helpers are not callable by clients.
- Constrain data: `check` constraints on lengths, enums, URL schemes (`^https?://`), numeric ranges. Bound jsonb size.
- Privileged tables (profiles role/status, role_module_access, org_settings, staff_details, certificates revoke) are covered by the audit trigger `audit_row()`. Add it to any new privileged table.
- Secrets never live in a column that clients can select; service-only tables have RLS on and no policies.
- Test with a rolled-back `DO $$ ... raise exception ... $$` block, including a "should be denied" case.

## Edge functions and API routes (A01, A04, A07, A10)
- Authenticate with `requireUser`; use **`requireStrongUser`** for anything privileged (it demands the second factor from people who enabled it). Authorize by role from the database, not from the request.
- Public endpoints (no JWT): **rate limit** with `rateLimit(admin, scope, subject, max, windowSec)`, add the honeypot, call `verifyCaptcha`, cap payload size, validate every field, never echo internals in errors.
- Never fetch a URL a user supplied (SSRF). Never put secrets, tokens or passwords in logs or responses. Temporary passwords are returned only when the email failed.
- Accounts are only created by `admin.auth.admin.createUser` with `app_metadata: { provisioned: true }`; direct Auth sign-ups are blocked by a database trigger on purpose.
- CORS is not an auth control; the JWT check is.

## Frontend (A03, A05, A08)
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`. Render user text as text.
- Any URL from data goes through a scheme check (http(s) or an in-app path) before `href`/`src`/iframe. Never `javascript:`.
- Uploads: allowed MIME types and size limit set on the storage bucket, files in private buckets served by short signed URLs, ownership by folder = `auth.uid()`.
- Keep the CSP strict (`script-src 'self'`). Do not add `unsafe-inline`/`unsafe-eval` for scripts or new third-party script hosts without a reason.
- Do not store tokens or personal data in localStorage beyond Supabase's own session; do not put personal data in URLs.

## Admin and super admin (A01, A07, A09)
- Offer and, over time, expect two-step verification (Security page). The database treats an enrolled user without an aal2 session as not staff.
- Destructive or account-affecting actions need a step-up (password confirm, as `admin-delete-user` does), cannot target the last super admin or oneself, and show up in the audit log.
- Staff sessions end after 30 minutes idle. Suspended or archived staff stop passing `is_staff()` immediately.
- New admin features get a role/permission row (`role_module_access`) rather than a hard-coded email.

## Dependencies and delivery (A06, A08, A09)
- Run `npm audit --omit=dev` before merging; fix or document anything high or critical.
- Never commit keys or `.env`. The anon key is public by design; the service-role key never reaches the browser.
- Run the Supabase advisors (`get_advisors` security) after a migration and resolve new warnings.
- Say honestly what is protected and what is not. Do not claim a system "cannot be hacked".

## Dashboard-only settings (cannot be changed from code)
Leaked-password protection (Auth, Pro plan), minimum password length/complexity, JWT expiry, Auth rate limits, disabling email sign-up (already blocked by trigger), CAPTCHA site/secret keys for the registration form (`VITE_TURNSTILE_SITE_KEY` in Vercel, `TURNSTILE_SECRET_KEY` as the `register` function secret), custom SMTP.
