---
name: fpv-crm-ui-conventions
description: The design-system components, data-fetching pattern, and visual style already established in fpv-crm — GlassCard, the kit.tsx primitives, useQuery/unwrap, invokeFn, and the glassmorphism Tailwind aesthetic. Use this whenever you're building or editing any page or component in this repo, so new UI matches the existing look and data-fetching pattern instead of introducing a second way of doing the same thing.
---

# fpv-crm UI conventions

This repo has one small design system and one data-fetching pattern, used
almost everywhere. Before writing a new page, skim an existing one of the
same kind (`src/pages/admin/AdminCourses.tsx` for an admin list+modal page,
`src/pages/student/StudentDashboard.tsx` for a student page) rather than
starting from a blank Tailwind slate.

## The component kit: `src/components/ui/kit.tsx`

- `Button` — variants `primary` (default, dark filled), `secondary`
  (white/70 glass), `ghost`, `danger`. Has a `loading` prop that swaps in
  a spinner icon and disables the button.
- `Field label hint error required` — wraps a form control with a label
  and optional hint/error text.
- `TextInput`, `TextArea`, `Select`, `Checkbox label`, `PasswordInput` (has
  a built-in show/hide eye toggle — always use this instead of a raw
  `<input type="password">`).
- `Badge tone` — `neutral | green | amber | red | blue`, used for status
  pills (`published`/`draft`, `active`/`suspended`, etc.).
- `Modal open onClose title wide?` — the standard dialog; pass `wide` for
  forms with more than ~2 fields.
- `PageHeader title subtitle actions?` — every page's top banner.
- `EmptyState icon title description action?` — the standard "nothing
  here yet" placeholder.
- `Spinner label?` — loading state.
- `useToast()` — call the returned function as `toast(message, 'error'?)`
  for a transient notification; default tone is success/neutral.

## `GlassCard` (`src/components/ui/shared.tsx`)

The one visual signature of this app: a translucent, blurred, rounded
(`rounded-[2rem]`) card with a soft inner border-highlight. `intensity`
is `'light' | 'medium' (default) | 'heavy'`. Almost every content block —
list rows, dashboard stats, modals' content area — sits inside one. Don't
reach for a plain `<div className="rounded-xl border ...">` when a
`GlassCard` fits; consistency here is the whole visual identity of the
app.

The overall page backdrop (set once in `src/index.css` on `body`) is a
soft multi-color radial gradient (`#eef2f6` base with blue/amber/green/
indigo blooms in the corners) — this is why `GlassCard`'s translucency
looks the way it does; don't put a page on a plain white background.

## Data fetching: `useQuery` + `unwrap`

There's no React Query / SWR here — just a minimal hand-rolled hook,
`src/lib/useQuery.ts`:
```tsx
const q = useQuery(async () => {
  const [a, b] = await Promise.all([
    unwrap(supabase.from('table_a').select('*')) as Promise<RowA[]>,
    unwrap(supabase.from('table_b').select('*')) as Promise<RowB[]>,
  ]);
  return { a, b };
}, [dep1, dep2]);
// q.data, q.loading, q.error, q.refetch()
```
`unwrap(promise)` takes a raw Supabase `{ data, error }` response and
either returns `data` or throws — it's typed loosely (`unknown` by
default) because PostgREST's embedded-select return shapes don't survive
the generated `Database` types, so callers cast the expected shape
explicitly with `as Promise<T>`. This is deliberate, not a TODO.

After a mutation (`supabase.from(...).insert/update/delete`), the pattern
is always: check `error` → `toast(error.message, 'error')` and bail;
otherwise `toast('done message')` then `q.refetch()`. No separate
optimistic-update layer.

## Calling edge functions: `invokeFn`

```tsx
const res = await invokeFn<ResponseType>('function-name', { some: 'body' });
```
`src/lib/functions.ts` wraps `supabase.functions.invoke`, forwards the
current session's JWT automatically, and unpacks the `{ error }` JSON body
an edge function returns on failure into a normal thrown `Error`. Use this
rather than calling `supabase.functions.invoke` directly.

## Scoping queries to "myself" on student pages

Student-facing pages that combine `enrollments`/`study_time`/etc. always
add `.eq('student_id', uid)` explicitly, even though RLS would already
restrict a student to their own rows. Reason: staff viewing "Student
view" would otherwise see *every* student's rows unfiltered (since
`is_staff()` passes the RLS check too) and get double-counted stats or
duplicated course cards. Keep this explicit scoping when writing new
student pages.

## Icons and layout primitives

- Icons: `lucide-react`, sized `13`–`22` depending on context (small
  inline icons ~13–15, section headers ~17–18, empty-state icons ~22).
- Admin/student shells (`src/layout/Shell.tsx`) give the sidebar and main
  content **independent scroll regions** (`h-screen overflow-hidden` on
  the outer flex row, `overflow-y-auto` on both the `<aside>` and
  `<main>`) — don't reintroduce a single-page-scroll layout that would
  drag the nav out of view on a tall page.
- Charts: `recharts` (`BarChart`, `ResponsiveContainer`, etc.) — see
  `AdminAnalytics.tsx` for the established styling (light grid lines,
  no axis lines, rounded bar tops).
