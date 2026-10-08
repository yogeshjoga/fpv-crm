import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { isModuleVisible, useModuleAccess } from '../lib/moduleAccess';
import { Spinner } from '../components/ui/kit';
import { MfaChallenge } from '../components/MfaChallenge';

/** Requires a signed-in user. Sends unauthenticated visitors to /login. */
export function RequireAuth({ children }: { children: ReactElement }) {
  const { loading, isAuthed, mfa } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session…" />;
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location }} />;
  if (mfa.needsChallenge) return <MfaChallenge />;
  return children;
}

/** Requires an activated account. Pending/suspended users land on the status page. */
export function RequireActive({ children }: { children: ReactElement }) {
  const { loading, isAuthed, profile, mfa } = useAuth();
  if (loading) return <Spinner />;
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (mfa.needsChallenge) return <MfaChallenge />;
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
  roles: Array<'super_admin' | 'admin' | 'instructor' | 'coordinator' | 'student'>;
  children: ReactElement;
}) {
  const { loading, isAuthed, profile, mfa } = useAuth();
  if (loading) return <Spinner />;
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (mfa.needsChallenge) return <MfaChallenge />;
  if (!profile) return <Spinner label="Loading your profile…" />;
  if (!roles.includes(profile.role)) return <Navigate to="/app" replace />;
  return children;
}

/**
 * Requires the admin section `moduleKey` to be visible for the signed-in user's own role, per
 * role_module_access. Super admins always pass; instructor, coordinator and admin are each checked
 * against their own configured access.
 * Never wrap the admin dashboard's index route with this — its own fallback
 * redirect target is itself, which would loop.
 */
export function RequireModule({ moduleKey, children }: { moduleKey: string; children: ReactElement }) {
  const { loading, isAuthed, profile, mfa } = useAuth();
  const access = useModuleAccess(profile?.role);
  if (loading) return <Spinner />;
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (mfa.needsChallenge) return <MfaChallenge />;
  if (!profile) return <Spinner label="Loading your profile…" />;
  if (!['instructor', 'coordinator', 'admin', 'super_admin'].includes(profile.role)) return <Navigate to="/app" replace />;
  if (profile.role !== 'super_admin') {
    if (access.loading) return <Spinner />;
    if (!isModuleVisible(access.data, moduleKey)) return <Navigate to="/admin" replace />;
  }
  return children;
}

/**
 * Hides a student section a super admin has turned off for students (Company Settings → role
 * access). Staff opening the student view always pass.
 */
export function RequireStudentModule({ moduleKey, children }: { moduleKey: string; children: ReactElement }) {
  const { profile } = useAuth();
  const access = useModuleAccess(profile?.role === 'student' ? 'student' : null);
  if (profile?.role !== 'student') return children;
  if (access.loading) return <Spinner />;
  if (!isModuleVisible(access.data, moduleKey)) return <Navigate to="/app" replace />;
  return children;
}
