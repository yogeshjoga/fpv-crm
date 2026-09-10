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
3. An admin opens **Review**, picks which course(s) to grant, and clicks **Accept &
   create account**. The `accept-registration` edge function creates the auth user with
   a random password, sets `must_change_password`, creates the `enrollments` rows, drops
   a welcome notification, and emails the student `email + temp password` via Resend
   (or returns the temp password to the admin if Resend isn't configured).
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

1. **Resend / email** — set edge secrets so credential, certificate and broadcast emails
   actually send:
   ```bash
   supabase secrets set RESEND_API_KEY=re_... CERT_EMAIL_FROM="EgireRobotics <no-reply@mail.egirerobotics.com>"
   ```
   Until then those functions log the email and continue; `accept-registration` returns
   the temp password to the admin so it can be shared manually.
2. **`org_settings.verify_base_url`** — set to the deployed app origin (used in QR codes,
   the Google Forms webhook URL, and email links). Editable from **Company settings**.

## Edge functions

Deployed via the Supabase dashboard / MCP. Source in `supabase/functions/`; each bundles
`_shared/common.ts`. `register` and `form-intake` run with `verify_jwt = false` (public
intake, secret-checked); all others require a JWT.
