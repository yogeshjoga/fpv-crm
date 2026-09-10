import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
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
  roles: Array<'super_admin' | 'instructor' | 'student'>;
  children: ReactElement;
}) {
  const { loading, isAuthed, profile } = useAuth();
  if (loading) return <Spinner />;
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (!profile) return <Spinner label="Loading your profile…" />;
  if (!roles.includes(profile.role)) return <Navigate to="/app" replace />;
  return children;
}
