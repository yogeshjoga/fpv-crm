import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { AuthCard } from '../../layout/PublicShell';
import { Spinner } from '../../components/ui/kit';

interface PublicForm {
  slug: string;
  title: string;
  description: string;
  course: { title: string } | null;
}

export function RegisterLanding() {
  const q = useQuery<PublicForm[]>(
    () =>
      unwrap(
        supabase
          .from('enrollment_forms')
          .select('slug, title, description, course:courses(title)')
          .eq('is_public', true)
          .eq('is_open', true)
          .order('created_at', { ascending: false }),
      ) as Promise<PublicForm[]>,
    [],
  );

  if (q.loading)
    return (
      <AuthCard title="Register">
        <Spinner />
      </AuthCard>
    );

  const forms = q.data ?? [];
  if (forms.length === 1) return <Navigate to={`/register-form/${forms[0].slug}`} replace />;

  return (
    <AuthCard title="Register" subtitle={forms.length ? 'Pick the intake you want to apply for' : undefined}>
      {!forms.length ? (
        <p className="text-sm text-neutral-600">
          There are no open registration forms right now. Please check back later or contact EgireRobotics.
        </p>
      ) : (
        <div className="space-y-3">
          {forms.map((f) => (
            <Link
              key={f.slug}
              to={`/register-form/${f.slug}`}
              className="flex items-start justify-between gap-3 rounded-2xl border border-white/60 bg-white/50 p-4 hover:bg-white/80"
            >
              <div>
                <div className="flex items-center gap-2 font-medium text-neutral-900">
                  <ClipboardList size={16} className="text-blue-500" /> {f.title}
                </div>
                {f.course?.title && <div className="mt-0.5 text-xs text-neutral-500">{f.course.title}</div>}
                {f.description && <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{f.description}</p>}
              </div>
              <ArrowRight size={16} className="mt-1 shrink-0 text-neutral-400" />
            </Link>
          ))}
        </div>
      )}
      <p className="mt-6 text-center text-sm text-neutral-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
