---
name: fpv-crm-database-schema
description: Reference for the fpv-crm Supabase schema — every table, the RLS helper-function pattern, storage buckets, and the exact workflow for writing/applying a new migration. Use this whenever a task touches the database in this repo — adding a column, a table, an RLS policy, a storage bucket, or when you need to know "what tables exist" / "how is enrollment modeled" / "what RLS policy governs X" instead of grepping supabase/migrations yourself. Pairs with fpv-crm-orientation for the big picture.
---

# fpv-crm database schema

Supabase project ref: **`txbrnewcztixcagdnnfx`**. All schema changes live as
numbered SQL files in `supabase/migrations/`, applied in order and never
edited after the fact (0001 → 0020 as of this writing — check
`ls supabase/migrations` for the current tip before assuming a number).

## RLS helper functions (defined once, used everywhere)

Every policy in this project is built from four SECURITY DEFINER functions
(see `supabase/migrations/0002_rls_policies.sql`):

- `public.is_staff()` — true for `instructor` or `super_admin`.
- `public.is_super_admin()` — true only for `super_admin`.
- `public.is_active_user()` — true for a signed-in profile with
  `status = 'active'`.
- `public.is_enrolled(course uuid)` — true if the caller has an active
  enrollment in that course.

The overwhelmingly common policy shape is:
```sql
create policy x_staff on public.x for all using (public.is_staff()) with check (public.is_staff());
```
for staff-managed tables, plus a narrower `for select` policy for the
owning user (`student_id = auth.uid()` / `staff_id = auth.uid()`) where
students/staff need to read their own rows. Follow this shape for any new
table rather than inventing a new pattern.

## Tables, grouped by area

**Identity & org**
- `profiles` — one row per auth user; `role` (student/instructor/
  super_admin), `status` (pending/active/suspended), `archived_at` for
  soft-delete, `must_change_password`.
- `staff_details` — department/designation/employee_code for staff.
- `org_settings` — single-row (`id = true`) org-wide config: branding
  URLs, cert ID prefix, verification base URL, default exam parameters
  seeded onto new courses, the Google Forms webhook secret.
- `mail_config` — service-only SMTP fallback config (RLS blocks all client
  access; only edge functions read it).

**Courses & content**
- `courses` — title/slug/course_code, `status` (draft/published/archived),
  `pass_pct`, `exam_time_limit_min`, `exam_question_count`, `max_attempts`,
  `cooldown_hours`, `cover_image_url`, and the tiered-grading columns
  `grading_mode` ('pass_fail'|'tiered'), `mix_hard`/`mix_medium`/`mix_easy`.
- `modules` → `lessons` (kind/content/video_url/embed_url) →
  `lesson_resources` (downloadable files).
- `questions` — `course_id`, `prompt`, `type` ('single'|'multi'),
  `difficulty` ('easy'|'medium'|'hard', default 'medium'), `points`
  (default 1), `is_active`. `question_options` holds the choices with
  `is_correct`.
- `exam_pool_sources` — `(course_id, source_course_id)` pairs letting one
  course (e.g. a "Comprehensive" exam) draw its question pool from several
  other courses' banks. See `fpv-crm-exam-engine`.

**Enrollment pipeline**
- `registrations` — new-lead intake (public form / Google Form / CSV
  import), with `payment_status`/`payment_amount`/`payment_ref`.
- `enrollment_forms` + `enrollment_form_fields` — admin-built forms;
  `is_public` decides whether submissions land in `registrations` (no
  login) or `enrollment_requests` (existing student, specific course).
- `enrollment_requests` + `enrollment_request_answers`.
- `enrollments` — `(student_id, course_id)` unique, `status`
  ('active'|'completed'|'revoked'), `enrolled_by`. This is the actual
  access-control row course pages/exams check.
- `course_groups`, `course_group_courses`, `course_group_members` — bundle
  courses into a "workshop," and bulk-grant enrollments to every member
  when a course or student is added to the group. See `fpv-crm-admin-panel`.

**Exams & certificates**
- `exam_attempts` — `question_ids_json` (the drawn set), `attempt_no`,
  `status`, `expires_at`, `score_pct`, `passed`, `grade_label` (tiered
  courses only), `cooldown_until`, `locked`.
- `exam_attempt_answers` — per-question selected options + correctness.
- `certificates` — `cert_id_string`, `score_pct`, `revoked`/
  `revoked_reason`.
- `cert_counters` — service-role-only sequence for certificate IDs; RLS
  enabled with **no** policies at all is intentional here, not a bug.

**Operational**
- `calendar_events`, `notifications`, `broadcasts` (admin → students/staff
  announcements), `support_threads` + `support_messages` (the "Ask us"
  feature), `showcase_posts`/`showcase_likes`/`showcase_comments`.
- `study_time` (student_id, course_id, day, seconds) and
  `staff_activity_time` (staff_id, day, seconds) — day-bucketed active-time
  counters, written only through the SECURITY DEFINER RPCs
  `increment_study_time` / `increment_staff_activity` so a client can only
  ever add time for itself. `src/lib/streak.ts` derives daily-streak stats
  from `study_time` client-side — no separate streak table exists.
- `instructor_module_access` — `(module_key, access_level)` where
  `access_level` is `'none' | 'read' | 'write'` (default `'read'` — not
  `'write'` — when a module has no row yet). Drives both whether an
  instructor role can reach an admin section at all and whether write
  actions inside it render. See `fpv-crm-admin-panel`.

## Storage buckets

| Bucket | Public? | Used for |
|---|---|---|
| `branding` | yes | org logo / signature image |
| `course-covers` | yes | course catalog cover images |
| `course-resources` | no | lesson downloadable files (signed URLs) |
| `certificates` | no | generated certificate PDFs |
| `enrollment-uploads` | no | files attached to registration/enrollment forms |
| `showcase` | no | student build-showcase photos |

Bucket RLS follows the same `is_staff()`/`is_super_admin()`-gated-write,
scoped-or-public-read pattern as table RLS — see
`supabase/migrations/0003_storage_and_seed.sql` for the canonical example
(the `branding` bucket policies).

## Writing and applying a migration

1. Create `supabase/migrations/00NN_short_description.sql` — next sequential
   number, never reuse or edit a prior one.
2. Make it additive: new columns get `default` values, new tables get
   `enable row level security` plus explicit policies, nothing existing
   gets dropped or renamed without a very deliberate reason.
3. Apply it with the Supabase MCP `apply_migration` tool (`project_id`
   `txbrnewcztixcagdnnfx`, `name` matching the filename minus the number,
   `query` = the file contents) — this both runs it and records it in
   Supabase's migration history.
4. If you added or changed a table/column, regenerate TypeScript types with
   the MCP `generate_typescript_types` tool and write the result over
   `src/lib/database.types.ts` (it's fully generated — don't hand-edit it).
5. Run `npm run lint` (`tsc --noEmit`) to confirm the frontend still
   compiles against the new types.

Never hand-run one-off SQL against production data through anything other
than a tracked migration, *except* genuine one-time data fixes/backfills —
and even then, prefer writing it as a migration file so it's reproducible
and visible in history.
