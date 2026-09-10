# EgireRobotics LMS + Examination + Certification Platform — Design Spec

**Date:** 2026-09-09
**Status:** Approved, in development
**Supersedes:** the existing CRM in this repo (CRM modules removed entirely)

## 1. Summary

Replace the CRM in this repo with a Learning Management + Examination + Certification
platform for EgireRobotics, focused on FPV / drone courses. Students self-register,
get their account activated by an admin, submit an admin-built enrollment form for a
course, and — once approved — study the course and take a timed multiple-choice exam.
Passing auto-generates a branded PDF certificate with an embedded QR code, emails it to
the student, and exposes it on a public certificate-verification page.

Keep the existing glassmorphic design system and app shell. Rebuild all logic on top of
Supabase (Auth, Postgres + RLS, Storage, Edge Functions) with Resend for transactional
email.

## 2. Confirmed decisions

| Topic | Decision |
| --- | --- |
| CRM | Removed entirely. Keep design system, `TopNav`/`Sidebar` (restyled), `motion`, `lucide`, `recharts`. |
| Stack | Vite + React 19 + TS + Tailwind v4 SPA + `react-router` + `@supabase/supabase-js`. |
| Backend | Supabase project `egirerobotics-lms` (`txbrnewcztixcagdnnfx`), region ap-south-1. |
| Auth | Email/password **+ Google OAuth**. Email verification on. Password reset. No admin-only provisioning gate on sign-up itself. |
| Account lifecycle | Self sign-up → `profiles.status = pending` → **admin activates** → student can use the app. |
| Roles | `super_admin`, `instructor`, `student` (in `profiles.role`). Role-based access, no per-feature toggles. |
| Enrollment | Admin builds a Google-Forms-style **enrollment form** per course/batch, shares a URL. Logged-in student submits → `enrollment_requests` (pending) → **admin approves** → `enrollments` row (course unlocks). |
| Course model | Course → Modules → Lessons; PDF resources per lesson; one final exam per course. |
| Exam | MCQ (single + multi answer), timed, N questions drawn randomly from a per-course question bank, options shuffled. Server-side grading. Configurable pass %, question count, time limit per course. |
| Retakes | Max attempts (default 3) + cooldown (default 24h), both per-course configurable. Exhausted → locked, needs instructor reset. Best attempt recorded. Certificate issued on first passing attempt. |
| Certificate | Branded PDF (`pdf-lib`) with student name, course, date, score, unique cert ID (`EGR-<COURSE>-<YEAR>-<SEQ>`), embedded QR code linking to the verification page, signatory. Stored private in Storage; emailed as attachment; downloadable by owner. |
| Verification | Public page: enter/scan a cert ID → shows validity, student name, course, issue date, score, revoked flag. Backed by a `SECURITY DEFINER` RPC returning only safe fields. |
| Email | Resend, called from edge functions. From `EgireRobotics <no-reply@mail.egirerobotics.com>`. |
| First build | End-to-end thin slice (see §9). |

### Open assumptions (correct if wrong)
- Google OAuth allows **any** Google account (no domain restriction).
- Course-level completion tracking in the thin slice (per-lesson progress marks are post-MVP).
- One active enrollment form per course at a time (older forms can be closed).
- Certificate PDF is not shown on the public verification page (only metadata); owner downloads via signed URL.

## 3. Architecture

- **Frontend:** SPA. `react-router` with public, student, and admin route groups. Supabase JS
  client for auth + direct table reads/writes (guarded by RLS). Privileged operations call
  Edge Functions.
- **Database:** Postgres with RLS on every table. Helper `auth.uid()`-based policies plus a
  `current_role()` SQL helper reading `profiles.role`.
- **Edge Functions (Deno, service role):**
  - `start-exam` — authorize (active account, active enrollment, not locked, cooldown elapsed,
    attempts remaining); create `exam_attempts` row with `started_at` / `expires_at`; pick N
    random active questions; return questions + options **without `is_correct`**; persist
    `question_ids_json`.
  - `submit-exam` — verify attempt ownership + not expired (server clock); grade against DB;
    write `exam_attempt_answers`, `score_pct`, `passed`; on pass → invoke `generate-certificate`;
    on fail → set `cooldown_until`, increment attempt count, set `locked` when exhausted.
  - `generate-certificate` — allocate cert ID; render PDF over branded background; generate QR
    (`<verify_base_url>/verify/<certId>`); upload to `certificates` bucket; insert `certificates`
    row; email via Resend with PDF attached.
  - `invite-or-notify` (thin helper) — send account-activated / enrollment-approved / attempts-locked emails.
- **Storage buckets:** `branding` (public read), `course-resources` (private; enrolled students
  read via signed URL), `enrollment-uploads` (private; owner write, admin read), `certificates`
  (private; owner read via signed URL).
- **RPC:** `verify_certificate(cert_id text)` — `SECURITY DEFINER`, returns
  `{ valid, student_name, course_title, issued_at, score_pct, revoked }`.

## 4. Data model

