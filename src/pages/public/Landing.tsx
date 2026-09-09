import { Link } from 'react-router-dom';
import { ArrowRight, Award, BookOpen, PlaneTakeoff } from 'lucide-react';

export function Landing() {
  return (
    <div className="w-full max-w-3xl text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1a1a1a] text-white">
        <PlaneTakeoff size={30} />
      </div>
      <h1 className="font-display text-4xl font-semibold text-neutral-900 md:text-5xl">
        EgireRobotics FPV &amp; Drone Training
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-600">
        Learn to build and fly FPV drones, pass your certification exam, and earn a verifiable EgireRobotics certificate.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link to="/register" className="inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] px-6 py-3 font-medium text-white hover:bg-black">
          Get started <ArrowRight size={16} />
        </Link>
        <Link to="/verify" className="inline-flex items-center gap-2 rounded-full bg-white/70 px-6 py-3 font-medium text-neutral-800 hover:bg-white">
          Verify a certificate
        </Link>
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          { icon: BookOpen, t: 'Structured courses', d: 'Modules, lessons and downloadable PDF resources.' },
          { icon: PlaneTakeoff, t: 'Timed exams', d: 'Randomized multiple-choice, graded instantly.' },
          { icon: Award, t: 'Verifiable certificates', d: 'QR-coded PDF, checkable by anyone.' },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-2xl border border-white/60 bg-white/40 p-5 text-left">
            <Icon className="mb-3 text-blue-500" size={22} />
            <div className="font-medium text-neutral-900">{t}</div>
            <div className="mt-1 text-sm text-neutral-500">{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
