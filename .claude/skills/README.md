# fpv-crm Claude Skills

This folder holds project-context **Claude Skills** for the EgireRobotics
`fpv-crm` repo. They exist so that anyone — you on another laptop, a
teammate who just cloned the repo — gets a Claude that already understands
this codebase, instead of having to re-explain it or wait for Claude to
scan the whole tree from scratch.

## How to use this after cloning the repo

1. `git clone` / `git pull` this repo as normal — this folder comes along
   for free, no separate setup.
2. Open Claude Code in this repo. Claude Code looks for skills under
   `.claude/skills/` in the project automatically. If your version doesn't
   pick them up on its own, just say: *"read the skills in
   .claude/skills/ before we start"* — they're plain Markdown, so any
   Claude can read and use them directly even without the skill-loading
   mechanism.
3. Ask your question or describe your task as normal. Claude decides
   which skill(s) are relevant based on their descriptions — you don't
   need to name one explicitly, but you can (e.g. "check
   fpv-crm-database-schema for this") if you want to be sure.

## What's here

| Skill | Read it for |
|---|---|
| `fpv-crm-orientation` | The big picture — what this project is, the stack, folder layout, domain model, and the hard rules. **Start here.** |
| `fpv-crm-database-schema` | Every table, the RLS pattern, storage buckets, how to write/apply a migration. |
| `fpv-crm-exam-engine` | How exams/grading/question-banks/certificates actually work under the hood. |
| `fpv-crm-admin-panel` | The `/admin` pages, the role/permission system, Course Groups. |
| `fpv-crm-git-deploy-workflow` | Which branch to use, the exact merge-to-main sequence, how deploys work and how to verify one succeeded. |
| `fpv-crm-ui-conventions` | The design-system components and data-fetching pattern to reuse instead of reinventing. |

## Keeping these current

These are hand-written from the actual code and live database schema, not
generated once and forgotten. If you make a structural change — a new
table, a new admin section, a change to the exam engine, a change to the
deploy process — update the relevant skill in the same change, the way
you'd update a README. A skill that's gone stale is worse than no skill:
it actively misleads whoever reads it next.

If you want to add a new skill for a new area of the project, follow the
same shape: a `SKILL.md` with a `name` + `description` frontmatter (the
description is what makes Claude decide to use it — be specific about
*when* it applies) and a concise, factual body under ~300 lines.
