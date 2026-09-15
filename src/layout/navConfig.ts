import {
  LayoutDashboard, BookOpen, Award, UserCircle, CalendarDays,
  ClipboardCheck, Users, GraduationCap, Briefcase, Megaphone,
  FormInput, Inbox, ScrollText, Settings2, UserPlus, BarChart3,
  MessageCircle, ImagePlus, Layers3, HelpCircle,
} from 'lucide-react';
import type { NavItem } from './Shell';

export const studentNav: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/courses', label: 'Courses', icon: BookOpen },
  { to: '/app/showcase', label: 'Showcase', icon: ImagePlus },
  { to: '/app/ask', label: 'Ask us', icon: MessageCircle },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/certificates', label: 'Certificates', icon: Award },
  { to: '/app/profile', label: 'Profile', icon: UserCircle },
];

// `key` matches instructor_module_access.module_key — used to control which
// of these an instructor account (or a super admin's "Instructor view"
// preview) sees. Items with `superAdminOnly` are never configurable and
// never shown to instructors, full stop.
export const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, key: 'dashboard' },
  { to: '/admin/registrations', label: 'Registrations', icon: UserPlus, key: 'registrations' },
  { to: '/admin/enrollments', label: 'Enrollment Requests', icon: Inbox, key: 'enrollments' },
  { to: '/admin/approvals', label: 'Account Approvals', icon: ClipboardCheck, key: 'approvals' },
  { to: '/admin/courses', label: 'Courses', icon: GraduationCap, key: 'courses' },
  { to: '/admin/course-groups', label: 'Course Groups', icon: Layers3, key: 'course-groups' },
  { to: '/admin/forms', label: 'Enrollment Forms', icon: FormInput, key: 'forms' },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays, key: 'calendar' },
  { to: '/admin/notifications', label: 'Notifications', icon: Megaphone, key: 'notifications' },
  { to: '/admin/certificates', label: 'Certificates', icon: ScrollText, key: 'certificates' },
  { to: '/admin/ask', label: 'Questions', icon: MessageCircle, key: 'ask' },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, key: 'analytics', superAdminOnly: true },
  { to: '/admin/employees', label: 'Employees', icon: Briefcase, key: 'employees', superAdminOnly: true },
  { to: '/admin/users', label: 'Users', icon: Users, key: 'users', superAdminOnly: true },
  { to: '/admin/settings', label: 'Company Settings', icon: Settings2, key: 'settings', superAdminOnly: true },
  { to: '/admin/help', label: 'Help', icon: HelpCircle, key: 'help' },
];

/** Modules a super admin can toggle instructor visibility for — excludes super-admin-only items and Dashboard (always reachable). */
export const CONFIGURABLE_MODULES = adminNav
  .filter((i) => !i.superAdminOnly && i.key !== 'dashboard')
  .map((i) => ({ key: i.key as string, label: i.label }));
