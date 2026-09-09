import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin',
  instructor: 'Instructor',
  student: 'Student',
};

export function Shell({ nav, area }: { nav: NavItem[]; area: 'Student' | 'Admin' }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [openMobile, setOpenMobile] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      {/* sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-white/50 bg-white/50 backdrop-blur-2xl transition-transform md:static md:translate-x-0 ${
          openMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1a1a1a] text-sm font-bold text-white">E</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-neutral-900">EgireRobotics</div>
            <div className="text-[11px] text-neutral-500">{area} Portal</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3 py-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpenMobile(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-[#1a1a1a] text-white shadow-sm' : 'text-neutral-600 hover:bg-black/[0.04]'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {openMobile && <div className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={() => setOpenMobile(false)} />}

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-white/50 px-4 md:px-8">
          <button className="md:hidden" onClick={() => setOpenMobile((v) => !v)}>
            {openMobile ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium text-neutral-900">{profile?.full_name || profile?.email}</div>
              <div className="text-[11px] text-neutral-500">{profile ? roleLabel[profile.role] : ''}</div>
            </div>
            <img
              src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'U')}&background=1a1a1a&color=fff`}
              alt=""
              className="h-9 w-9 rounded-full border border-white/70 object-cover"
            />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-sm text-neutral-600 hover:bg-white"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
