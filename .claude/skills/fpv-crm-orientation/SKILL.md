---
name: fpv-crm-orientation
description: Gives instant orientation on the EgireRobotics FPV drone training CRM/LMS repo (fpv-crm) — what it is, the stack, the folder layout, the domain model, and the hard rules to follow. Use this FIRST whenever you're picked up in this repo without prior context, whenever someone asks "what is this project" / "how does this codebase work" / "where do I start", or before touching any file here for the first time in a session. Also consult it whenever you're unsure which of the other fpv-crm-* skills (database-schema, exam-engine, admin-panel, git-deploy-workflow, ui-conventions) is the right deep-dive for the task at hand — this skill points to each of them.
---

# EgireRobotics FPV CRM/LMS — orientation

This is a training-operations CRM/LMS for **EgireRobotics**, an FPV/drone
training company. It runs the whole pipeline: a lead applies → gets
accepted and enrolled → studies course content → sits a timed exam → gets
an auto-issued, QR-verifiable certificate. There's a full admin panel for
staff to run all of that, and a public marketing site + certificate
verification page.

Read this skill fully before making changes here for the first time in a
session — it's short and saves you from re-deriving things by grepping the
whole tree. Then jump to whichever deep-dive skill matches your task:

| Task involves... | Read this skill |
|---|---|
| Tables, RLS, migrations, "how is X modeled in the DB" | `fpv-crm-database-schema` |
| Exams, grading, question banks, certificates | `fpv-crm-exam-engine` |
| Admin pages, nav, roles/permissions, Course Groups | `fpv-crm-admin-panel` |
| Committing, merging, deploying | `fpv-crm-git-deploy-workflow` |
| Building/styling any UI, forms, modals, tables | `fpv-crm-ui-conventions` |

## Stack

- **Frontend**: Vite + React 19 + TypeScript, `react-router-dom` v6 for
  routing, Tailwind for styling, `recharts` for charts, `lucide-react` for
  icons.
- **Backend**: Supabase — Postgres with Row-Level Security as the
  authorization layer (there is no separate backend server), Storage for
  files/images, and Deno Edge Functions for anything that needs to run with
  elevated privilege or call out to email providers.
- **Supabase project ref**: `txbrnewcztixcagdnnfx`. If you have the
  Supabase MCP tools available, that's the `project_id` to pass them.
- **Deploy**: Vercel, connected to GitHub with auto-deploy on push to
  `main`. No Vercel CLI is installed locally — deploys happen purely via
  the git push (see `fpv-crm-git-deploy-workflow`).
- **Auth**: Supabase Auth. Three roles live in `profiles.role`: `student`,
  `instructor`, `super_admin`. `instructor` and `super_admin` are
  collectively "staff."

## Folder layout

```
src/
  pages/
    public/    — landing, login, registration forms, cert verification
    student/   — everything behind /app (dashboard, catalog, exam, etc.)
    admin/     — everything behind /admin (staff-only)
  layout/      — Shell.tsx (the sidebar+header chrome), navConfig.ts
  auth/        — AuthProvider.tsx (session/profile context), guards.tsx
                 (RequireAuth / RequireActive / RequireRole / RequireModule)
  components/ui/ — kit.tsx (design-system primitives), shared.tsx (GlassCard)
  lib/         — supabase client, useQuery hook, invokeFn (edge functions),
                 streak.ts, moduleAccess.ts, slug.ts
  routes.tsx   — the single source of truth for every route + its guards

supabase/
  migrations/  — numbered, sequential, additive SQL files (0001, 0002, ...)
  functions/   — Deno edge functions; _shared/common.ts has the shared
                 helpers (adminClient, requireUser, HttpError, sendEmail, ...)
```

## Domain model, in one paragraph

A `course` has `modules` → `lessons` (with optional `lesson_resources`
downloads) and a bank of `questions`/`question_options`. A `student`
becomes eligible for a course via an `enrollment` (created from an accepted
`registration`, an approved `enrollment_request`, or an admin's direct
toggle). Enrolled + active students can start an `exam_attempt`, which
snapshots a drawn set of question IDs and a deadline; submitting it grades
against `exam_attempt_answers` and, on a pass, issues a `certificate` and
kicks off `generate-certificate`. Staff run all of this from `/admin`;
students live under `/app`.

## Hard rules — don't violate these

1. **Never handle real user passwords directly** — not setting them, not
   relaying them, not typing them into a form on a user's behalf, even if
   asked. This has been reinforced repeatedly across this project's
   history. Point the user to do it themselves.
2. **RLS is the only authorization boundary that matters.** Every table
   uses `public.is_staff()`, `public.is_super_admin()`,
   `public.is_active_user()`, or `public.is_enrolled(course)` —
   SECURITY DEFINER helper functions — in its policies. Never assume a
   client-side check (a hidden nav item, a disabled button) is a security
   boundary; if it matters, it must also be enforced in RLS or in an edge
   function using the service-role key.
3. **Soft-delete, never hard-delete**, for anything a human created —
   users, enrollments, exam history, certificates. See how
   `admin-delete-user` blocks sign-in via `profiles.archived_at` rather
   than deleting the row.
4. **Migrations are additive and backward-compatible.** New columns get
   sensible defaults so existing rows and existing code paths keep working
   unchanged. Never rewrite or renumber an already-applied migration file
   — add a new one. See `fpv-crm-database-schema` for the exact workflow.
5. **Always run `npm run lint` (which is `tsc --noEmit`) and `npm run
   build` before considering a change done.** This repo has no separate
   test suite; type-checking + a clean production build is the bar.
6. **Match the existing UI vocabulary** rather than introducing new
   patterns — see `fpv-crm-ui-conventions` before hand-rolling a card, modal,
   or form.

## Where to find "how does the admin panel explain itself"

There's a live in-app reference for every admin section, written for
humans: [`src/pages/admin/AdminHelp.tsx`](../../../src/pages/admin/AdminHelp.tsx),
served at `/admin/help`. If you change what an admin page does, update
that file too — it's meant to stay accurate, not just this skill.
