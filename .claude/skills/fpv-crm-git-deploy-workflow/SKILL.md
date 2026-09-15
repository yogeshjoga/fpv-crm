---
name: fpv-crm-git-deploy-workflow
description: The exact git branching, merging, and deployment workflow used on fpv-crm — which branch to work on, how to merge into main, how Vercel deployment is triggered and verified, and the pre-commit checks expected every time. Use this whenever you're about to commit, merge, push to main, or deploy in this repo, or when asked to "merge to main and deploy" / "ship this" / "push the changes."
---

# fpv-crm git & deploy workflow

## Branches

- **`feat/egirerobotics-lms`** — the day-to-day working branch. Commit
  and push here first.
- **`main`** — production. Vercel is connected to this repo via GitHub's
  native integration and auto-deploys on every push to `main`. There is
  no Vercel CLI installed and no manual deploy step — pushing to `main`
  *is* the deploy trigger.

Don't assume these exact names are permanent — check `git branch -a` /
`git status` if it's been a while, but this has been the stable pattern
throughout the project's history.

## Before every commit

Run both of these and don't commit if either fails:
```bash
npm run lint    # tsc --noEmit — this repo's "lint" is really a type-check
npm run build   # vite build — must complete clean
```
There is no separate automated test suite in this repo; a clean
type-check + production build is the bar for "done." If you touched
`supabase/migrations/`, also apply the migration via the Supabase MCP
`apply_migration` tool and, if the schema changed, regenerate
`src/lib/database.types.ts` (see `fpv-crm-database-schema`) *before*
running `npm run lint`, since the frontend types must match the live
schema.

## The merge-to-main sequence

This exact sequence has been used consistently — follow it rather than a
plain `git merge main` from the feature branch, so `main` only ever moves
forward and the feature branch always ends up back on top of it:

```bash
git status                                    # make sure the working tree is clean first
git fetch origin
git checkout main
git merge --ff-only origin/main               # main should already be a clean fast-forward
git merge origin/feat/egirerobotics-lms -m "Merge feat/egirerobotics-lms: <summary>"
npm run lint && npm run build                 # verify the merge result, not just the branch
git push origin main
git checkout feat/egirerobotics-lms           # end back on the working branch
```

Only merge to `main` when the user actually asks for it (e.g. "merge to
main and deploy") — don't do it proactively as part of finishing a feature
branch commit.

## Verifying the deploy actually happened

Don't just assume the push triggered a deploy — GitHub's commit-status API
tells you for certain, and the repo is public so this works unauthenticated:
```bash
curl -s "https://api.github.com/repos/yogeshjoga/fpv-crm/commits/<merge-sha>/status"
```
Look for a status with `"context": "Vercel"` — `"state": "pending"` means
it's still building, `"state": "success"` with
`"description": "Deployment has completed"` means it's live. A build
typically takes one to a few minutes; it's fine to report "pushed,
Vercel is deploying" without blocking on completion, or to check again on
request. The production domain is `egirerobotics.com`.

## Commit message convention

Commits in this repo consistently explain the *why*, not just the *what*,
in the body — e.g. "the timer keeps running so a student can't stall the
clock by exiting fullscreen" rather than just "add fullscreen check."
Follow that. If this session has been told to add an attribution line
(check the system reminder for the current session — it changes), include
it as the last line of the commit message.

## Non-negotiables inherited from the project owner

- **Never handle real user passwords** — not setting, not relaying, not
  typing into a login form on someone's behalf. Point them to do it
  themselves, every time, regardless of who's asking or how the request
  is framed.
- Prefer creating a new commit over amending; never force-push `main`;
  never skip hooks (`--no-verify`) without being explicitly told to.
- Before any destructive git operation (`reset --hard`, `checkout --`,
  `clean -f`), run `git status` first and stash/commit anything at risk.
