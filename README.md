# EgireRobotics LMS

Learning, examination and certification platform for EgireRobotics FPV & drone training.

Students self-register, an admin activates the account, the student submits an
admin-built enrollment form for a course, and once approved they study the course
and sit a timed multiple-choice exam. Passing auto-generates a branded PDF
certificate with an embedded QR code, emails it to the student, and exposes it on
a public verification page.

Design spec: [`docs/superpowers/specs/2026-09-09-egirerobotics-lms-design.md`](docs/superpowers/specs/2026-09-09-egirerobotics-lms-design.md)

## Stack

- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4 + `react-router`
- **Backend:** Supabase — Auth (email/password + Google OAuth), Postgres + RLS,
  Storage, Edge Functions (Deno). Transactional email via Resend.
- Supabase project: `egirerobotics-lms` (`txbrnewcztixcagdnnfx`, region ap-south-1)

## Local development

```bash
bun install
cp .env.example .env    # already filled for the egirerobotics-lms project
bun run dev             # http://localhost:3000
```

Scripts: `bun run dev` · `bun run build` · `bun run lint` (tsc) · `bun run preview`

## Project layout

```
src/
  lib/            supabase client, generated DB types, edge-function helper
  auth/           AuthProvider + route guards (RequireAuth / RequireActive / RequireRole)
  layout/         Shell (student + admin), PublicShell, nav config
  components/ui/  glassmorphic design system (shared.tsx, kit.tsx)
  pages/public/   landing, login, register, password reset, verify, enrollment form
  pages/student/  dashboard, catalog, course viewer, exam runner, certificates, profile
  pages/admin/    dashboard, approvals, users, courses + builder, question bank,
                  enrollment forms + builder + responses, enrollment requests,
                  certificates, company settings
supabase/
  migrations/     schema, RLS, storage, seed, hardening
  functions/      start-exam, submit-exam, generate-certificate, notify
```

## Roles & lifecycle

| Role | Can do |
| --- | --- |
| `super_admin` | everything, incl. users/roles and company settings |
| `instructor` | courses, lessons, PDFs, question banks, enrollment forms, grade/view results |
| `student` | enrolled courses, exams, certificates |

Self sign-up → `profiles.status = 'pending'` → **admin activates** on `/admin/approvals`
→ student submits an enrollment form (`/enroll/<slug>`) → **admin approves** on
`/admin/enrollments` → course unlocks.

### Bootstrapping the first admin

Sign up through the UI, then in the Supabase SQL editor:

```sql
update public.profiles
set role = 'super_admin', status = 'active'
where email = 'you@example.com';
```

## Exam & certificate

- MCQ (single + multi), N questions drawn at random from a per-course bank, options
  shuffled, server-side grading. Pass %, question count, time limit, max attempts and
  cooldown are per-course (defaults in **Company settings**).
- `start-exam` / `submit-exam` enforce enrolment, attempt limits, cooldown and the
  timer server-side. Correct answers never reach the browser.
- On a pass, `generate-certificate` builds the PDF (`pdf-lib` + `qrcode`), stores it
  privately in the `certificates` bucket, records a row, and emails it via Resend.
- Public check: `/verify` or `/verify/<CERT-ID>` → `verify_certificate` RPC (returns
  only name, course, date, score, validity).

## Configuration still required for production

1. **Custom SMTP / email** — the Supabase built-in mailer is rate-limited (≈2/hour).
   Add Resend under Supabase → Auth → SMTP, and set edge secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=re_... CERT_EMAIL_FROM="EgireRobotics <no-reply@mail.egirerobotics.com>"
   ```
   Until then `notify` / `generate-certificate` log the email and continue.
2. **Google OAuth** — Supabase → Auth → Providers → Google: add the OAuth client ID
   and secret; redirect URL `https://<your-app>/auth/callback`.
3. **`org_settings.verify_base_url`** — set to the deployed app origin (used in QR
   codes and email links). Editable from **Company settings**.
4. Review Supabase **email confirmation** setting for the sign-up experience you want.

## Edge functions

Deployed via the Supabase dashboard / MCP. Source in `supabase/functions/`; each
bundles `_shared/common.ts`. All run with `verify_jwt = true`.
