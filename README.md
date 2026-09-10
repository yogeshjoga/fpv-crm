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
  components/     NotificationBell, CalendarView (shared month grid)
  pages/student/  dashboard, catalog, course viewer, exam runner, certificates,
                  calendar, profile
  pages/admin/    dashboard, approvals, users, employees, courses + builder,
                  question bank, enrollment forms + builder + responses,
                  enrollment requests, calendar, notifications, certificates,
                  company settings
supabase/
  migrations/     schema, RLS, storage, seed, hardening
  functions/      start-exam, submit-exam, generate-certificate, notify,
                  broadcast, admin-create-user, register, form-intake,
                  accept-registration
```

## Staff, calendar & notifications

- **Employees** (`/admin/employees`, super-admin) — staff directory over `profiles`
  + `staff_details` (department, designation, joined date, code). "Add employee"
  calls the `admin-create-user` edge function (creates the auth user, elevates the
  role, emails a set-password link via Resend — or returns the link to copy while
  Resend is unconfigured).
- **Calendar** — shared `calendar_events` (session / exam_window / deadline /
  holiday / other, optional course link). Staff manage it at `/admin/calendar`;
  students see org-wide events plus events for their enrolled courses at
  `/app/calendar` (RLS-scoped).
- **Notifications** — `/admin/notifications` composes a message to an audience
  (all students / one course / all staff); the `broadcast` edge function fans it
  out to `notifications` rows + Resend emails and logs a `broadcasts` row. A
  notification bell in both shells shows unread items; `notify` and
  `generate-certificate` also drop bell notifications (account activated,
  enrollment approved, exam passed).

## Roles & lifecycle

| Role | Can do |
| --- | --- |
| `super_admin` | everything, incl. users/roles and company settings |
| `instructor` | courses, lessons, PDFs, question banks, enrollment forms, grade/view results |
| `student` | enrolled courses, exams, certificates |

There is **no public self-signup**. A new student comes in through a form:

1. They fill a **registration form** — either a built-in public form (`/register-form/<slug>`,
   no login) or a **Google Form** wired to the `form-intake` webhook (see below).
2. The submission lands in one **Registrations** queue (`/admin/registrations`) with a
   source badge and a pending count on the dashboard.
3. An admin opens **Review**, records the **payment** (status paid/waived, amount,
   reference, method — *Accept is blocked while it's "unpaid"*), picks which course(s)
   to grant, and clicks **Accept & create account**. The `accept-registration` edge
   function creates the auth user with a random password, sets `must_change_password`,
   creates the `enrollments` rows, drops a welcome notification, and emails the student
   `email + temp password` via Resend (or returns the temp password to the admin if
   Resend isn't configured). A "Save payment only" button records the payment without
   accepting yet. The manual gate is structured so a Razorpay webhook could flip the
   same `payment_status` later.
4. The student signs in with the temp password → is forced to `/set-password` → lands on
   `/app` seeing only the granted courses.

Existing enrollment forms still work for **already-registered** students requesting an
extra course: a private form at `/enroll/<slug>` → `/admin/enrollments` → approve.

### Google Forms → Registrations

**Company Settings ▸ Google Forms integration** shows a webhook URL and a ready-to-paste
Apps Script. In your Form: **Extensions ▸ Apps Script**, paste the script, then add an
**On form submit** trigger for `onEgireSubmit`. Each response POSTs to
`/functions/v1/form-intake?secret=…` and appears in the queue. Regenerate the secret from
the same panel (invalidates the old script).

## Course content

Each lesson has a **type**: **Article** (rich text — use for blogs/notes), **Video**
(YouTube/Vimeo — embedded), **Embed** (paste any URL — Sketchfab 3D model, a
VelociDrone/Uncrashed/Betaflight sim page, Google Slides, a hosted PDF — shown in an
iframe), or **Downloads only**. Lesson resources accept **PDF / PPT / DOC / XLS /
images**; images preview inline for students, everything else is a download.

## Branding

The EgireRobotics logo (inline SVG) is in every header, the landing page, and the
transactional email header; emails carry a *Yogesh Joga — Founder, EgireRobotics*
footer and are sent from `EgireRobotics <contact@egirerobotics.com>` with a
`Reply-To` of `contact@egirerobotics.com`, so student replies land in the real
Titan mailbox. The certificate signature line reads **Yogesh Joga / Founder,
EgireRobotics** (`org_settings.signatory_title`). Override the raster logo and
these fields any time in **Company Settings → Branding**.

### Email transport

`_shared/common.ts` `sendEmail()` picks a transport by env var, in order:

1. **`SMTP_HOST` set** → SMTP via denomailer. For GoDaddy/Titan:
   `SMTP_HOST=smtp.titan.email`, `SMTP_PORT=465`, `SMTP_TLS=true`,
   `SMTP_USER=contact@egirerobotics.com`, `SMTP_PASS=<mailbox password>`.
   Requires the domain's SPF + DKIM (`secureserver1/2._domainkey` CNAMEs) to be
   correct or Titan rejects the login with `535`.
2. **`RESEND_API_KEY` set** → Resend HTTP API.
3. **neither** → the email is logged and skipped; `accept-registration` returns
   the temp password to the admin so it can be shared manually.

Optional overrides: `MAIL_FROM` (defaults to `EgireRobotics <contact@egirerobotics.com>`),
`MAIL_REPLY_TO` (defaults to `contact@egirerobotics.com`). Set these in
**Supabase Dashboard → Edge Functions → Secrets**.

### Bootstrapping the first admin

Register through a public form and accept yourself, or in the Supabase SQL editor:

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

1. **Email transport** — set edge secrets so credential, certificate and broadcast
   emails actually send. Either SMTP (GoDaddy/Titan):
   ```bash
   supabase secrets set SMTP_HOST=smtp.titan.email SMTP_PORT=465 SMTP_TLS=true \
     SMTP_USER=contact@egirerobotics.com SMTP_PASS=<mailbox password>
   ```
   or Resend:
   ```bash
   supabase secrets set RESEND_API_KEY=re_... CERT_EMAIL_FROM="EgireRobotics <no-reply@mail.egirerobotics.com>"
   ```
   Until one is set those functions log the email and continue; `accept-registration`
   returns the temp password to the admin so it can be shared manually. See
   **Email transport** under Branding for the full var list.
2. **`org_settings.verify_base_url`** — set to the deployed app origin (used in QR codes,
   the Google Forms webhook URL, and email links). Editable from **Company settings**.

## Edge functions

Deployed via the Supabase dashboard / MCP. Source in `supabase/functions/`; each bundles
`_shared/common.ts`. `register` and `form-intake` run with `verify_jwt = false` (public
intake, secret-checked); all others require a JWT.
