---
name: fpv-crm-exam-engine
description: Explains how exams, grading, question banks, and certificate issuance actually work in fpv-crm — the pass_fail vs tiered grading modes, weighted question sampling, cross-course question pooling, fullscreen enforcement, and the start-exam/submit-exam edge functions. Use this whenever a task touches exams, the question bank, grading, attempts, cooldowns/max-attempts, or certificate issuance, so you extend the real mechanism instead of re-deriving or duplicating it.
---

# fpv-crm exam engine

Two edge functions own the entire exam lifecycle:
`supabase/functions/start-exam/index.ts` and
`supabase/functions/submit-exam/index.ts`. The frontend
(`src/pages/student/ExamFlow.tsx`) is a thin client over them — it never
computes scores or picks questions itself. If you're changing exam
behavior, change it there, not in the frontend.

## Two grading modes, one code path

`courses.grading_mode` is either `'pass_fail'` (the original, simple mode)
or `'tiered'` (weighted difficulty + letter grades). **The pass_fail path
must stay byte-identical in behavior** — every change here is written so
that when `grading_mode = 'pass_fail'`, the math and question-selection
reduce exactly to what they were before tiered grading existed. This
matters because two live courses (FPV Drone Fundamentals, Virtual FPV
Build) depend on the old behavior never silently changing.

**Question selection** (`start-exam`):
- `pass_fail`: uniformly shuffle the course's active question pool, take
  `exam_question_count`.
- `tiered`: pool = this course's own questions **plus** any course listed
  as a `source_course_id` in `exam_pool_sources` for it (this is how the
  "Comprehensive" exam draws from all 7 category courses with no
  questions of its own). Sample `mix_hard`/`mix_medium`/`mix_easy` per
  difficulty tier, then backfill from whatever's left if a tier came up
  short, so the exam still hits the target count.

**Scoring** (`submit-exam`):
- Every question has `points` (default `1`). `scorePct = earnedPoints /
  totalPoints * 100` — when every question is worth 1 point (the
  pass_fail-mode default), this is mathematically identical to
  `correctCount / total * 100`, i.e. nothing changed for old courses.
- `pass_fail`: `passed = scorePct >= course.pass_pct`.
- `tiered`: derive a `grade_label` from thresholds — ≥80 "Grade 1", ≥70
  "Grade 2", ≥50 "Grade 3", ≥35 "Grade 4", else "Failed" — and
  `passed = grade_label !== 'Failed'`.

## Attempts, cooldowns, locking

`exam_attempts` tracks `attempt_no`, `status` (`in_progress`/`submitted`/
`expired`), `expires_at`, `cooldown_until`, `locked`. `start-exam`
resumes an unexpired in-progress attempt if one exists, expires a stale
one (counting it as used), blocks starting once `max_attempts` is
exhausted (setting `locked = true`), and enforces `cooldown_until` between
failed attempts. An instructor/admin resets a student's exam by clearing
these fields directly (there's no dedicated UI for it yet — do it via SQL
or add one if asked).

## Fullscreen enforcement

`ExamFlow.tsx` gates the exam behind a "ready" screen requiring a real
click (browsers refuse `requestFullscreen()` without one) before entering
`document.documentElement.requestFullscreen()`. While `phase === 'exam'`,
a `fullscreenchange` listener shows a full-screen blocking overlay the
instant the student exits fullscreen — the countdown keeps running
underneath so they can't stall the clock by ducking out, but they can't
see or answer questions until they return. Fullscreen is released
automatically once the attempt reaches `result`/`error`.

## Question bank

`src/pages/admin/QuestionBank.tsx` is where staff author questions. It
currently only sets `prompt`/`type`/`explanation`/`is_active` — it does
**not** expose a difficulty or points picker, so a question added there on
a `tiered` course silently defaults to `difficulty = 'medium'`,
`points = 1`. If you're asked to improve tiered-course authoring, this is
the gap to close.

## Certificates

On a pass, `submit-exam` marks the enrollment `completed` and calls the
`generate-certificate` edge function, which issues a `certificates` row
with a `cert_id_string` (sequenced via `cert_counters`, a service-role-only
table) and emails/attaches the PDF. `src/pages/admin/AdminCertificates.tsx`
lets staff revoke/reinstate a certificate with a reason; the public
verification page reflects `revoked` immediately.

## Adding a new tiered/certification course

This project has done this exact migration once already (see
`supabase/migrations/0016_tiered_exam_engine.sql` and the git history
around it) — the pattern to follow:
1. Insert the `courses` row with `grading_mode = 'tiered'` and its
   `mix_hard`/`mix_medium`/`mix_easy` weights (they don't have to sum to
   `exam_question_count` exactly — the backfill step covers any shortfall).
2. Bulk-insert `questions` + `question_options` with real
   `difficulty`/`points` values (`easy`→1, `medium`→2, `hard`→3 is the
   convention used so far, but not enforced in code).
3. If this course should pool from others (or be pooled *into* a
   "Comprehensive"-style exam), add rows to `exam_pool_sources`.
4. Deploy nothing extra — `start-exam`/`submit-exam` already branch on
   `grading_mode`, so a new tiered course works with zero code changes.
