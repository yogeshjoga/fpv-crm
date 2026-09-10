import { Link, Outlet } from 'react-router-dom';
import { Logo } from '../components/Brand';

export function PublicShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between px-6 md:px-10">
        <Link to="/" className="text-neutral-900">
          <Logo markSize={26} />
        </Link>
        <nav className="flex items-center gap-4 text-sm text-neutral-600">
          <Link to="/verify" className="hover:text-neutral-900">Verify a certificate</Link>
          <Link to="/login" className="rounded-full bg-[#1a1a1a] px-4 py-1.5 font-medium text-white hover:bg-black">
            Sign in
          </Link>
        </nav>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Outlet />
      </main>
      <footer className="px-6 py-6 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} EgireRobotics — FPV & Drone Training
      </footer>
    </div>
  );
}

/** Narrow card used by the auth screens. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white/60 p-8 shadow-[0_8px_40px_rgb(0,0,0,0.06)] backdrop-blur-2xl">
      <h1 className="font-display text-2xl font-semibold text-neutral-900">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-neutral-500">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}
