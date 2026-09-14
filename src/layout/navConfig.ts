import {
  LayoutDashboard, BookOpen, Award, UserCircle, CalendarDays,
  ClipboardCheck, Users, GraduationCap, Briefcase, Megaphone,
  FormInput, Inbox, ScrollText, Settings2, UserPlus, BarChart3,
  MessageCircle, ImagePlus,
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

export const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/registrations', label: 'Registrations', icon: UserPlus },
  { to: '/admin/enrollments', label: 'Enrollment Requests', icon: Inbox },
  { to: '/admin/approvals', label: 'Account Approvals', icon: ClipboardCheck },
  { to: '/admin/courses', label: 'Courses', icon: GraduationCap },
  { to: '/admin/forms', label: 'Enrollment Forms', icon: FormInput },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/admin/notifications', label: 'Notifications', icon: Megaphone },
  { to: '/admin/certificates', label: 'Certificates', icon: ScrollText },
  { to: '/admin/ask', label: 'Questions', icon: MessageCircle },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/employees', label: 'Employees', icon: Briefcase },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/settings', label: 'Company Settings', icon: Settings2 },
];
