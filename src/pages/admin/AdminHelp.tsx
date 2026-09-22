import { useState } from 'react';
import {
  LayoutDashboard, UserPlus, Inbox, ClipboardCheck, GraduationCap, Layers3, FileQuestion,
  FormInput, CalendarDays, Megaphone, ScrollText, MessageCircle, BarChart3, Briefcase,
  Users, Settings2, Workflow, ChevronRight, Lock, IdCard, Activity,
} from 'lucide-react';
import { GlassCard } from '../../components/ui/shared';
import { Badge, PageHeader } from '../../components/ui/kit';

interface Section {
  id: string;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  who?: 'Super Admin only';
  summary: string;
  points: string[];
}

const SECTIONS: Section[] = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard',
    summary: 'A live snapshot of what needs attention right now — pending registrations, pending enrollment requests, total courses, total students, and certificates issued.',
    points: [
      'Every number is a link — click it to jump straight to that queue.',
      'Use this as your daily "what do I need to act on" screen rather than checking each queue separately.',
    ],
  },
  {
    id: 'registrations',
    icon: UserPlus,
    title: 'Registrations',
    summary:
      'The intake queue for brand-new leads — people who don\'t have an account yet. They arrive from a public registration form, a linked Google Form, or a CSV you import.',
    points: [
      'Each row shows a name/email and whatever custom answers they submitted (including uploaded files/photos).',
      'Review a row to record payment (unpaid/paid/waived) and pick which course group(s) to grant — you must set a payment status before you can accept. Access is granted per group, not per individual course; checking a group also makes the student a real member of it, so a course added to that group later reaches them automatically too.',
      '"Accept & create account" creates their login and emails their credentials automatically. If email delivery fails, the temporary password is shown once so you can hand it over yourself.',
      'If the email already has an account, accepting just adds the extra course access instead of creating a duplicate account.',
      'Every accept/reject is recorded — who reviewed it and when shows on the row and in the review modal, so there\'s always an audit trail of who approved a given application.',
      'Import CSV accepts a spreadsheet export (name/email/phone columns are auto-detected; everything else becomes custom answers) — handy for migrating an existing list of workshop signups.',
    ],
  },
  {
    id: 'enrollments',
    icon: Inbox,
    title: 'Enrollment Requests',
    summary:
      'Requests from students who already have an account and used a private "request this course" form (as opposed to the public registration form above).',
    points: [
      'Approve enrolls them in that one course immediately and notifies them; Reject just closes the request with an optional note.',
      'This is the queue for existing students asking for a new course — new-lead intake belongs in Registrations, not here.',
    ],
  },
  {
    id: 'approvals',
    icon: ClipboardCheck,
    title: 'Account Approvals',
    summary: 'Activates or suspends student accounts. A newly self-registered student sits as "pending" here until you activate them — only active accounts can log in and enroll.',
    points: [
      'Activate turns pending → active and emails the student that they can now sign in.',
      'Reject / Suspend blocks sign-in without deleting anything, and can be reversed with Reinstate.',
    ],
  },
  {
    id: 'courses',
    icon: GraduationCap,
    title: 'Courses',
    summary: 'Build and publish the courses themselves — content, structure, and exam configuration.',
    points: [
      'Only "published" courses are visible to students and offered as options elsewhere (registration forms, Users → manage access, Course Groups).',
      'Content → build the course: modules, then lessons inside each module (text, video, or embed), with optional downloadable PDF/file resources per lesson.',
      'Question bank → the multiple-choice question pool that exam draws from. You need at least as many active questions as the exam\'s draw size ("questions per exam"), or students will run out of pool to draw from — the page warns you if the bank is short.',
      'Exam settings (pass %, time limit, questions per exam, max attempts, cooldown hours) are set per-course when you create it, seeded from the defaults in Company Settings.',
      'A few certification-style courses use a more advanced "tiered" grading mode (weighted hard/medium/easy question mix, Grade 1–4 instead of pass/fail) — that\'s configured at the database level; the question bank editor here always saves new questions as medium difficulty until a difficulty picker is added to this screen.',
    ],
  },
  {
    id: 'course-groups',
    icon: Layers3,
    title: 'Course Groups',
    summary:
      'Bundle several courses into a group (typically one group per workshop or cohort), then add students to the group to enroll them in every course in it, in one action.',
    points: [
      'Create a group, add its courses under "Courses", then add attendees under "Students" — each checkbox instantly enrolls that student in that course via the same access students get from Users.',
      'Adding a new course to an existing group retroactively enrolls everyone already in the group.',
      'Removing a course or student from the group only stops future auto-enrolling — it never revokes access already granted. Revoke access explicitly from Users if a student needs to be pulled out.',
      '"Coordinators" assigns a coordinator account to supervise the group — a pure responsibility marker with no effect on enrollments (coordinators get their own broad read access to registrations and student activity, separate from group membership).',
      'Deleting a group removes the bundle only; nobody loses access they already have.',
      'Best for: a workshop with a fixed course list and a batch of attendees you enroll all at once, instead of ticking boxes per student per course.',
    ],
  },
  {
    id: 'student-activity',
    icon: Activity,
    title: 'Student Activity',
    summary: 'Every student\'s course progress, exam results and last-active date, in one combined view — instructors and coordinators both use this instead of piecing it together from other pages.',
    points: [
      'Each row summarizes active/completed course counts, exam attempt count and best score, and the most recent day they logged any activity.',
      '"View" opens the full breakdown: every enrollment with its status, and every exam attempt with its score and pass/fail outcome.',
      '"Last active" comes from the same day-bucketed study-time counter used for streaks — there\'s no separate login log, so it reflects real activity on the site, not just a login event.',
    ],
  },
  {
    id: 'forms',
    icon: FormInput,
    title: 'Enrollment Forms',
    summary: 'Build the custom questions a form asks, and control whether it\'s public or private.',
    points: [
      'Public form (no login required) → submissions land in Registrations. Share its link with anyone; you accept and pick their course afterward.',
      'Private form (login required) → an existing student requests one specific course; submissions land in Enrollment Requests.',
      'Open/Closed toggles whether the form currently accepts new submissions without deleting it.',
      '"Responses" (private forms only) shows everyone who has submitted that specific form.',
    ],
  },
  {
    id: 'calendar',
    icon: CalendarDays,
    title: 'Calendar',
    summary: 'Shared schedule of sessions, exam windows, deadlines and holidays — optionally tied to a specific course.',
    points: [
      'Students see the same calendar (read-only) from their side, filtered to courses they\'re enrolled in plus anything not tied to a course.',
      'Good for workshop dates, live session times, or "exam window closes" deadlines.',
    ],
  },
  {
    id: 'notifications',
    icon: Megaphone,
    title: 'Notifications',
    summary: 'Send a one-off in-app + email broadcast to all active students, everyone in a specific course, or all staff.',
    points: [
      'You get an on-screen confirmation prompt before it actually sends — there\'s no undo once it goes out.',
      'The right-hand list shows your last 30 broadcasts, with recipient/email counts, as a record of what\'s already been announced.',
    ],
  },
  {
    id: 'certificates',
    icon: ScrollText,
    title: 'Certificates',
    summary: 'Every certificate ever issued, searchable by ID or student — issued automatically the moment a student passes a course exam.',
    points: [
      'Revoke invalidates a certificate (e.g. academic integrity issue) with a reason attached; Reinstate undoes that.',
      'The certificate\'s public verification page (linked from its QR code) reflects revoked status immediately.',
    ],
  },
  {
    id: 'id-cards',
    icon: IdCard,
    title: 'ID Cards',
    summary: 'Every student ID card issued — a front-and-back PDF generated and emailed automatically the moment a registration is accepted.',
    points: [
      'One card per student (not per course) — accepting a second registration for someone who already has a card just skips re-issuing one.',
      'Download opens the two-page PDF (front page, back page) via a signed URL; Resend re-sends that exact PDF to the student\'s email without regenerating it.',
      '"Generate (testing)" is a manual trigger for the same pipeline — useful for testing the email end-to-end, or covering an account that never went through Registrations. It lists every account without a card yet, including staff and pending/suspended ones, so you can generate one to your own login and check your own inbox.',
      'Cards are numbered from the same certificate ID prefix in Company Settings (e.g. EGR-ID-000123) and default to a 1-year validity from issue date.',
    ],
  },
  {
    id: 'ask',
    icon: MessageCircle,
    title: 'Questions',
    summary: 'Student support threads — questions asked from any course page or the FPV Build Lab.',
    points: [
      'Filter by Open/Answered/Closed; open a thread to see the full back-and-forth and reply.',
      'Replying emails/notifies the student; Close ends the thread (they can still be reopened by asking again).',
    ],
  },
  {
    id: 'analytics',
    icon: BarChart3,
    who: 'Super Admin only',
    title: 'Analytics',
    summary: 'Time-spent analytics: how long each student has spent per course, and how active each staff member has been.',
    points: [
      'Useful for spotting disengaged students early, or confirming a workshop cohort is actually working through the material.',
      'Search filters the student list by name/email.',
    ],
  },
  {
    id: 'employees',
    icon: Briefcase,
    who: 'Super Admin only',
    title: 'Employees',
    summary: 'Manage instructor and super-admin staff accounts — department, designation, join date, role, and active/suspended status.',
    points: [
      'This is staff (instructor/super_admin) only — students and coordinators are managed from Users instead.',
      'Changing someone\'s role here changes what they can access across the whole admin area.',
    ],
  },
  {
    id: 'users',
    icon: Users,
    who: 'Super Admin only',
    title: 'Users',
    summary: 'The two "user" access tiers — student and coordinator — role, active/suspended status, and per-student course access, all in one table. Instructor/super_admin accounts live under Employees instead.',
    points: [
      'Promoting a student to "coordinator" here is the only way to create a coordinator — there\'s no separate coordinator signup. A coordinator gets broad read access to Registrations and Student Activity (configurable like any other module) and can be assigned to supervise a Course Group.',
      '"Manage access" on a student opens a checklist of every published course — check/uncheck to enroll or revoke, one course at a time.',
      'Deleting a user is a soft delete: it blocks sign-in immediately but keeps their enrollments, exam history and certificates, and requires your own password to confirm. Restore it any time from "Show deleted".',
    ],
  },
  {
    id: 'settings',
    icon: Settings2,
    who: 'Super Admin only',
    title: 'Company Settings',
    summary: 'Organization-wide branding and defaults.',
    points: [
      'Branding: logo and signature image used on generated certificates.',
      'Certificate ID prefix, authorized signatory name, support email, and the verification base URL encoded into every certificate\'s QR code.',
      'Default exam parameters (pass %, time limit, questions per exam, max attempts, cooldown) — these only seed new courses; existing courses keep whatever they were set to.',
      'Google Forms integration: gives you a webhook URL and an Apps Script to paste into a Google Form so its responses flow straight into Registrations, including uploaded files. "Regenerate secret" invalidates the old webhook URL, so update any Form still using it afterward.',
      'Instructor module access: per-section dropdown — Hidden / Read only / Read & write — for Registrations, Enrollment Requests, Account Approvals, Courses, Course Groups, Student Activity, Enrollment Forms, Calendar, Notifications, Certificates, Questions, and Help. "Read only" is the safe default: staff can open and view the section, but every button, form and toggle that would create/edit/delete something disappears — this is enforced on the page itself, not just in the sidebar, so it can\'t be bypassed by typing a URL. Each dropdown applies to every instructor and coordinator alike — there\'s no separate setting per role or per person. Analytics, Employees, Users and this Settings page always stay super-admin-only and aren\'t on this list.',
    ],
  },
];