Identity / org
- `profiles` — `id` PK = auth uid, `full_name`, `email`, `phone`, `role` enum, `status` enum
  (`pending|active|suspended`), `avatar_url`, `created_at`.
- `org_settings` — singleton row: `org_name`, `logo_url`, `signatory_name`, `signatory_image_url`,
  `cert_id_prefix`, `default_pass_pct`, `default_time_limit_min`, `default_question_count`,
  `default_max_attempts`, `default_cooldown_hours`, `support_email`, `verify_base_url`.

Courses / content
- `courses` — `id`, `title`, `slug` unique, `summary`, `description`, `cover_image_url`,
  `status` (`draft|published|archived`), `pass_pct`, `exam_time_limit_min`, `exam_question_count`,
  `max_attempts`, `cooldown_hours`, `course_code` (for cert IDs), `created_by`, timestamps.
- `modules` — `id`, `course_id` FK, `title`, `position`.
- `lessons` — `id`, `module_id` FK, `title`, `position`, `content` (rich text / markdown), `video_url`.
- `lesson_resources` — `id`, `lesson_id` FK, `file_path`, `file_name`, `mime`, `size_bytes`, `uploaded_by`.

Question bank
- `questions` — `id`, `course_id` FK, `prompt`, `type` (`single|multi`), `explanation`, `is_active`, `created_by`.
- `question_options` — `id`, `question_id` FK, `label`, `is_correct` (never selected by client), `position`.

Enrollment form builder
- `enrollment_forms` — `id`, `course_id` FK, `title`, `slug` unique, `description`, `is_open`,
  `opens_at`, `closes_at`, `created_by`.
- `enrollment_form_fields` — `id`, `form_id` FK, `label`, `field_type`
  (`text|textarea|select|multiselect|number|email|phone|date|file|checkbox`), `options_json`,
  `required`, `help_text`, `position`.
- `enrollment_requests` — `id`, `form_id` FK, `course_id` FK, `student_id` FK, `status`
  (`pending|approved|rejected`), `submitted_at`, `reviewed_by`, `reviewed_at`, `review_note`.
- `enrollment_request_answers` — `id`, `request_id` FK, `field_id` FK, `value_text`, `value_json`, `file_path`.
- `enrollments` — `id`, `student_id` FK, `course_id` FK, `source_request_id` FK, `status`
  (`active|completed|revoked`), `enrolled_at`, `enrolled_by`. Unique `(student_id, course_id)`.

Exams / certificates
- `exam_attempts` — `id`, `enrollment_id` FK, `student_id` FK, `course_id` FK, `attempt_no`,
  `status` (`in_progress|submitted|expired`), `started_at`, `expires_at`, `submitted_at`,
  `score_pct`, `passed`, `question_ids_json`, `cooldown_until`, `locked`.
- `exam_attempt_answers` — `id`, `attempt_id` FK, `question_id` FK, `selected_option_ids_json`, `is_correct`.
- `certificates` — `id`, `cert_id_string` unique, `student_id` FK, `course_id` FK, `attempt_id` FK,
  `score_pct`, `issued_at`, `pdf_path`, `qr_url`, `revoked`, `revoked_reason`.

Post-MVP: `audit_log`, `notifications`, `lesson_progress`, CSV bulk import, analytics rollups.

## 5. RLS policy summary

- `profiles`: user selects/updates own row except `role`/`status`; `super_admin` updates any;
  `instructor`+`super_admin` select all.
- `org_settings`: any authenticated select; `super_admin` update.
- `courses`/`modules`/`lessons`/`lesson_resources`: `status=published` selectable by any active
  user; drafts by `instructor`/`super_admin`; writes by `instructor`/`super_admin`.
- `questions`: `instructor`/`super_admin` full. `question_options`: **select restricted to
  `instructor`/`super_admin`** — students never read options directly; they receive sanitized
  questions from `start-exam`.
- `enrollment_forms`/`enrollment_form_fields`: selectable by any active user (needed to render
  the shared URL); writes by `instructor`/`super_admin`.
- `enrollment_requests` + `_answers`: student inserts/selects own; `instructor`/`super_admin`
  select all + update `status`.
- `enrollments`: student selects own; `instructor`/`super_admin` manage.
- `exam_attempts` + `_answers`: student selects own; inserts/updates only via service role;
  `instructor`/`super_admin` select all.
- `certificates`: student selects own; writes via service role only; public read only through
  `verify_certificate` RPC.
- Storage: policies mirror the above (owner-scoped paths `{uid}/...`; enrolled-read for
  `course-resources`).

## 6. Key flows

**Sign-up / activation:** register (email+password or Google) → email verification → row in
`profiles` via trigger with `status=pending` → "Awaiting activation" screen → admin flips to
`active` (Approvals screen) → `invite-or-notify` emails the student → full access.

**Password reset:** standard Supabase `resetPasswordForEmail` → `/reset-password` sets new password.

**Enrollment:** admin builds form in Form Builder, marks `is_open`, copies `/enroll/<slug>` →
student opens (must be logged in + active) → fills fields (file fields upload to
`enrollment-uploads`) → `enrollment_requests` (pending) + `enrollment_request_answers` →
admin reviews on Enrollment Requests screen → approve creates `enrollments` (active) and emails
student; reject sets status + note.

