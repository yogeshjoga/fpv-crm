---
name: fpv-crm-admin-panel
description: Explains the fpv-crm admin panel's structure — every /admin page and what it's for, the route-guard hierarchy (RequireRole vs RequireModule), the instructor-permission system and Instructor-view preview, and Course Groups' bulk-enrollment behavior. Use this whenever a task touches anything under src/pages/admin, the admin sidebar/nav, staff roles or permissions, or Course Groups — so you extend the existing role/permission model instead of inventing a parallel one.
---

# fpv-crm admin panel

Every admin page lives in `src/pages/admin/`, is registered in
`adminNav` (`src/layout/navConfig.ts`) and routed in `routes.tsx` under
the `/admin` layout (`Shell nav={adminNav} area="Admin"`). The single most
accurate description of what each page does — kept in sync deliberately —
is the in-app page itself: `src/pages/admin/AdminHelp.tsx`, served at
`/admin/help`. Read that (or its rendered page) before this skill if you
want the full one-paragraph-per-section tour; this skill focuses on the
*mechanics* underneath.

## Two tiers of staff, three levels of gating

Roles: `instructor` and `super_admin` (both count as "staff" via
`is_staff()`). Three route-guard components in `src/auth/guards.tsx`
layer on top of each other:

1. **`RequireRole roles={[...]}`** — hard, non-configurable. Used for the
   truly sensitive pages: `Analytics`, `Employees`, `Users`, `Settings`
   are all `RequireRole roles={['super_admin']}`. These are *never* in the
   configurable permission system below — there's no toggle that can
   expose them to an instructor.
2. **`RequireModule moduleKey="..."`** — configurable per-instructor
   access, backed by the `instructor_module_access` table
   (`module_key`, `access_level`: `'none' | 'read' | 'write'`, default
   `'read'` if a module has no row yet — **read-only, not full access, is
   the safe default**). A `super_admin` always passes; an `instructor` is
   redirected to `/admin` only when their level is `'none'`. This wraps
   the "operational" pages: Registrations, Enrollment Requests, Account
   Approvals, Courses, Course Groups, Enrollment Forms, Calendar,
   Notifications, Certificates, Questions, Help.
3. The admin **Dashboard** (`/admin` index route) is wrapped in neither —
   it's always reachable, because both `RequireRole` and `RequireModule`
   redirect *to* `/admin` on failure, and gating the dashboard itself
   would loop.

Getting into a module (`'read'` or `'write'`) is only half the story —
**every write affordance inside that page (buttons, forms, uploads,
toggles) is gated separately**, via `useAdminAccess().canWrite(moduleKey)`
from `src/layout/AdminAccessContext.tsx`. `Shell.tsx` provides this
context around `<Outlet/>`, computing `canWrite` from the same
`access_level` data `RequireModule` uses. The pattern in every admin page
that has write actions:
```tsx
const { canWrite } = useAdminAccess();
const writable = canWrite('registrations'); // your module's key
// ...
{writable && <Button onClick={doTheWrite}>New thing</Button>}
```
When a page shows a view/edit modal for a single item (e.g. Registrations'
"Review" modal), the read-only path isn't just "hide the button" — the
modal itself renders a read-only summary instead of the editable
form/action buttons (see `Registrations.tsx`'s `ReviewModal` for the
reference shape), or the same form fields render with `disabled={!writable}`
and the Save button disappears (see `CourseBuilder.tsx`'s lesson editor).
**When you add a write action to any of these pages, gate it the same
way** — an ungated mutation button is a real permission hole, not a
cosmetic miss, since RLS still lets an `instructor` role write those
tables directly (module access is an app-level UX/workflow gate on top of
RLS, not a replacement for it).

`src/layout/navConfig.ts`'s `adminNav` entries carry a `key` (matching
`instructor_module_access.module_key`) and an optional `superAdminOnly`
flag; `CONFIGURABLE_MODULES` is derived from that array (excluding
`superAdminOnly` items and `dashboard`) and is what both the Settings UI
and the nav-filtering logic iterate over — **add a new admin page by
giving its `NavItem` a `key`, and it automatically becomes configurable**
(or add `superAdminOnly: true` if it should never be).

### Where the permission is configured and previewed

- **Configure**: `/admin/settings` → "Instructor module access" — a
  Hidden/Read only/Read & write dropdown per configurable module, writing
  straight to `instructor_module_access` (super_admin-only write per RLS).
- **Preview**: a super_admin sees an "Instructor view" toggle in the admin
  header (`src/layout/Shell.tsx`, next to "Student view"). Toggling it
  drives both the sidebar filter *and* the `AdminAccessContext` `canWrite`
  value the same way a real instructor session would — so a super_admin
  can click through and see the actual disabled/hidden write controls, not
  just a filtered nav. It's still only a simulation for route access
  itself: a super_admin's own `RequireModule`/`RequireRole` checks look at
  the real `profile.role`, so they can still navigate anywhere by URL
  while previewing.
- **Enforcement logic** lives in `src/lib/moduleAccess.ts`
  (`useInstructorModuleAccess()` — a small in-memory cache per browser
  tab, `getAccessLevel()`/`isModuleVisible()`/`isModuleWritable()`,
  `invalidateModuleAccessCache()` to call after writing the table).

If you add a new admin page and want it instructor-configurable: wrap its
route in `<RequireModule moduleKey="your-key">` in `routes.tsx`, give it a
matching `key` in `navConfig.ts`, gate every write affordance inside it
with `useAdminAccess().canWrite('your-key')`, and add a row for it in the
`instructor_module_access` seed data (or just let it default to `'read'`).

## Course Groups — bulk enrollment, not a parallel access model

`course_groups` + `course_group_courses` + `course_group_members`
(`src/pages/admin/CourseGroups.tsx`) exist purely as a *bulk-action
convenience* over the real access-control table, `enrollments` — they are
**not** a second source of truth for who can access what:

- Adding a course to a group immediately `upsert`s an `enrollments` row
  for every current member into that course.
- Adding a student to a group immediately `upsert`s an `enrollments` row
  for them into every course currently in the group.
- Removing either from a group is deliberately **non-destructive** — it
  only stops *future* auto-enrolling. It never revokes access already
  granted (that stays a manual action from `/admin/users` → "Manage
  access"). Deleting a group entirely follows the same rule.

This means every other part of the system (exam access checks, course
viewer gating, certificates) needs zero awareness of groups — they only
ever look at `enrollments`, same as before groups existed. If you extend
Course Groups, preserve this: groups should stay a UI convenience layer
over `enrollments`, never a second thing `is_enrolled()` or an edge
function has to check.

## Admin UI patterns to reuse

Nearly every admin page follows the same shape: `useQuery` fetches a list
(+ any join data needed), a `GlassCard` grid or table renders it, a
`Modal` handles create/edit, and mutations are plain `supabase.from(...)`
calls followed by `toast(...)` + `q.refetch()` — no separate state
management layer. See `fpv-crm-ui-conventions` for the component-level
details. Look at `AdminCourses.tsx` or `CourseGroups.tsx` as reference
implementations before writing a new admin page from scratch.
