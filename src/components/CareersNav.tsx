import { Link, useLocation } from 'react-router-dom';
import { Briefcase, FileSignature, LayoutTemplate } from 'lucide-react';

const TABS = [
  { to: '/admin/careers', label: 'Positions', icon: Briefcase },
  { to: '/admin/careers/offers', label: 'Offer letters', icon: FileSignature },
  { to: '/admin/careers/roles', label: 'Role templates', icon: LayoutTemplate },
];

/** Switches between the three Careers areas for HR. */
export function CareersNav() {
  const { pathname } = useLocation();
  return (
    <div className="mb-5 inline-flex flex-wrap rounded-full border border-white/60 bg-white/50 p-1 text-sm">
      {TABS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition-colors ${pathname === to ? 'bg-[#1a1a1a] text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
        >
          <Icon size={14} /> {label}
        </Link>
      ))}
    </div>
  );
}
