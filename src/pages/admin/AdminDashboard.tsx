import { Link } from 'react-router-dom';
import { GraduationCap, Inbox, ScrollText, UserPlus, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useQuery } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { PageHeader, Spinner } from '../../components/ui/kit';

async function count(table: string, filter?: (q: any) => any) {
  let q = supabase.from(table as never).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count: c } = await q;
  return c ?? 0;
}

export function AdminDashboard() {
  const q = useQuery(async () => {
    const [pendingRegs, pendingRequests, courses, students, certs] = await Promise.all([
      count('registrations', (q) => q.eq('status', 'pending')),
      count('enrollment_requests', (q) => q.eq('status', 'pending')),
      count('courses'),
      count('profiles', (q) => q.eq('role', 'student')),
      count('certificates', (q) => q.eq('revoked', false)),
    ]);
    return { pendingRegs, pendingRequests, courses, students, certs };
  }, []);

  if (q.loading) return <Spinner />;
  const d = q.data!;

  const cards = [
    { label: 'Registrations pending', value: d.pendingRegs, to: '/admin/registrations', icon: UserPlus, tone: d.pendingRegs ? 'text-amber-500' : 'text-neutral-400' },
    { label: 'Enrollment requests pending', value: d.pendingRequests, to: '/admin/enrollments', icon: Inbox, tone: d.pendingRequests ? 'text-amber-500' : 'text-neutral-400' },
    { label: 'Courses', value: d.courses, to: '/admin/courses', icon: GraduationCap, tone: 'text-blue-500' },
    { label: 'Students', value: d.students, to: '/admin/users', icon: Users, tone: 'text-blue-500' },
    { label: 'Certificates issued', value: d.certs, to: '/admin/certificates', icon: ScrollText, tone: 'text-green-500' },
  ];

  return (
    <div>
      <PageHeader title="Admin dashboard" subtitle="EgireRobotics training operations" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to}>
            <GlassCard className="flex items-center gap-4 p-5 transition-transform hover:-translate-y-0.5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 ${c.tone}`}>
                <c.icon size={20} />
              </div>
              <div>
                <div className="text-2xl font-semibold text-neutral-900">{c.value}</div>
                <div className="text-xs text-neutral-500">{c.label}</div>
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