const WORKFLOW = [
  { label: 'Lead applies', detail: 'Public registration form, Google Form, or a CSV you import → Registrations' },
  { label: 'You review & accept', detail: 'Record payment, pick course(s) → account created, credentials emailed' },
  { label: 'Account activated', detail: 'Self-registered accounts need one activation in Account Approvals first' },
  { label: 'Enrolled in course(s)', detail: 'Per-student (Users), per-request (Enrollment Requests), or in bulk for a workshop (Course Groups)' },
  { label: 'Student studies & tests', detail: 'Course content in Courses/Content, exam drawn from the Question bank' },
  { label: 'Certificate issued', detail: 'Automatic on passing — visible in Certificates, verifiable by its QR code' },
];

export function AdminHelp() {
  const [open, setOpen] = useState<string | null>(SECTIONS[0].id);

  return (
    <div>
      <PageHeader title="Help" subtitle="What every section does, and how to use this CRM efficiently" />

      <GlassCard className="mb-6 p-6">
        <div className="mb-4 flex items-center gap-2 font-semibold text-neutral-900">
          <Workflow size={18} /> The typical path from lead to certified student
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WORKFLOW.map((w, i) => (
            <div key={w.label} className="rounded-2xl border border-white/60 bg-white/40 p-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-neutral-400">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] text-white">{i + 1}</span>
                STEP
              </div>
              <div className="text-sm font-medium text-neutral-900">{w.label}</div>
              <p className="mt-1 text-xs text-neutral-500">{w.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-neutral-500">
          Running a workshop with a fixed group of students and courses? Skip the one-by-one enrollment steps and use{' '}
          <strong>Course Groups</strong> instead — add the courses, add the students, and every enrollment happens at once.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          As a super admin, an <strong>Instructor view</strong> button sits in the top-right header of every admin page — click it
          to preview both the sidebar and the read/write restrictions an instructor sees, based on Company Settings → Instructor module
          access. A coordinator account sees the exact same restrictions — there's no separate coordinator preview.
        </p>
      </GlassCard>

      <div className="mb-3 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-white"
          >
            <s.icon size={13} /> {s.title}
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {SECTIONS.map((s) => {
          const expanded = open === s.id;
          return (
            <GlassCard key={s.id} id={s.id} className="scroll-mt-20 p-0">
              <button
                onClick={() => setOpen(expanded ? null : s.id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-neutral-700">
                    <s.icon size={17} />
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-900">{s.title}</div>
                    <div className="text-xs text-neutral-500">{s.summary}</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.who && (
                    <Badge tone="amber">
                      <Lock size={11} className="mr-1 inline" /> {s.who}
                    </Badge>
                  )}
                  <ChevronRight size={16} className={`text-neutral-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {expanded && (
                <div className="border-t border-white/50 px-5 py-4">
                  <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-600">
                    {s.points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
