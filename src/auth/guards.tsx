import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { isModuleVisible, useInstructorModuleAccess } from '../lib/moduleAccess';
import { Spinner } from '../components/ui/kit';

/** Requires a signed-in user. Sends unauthenticated visitors to /login. */
export function RequireAuth({ children }: { children: ReactElement }) {
  const { loading, isAuthed } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session…" />;
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

/** Requires an activated account. Pending/suspended users land on the status page. */
export function RequireActive({ children }: { children: ReactElement }) {
  const { loading, isAuthed, profile } = useAuth();
  if (loading) return <Spinner />;
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (!profile) return <Spinner label="Loading your profile…" />;
  if (profile.must_change_password) return <Navigate to="/set-password" replace />;
  if (profile.status !== 'active') return <Navigate to="/awaiting-activation" replace />;
  return children;
}

/** Requires one of the given roles. */
export function RequireRole({
  roles,
  children,
}: {
  roles: Array<'super_admin' | 'instructor' | 'coordinator' | 'student'>;
  children: ReactElement;
}) {
  const { loading, isAuthed, profile } = useAuth();
  if (loading) return <Spinner />;
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (!profile) return <Spinner label="Loading your profile…" />;
  if (!roles.includes(profile.role)) return <Navigate to="/app" replace />;
  return children;
}

/**
 * Requires the admin module `moduleKey` to be visible per instructor_module_access.
 * Super admins always pass; instructors and coordinators are both checked against
 * the same configured list (module access is global per module, not per role).
 * Never wrap the admin dashboard's index route with this — its own fallback
 * redirect target is itself, which would loop.
 */
export function RequireModule({ moduleKey, children }: { moduleKey: string; children: ReactElement }) {
  const { loading, isAuthed, profile } = useAuth();
  const access = useInstructorModuleAccess();
  if (loading) return <Spinner />;
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (!profile) return <Spinner label="Loading your profile…" />;
  if (!['instructor', 'coordinator', 'super_admin'].includes(profile.role)) return <Navigate to="/app" replace />;
  if (profile.role !== 'super_admin') {
    if (access.loading) return <Spinner />;
    if (!isModuleVisible(access.data, moduleKey)) return <Navigate to="/admin" replace />;
  }
  return children;
}