**Study + exam:** student opens enrolled course → reads modules/lessons, downloads PDF resources
(signed URLs) → "Start Exam" (shows attempts left, cooldown, rules) → `start-exam` returns a
sanitized question set + starts the server timer → `ExamRunner` (countdown, question navigator,
local autosave, auto-submit on expiry) → `submit-exam` grades →
`ExamResult` (score, pass/fail, per-question review if enabled).

**Certificate:** on pass, `submit-exam` → `generate-certificate` → PDF in `certificates` bucket
+ `certificates` row + Resend email with attachment. Student sees it under `/app/certificates`
(download via signed URL).

**Verification:** anyone visits `/verify` → enters/scans cert ID → `verify_certificate` RPC →
shows valid/invalid, student name, course, issue date, score, revoked flag.

## 7. Frontend structure

```
src/
  lib/supabase.ts            Supabase client (env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
  auth/AuthProvider.tsx      session + profile (role, status) context
  auth/guards.tsx            <RequireAuth>, <RequireActive>, <RequireRole roles=[...]>
  routes.tsx                 react-router route tree
  ui/                        kept + extended design system (GlassCard, buttons, inputs, Pagination, Toast, Modal, DataTable)
  layout/                    AppShell (student), AdminShell, PublicShell — reuse Sidebar/TopNav restyled
  pages/public/              Landing, Login, Register, ForgotPassword, ResetPassword, VerifyCertificate, EnrollmentForm
  pages/student/             Dashboard, CourseCatalog, CourseViewer, ExamIntro, ExamRunner, ExamResult, Certificates, Profile
  pages/admin/               Dashboard, Approvals, Users, Courses, CourseBuilder, QuestionBank,
                             Forms, FormBuilder, FormResponses, EnrollmentRequests, Certificates, Settings
  features/                  data hooks per domain (useCourses, useEnrollment, useExam, useCertificates, ...)
supabase/
  migrations/                schema + RLS + RPC + seed
  functions/                 start-exam, submit-exam, generate-certificate, invite-or-notify
```

## 8. Non-goals (this phase)

CSV bulk import, notifications center, per-lesson progress, course prerequisites, i18n,
audit log UI, analytics dashboards beyond simple counts, proctoring, payment/checkout,
mobile app.

## 9. Thin-slice build sequence

1. **Project reset** — remove CRM pages/data/store/context; keep design system + shell;
   add `react-router`, `@supabase/supabase-js`; add `src/lib/supabase.ts`, `.env` wiring;
   rename app (title, metadata, README); base routes render placeholders.
2. **Schema v1** — one migration: enums, all §4 tables, `updated_at` triggers,
   `handle_new_user` trigger (creates `profiles` row, `status=pending`), `current_role()` helper,
   full RLS, `verify_certificate` RPC, seed `org_settings`. Create Storage buckets + policies.
3. **Auth** — `AuthProvider`, guards, Login, Register (email/password + Google), ForgotPassword,
   ResetPassword, "Awaiting activation" screen, sign-out.
4. **Admin core** — AdminShell + Dashboard counts; Approvals (activate/suspend accounts);
   Users (role assignment, super_admin); Settings (org_settings + branding upload);
   Courses list/create; CourseBuilder (modules/lessons, PDF upload); QuestionBank CRUD.
5. **Enrollment** — FormBuilder (text/select/checkbox/file fields) + Forms list + share URL;
   public `EnrollmentForm` render + submit; EnrollmentRequests review + approve/reject → `enrollments`.
6. **Student core** — AppShell + Dashboard (my courses, statuses); CourseCatalog (published);
   CourseViewer (modules/lessons/resources); ExamIntro.
7. **Edge functions** — `start-exam`, `submit-exam`, `generate-certificate` (`pdf-lib` + `qrcode`
   + Resend), `invite-or-notify`. Wire secrets (RESEND_API_KEY, etc.).
8. **Exam + certificate UX** — ExamRunner (timer, navigator, autosave, auto-submit), ExamResult,
   student Certificates list + download; public VerifyCertificate page.
9. **End-to-end pass** — seed one FPV course (modules, lessons, PDFs, ~30-question bank, form);
   run the full path: register → activate → enroll → approve → study → exam → pass → cert email →
   verify. Fix integration gaps. Configure Resend sending domain.

## 10. Risks / notes

- **Resend domain** (`mail.egirerobotics.com`) needs DNS verification by the user before real
  email sends; until then, functions log/send to a test address.
- **Google OAuth** requires the user to add Client ID/secret + redirect URL in the Supabase
  dashboard (Auth → Providers). Email/password works without it.
- **Exam timer integrity**: expiry enforced server-side in `submit-exam`; client countdown is
  cosmetic + triggers auto-submit.
- **Cert ID sequence**: allocate via a Postgres sequence per course code to avoid races.
- Double approval (account + enrollment) is intentional; both live on one Approvals screen.
