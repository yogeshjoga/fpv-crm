import {
  LayoutDashboard, BookOpen, Award, UserCircle, CalendarDays,
  ClipboardCheck, Users, GraduationCap, Briefcase, Megaphone,
  FormInput, Inbox, ScrollText, Settings2, UserPlus, BarChart3,
  MessageCircle, ImagePlus, Layers3, HelpCircle, IdCard, Activity, FolderOpen, MessageSquareHeart, ListChecks, ClipboardList, Handshake, ShieldCheck, CalendarRange, Images, Newspaper, Building2, Video,
  Store, Package, ShoppingBag, Tags, BellRing, Globe,
} from 'lucide-react';
import type { NavItem, Workspace } from './Shell';

export const studentNav: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/courses', label: 'Courses', icon: BookOpen, key: 'courses' },
  { to: '/app/resources', label: 'Resources', icon: FolderOpen, key: 'resources' },
  { to: '/app/showcase', label: 'Showcase', icon: ImagePlus, key: 'showcase' },
  { to: '/app/ask', label: 'Ask us', icon: MessageCircle, key: 'ask' },
  { to: '/app/careers', label: 'Careers', icon: Briefcase, key: 'careers' },
  { to: '/app/reviews', label: 'Reviews', icon: MessageSquareHeart, key: 'reviews' },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays, key: 'calendar' },
  { to: '/app/report-card', label: 'Report card', icon: ClipboardList, key: 'report-card' },
  { to: '/app/certificates', label: 'Certificates', icon: Award, key: 'certificates' },
  { to: '/app/profile', label: 'Profile', icon: UserCircle },
];

/** Student sections a super admin can show or hide for students (Dashboard and Profile always stay). */
export const STUDENT_MODULES = studentNav.filter((i) => i.key).map((i) => ({ key: i.key as string, label: i.label }));

// `key` matches role_module_access.module_key — used to control which
// of these an instructor account (or a super admin's "Instructor view"
// preview) sees. Items with `superAdminOnly` are never configurable and
// never shown to instructors, full stop.
export const crmNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, key: 'dashboard' },
  { to: '/admin/registrations', label: 'Registrations', icon: UserPlus, key: 'registrations' },
  { to: '/admin/enrollments', label: 'Enrollment Requests', icon: Inbox, key: 'enrollments' },
  { to: '/admin/approvals', label: 'Account Approvals', icon: ClipboardCheck, key: 'approvals' },
  { to: '/admin/courses', label: 'Courses', icon: GraduationCap, key: 'courses' },
  { to: '/admin/workshops', label: 'Workshops & Events', icon: CalendarRange, key: 'workshops' },
  { to: '/admin/course-groups', label: 'Course Groups', icon: Layers3, key: 'course-groups' },
  { to: '/admin/exams', label: 'Exams', icon: ListChecks, key: 'exams' },
  { to: '/admin/resources', label: 'Resources', icon: FolderOpen, key: 'resources' },
  { to: '/admin/student-activity', label: 'Student Activity', icon: Activity, key: 'student-activity' },
  { to: '/admin/forms', label: 'Enrollment Forms', icon: FormInput, key: 'forms' },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays, key: 'calendar' },
  { to: '/admin/notifications', label: 'Notifications', icon: Megaphone, key: 'notifications' },
  { to: '/admin/certificates', label: 'Certificates', icon: ScrollText, key: 'certificates' },
  { to: '/admin/id-cards', label: 'ID Cards', icon: IdCard, key: 'id-cards' },
  { to: '/admin/ask', label: 'Questions', icon: MessageCircle, key: 'ask' },
  { to: '/admin/careers', label: 'Careers', icon: Handshake, key: 'careers' },
  { to: '/admin/reviews', label: 'Reviews', icon: MessageSquareHeart, key: 'reviews' },
  { to: '/admin/enquiries', label: 'Enquiries', icon: Inbox, key: 'enquiries' },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, key: 'analytics', superAdminOnly: true },
  { to: '/admin/employees', label: 'Employees', icon: Briefcase, key: 'employees', superAdminOnly: true },
  { to: '/admin/users', label: 'Users', icon: Users, key: 'users', superAdminOnly: true },
  { to: '/admin/settings', label: 'Company Settings', icon: Settings2, key: 'settings', superAdminOnly: true },
  { to: '/admin/security', label: 'Security', icon: ShieldCheck }, // no key: every staff member can reach it (two-step verification)
  { to: '/admin/help', label: 'Help', icon: HelpCircle, key: 'help' },
];

/** The public website's content (egirerobotics.com). */
export const siteNav: NavItem[] = [
  { to: '/admin/site-gallery', label: 'Site Gallery', icon: Images, key: 'site-gallery' },
  { to: '/admin/site-videos', label: 'Site Videos', icon: Video, key: 'site-videos' },
  { to: '/admin/site-partners', label: 'Site Partners', icon: Building2, key: 'site-partners' },
  { to: '/admin/site-blog', label: 'Site Blog', icon: Newspaper, key: 'site-blog', superAdminOnly: true },
];

/** The online store (shop.egirerobotics.com). Admins and super admins only, see `adminWorkspaces`. */
export const shopNav: NavItem[] = [
  { to: '/admin/shop', label: 'Dashboard', icon: Store, end: true, key: 'shop' },
  { to: '/admin/shop/products', label: 'Products & stock', icon: Package, key: 'shop' },
  { to: '/admin/shop/orders', label: 'Orders', icon: ShoppingBag, key: 'shop' },
  { to: '/admin/shop/brands', label: 'Brands', icon: Tags, key: 'shop' },
  { to: '/admin/shop/notifications', label: 'Store notifications', icon: BellRing, key: 'shop' },
];

/** The three areas the sidebar switcher moves between. The first is the default. */
export const adminWorkspaces: Workspace[] = [
  { key: 'crm', label: 'CRM', description: 'Students, courses and staff', icon: LayoutDashboard, nav: crmNav },
  { key: 'site', label: 'Site', description: 'egirerobotics.com content', icon: Globe, nav: siteNav, prefixes: ['/admin/site-'] },
  {
    key: 'shop',
    label: 'Shop',
    description: 'shop.egirerobotics.com',
    icon: Store,
    nav: shopNav,
    prefixes: ['/admin/shop'],
    roles: ['admin', 'super_admin'],
  },
];

/** Modules a super admin can toggle instructor visibility for — excludes super-admin-only items and Dashboard (always reachable). */
export const CONFIGURABLE_MODULES = [...crmNav, ...siteNav]
  .filter((i) => i.key && !i.superAdminOnly && i.key !== 'dashboard')
  .map((i) => ({ key: i.key as string, label: i.label }));
