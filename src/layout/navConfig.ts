import {
  LayoutDashboard, BookOpen, Award, UserCircle,
  ClipboardCheck, Users, GraduationCap,
  FormInput, Inbox, ScrollText, Settings2,
} from 'lucide-react';
import type { NavItem } from './Shell';

export const studentNav: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/courses', label: 'Courses', icon: BookOpen },
  { to: '/app/certificates', label: 'Certificates', icon: Award },
  { to: '/app/profile', label: 'Profile', icon: UserCircle },
];

export const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/approvals', label: 'Approvals', icon: ClipboardCheck },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/courses', label: 'Courses', icon: GraduationCap },
  { to: '/admin/forms', label: 'Enrollment Forms', icon: FormInput },
  { to: '/admin/enrollments', label: 'Enrollment Requests', icon: Inbox },
  { to: '/admin/certificates', label: 'Certificates', icon: ScrollText },
  { to: '/admin/settings', label: 'Company Settings', icon: Settings2 },
];
