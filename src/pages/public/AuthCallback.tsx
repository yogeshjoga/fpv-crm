import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { Spinner } from '../../components/ui/kit';

/** Landing route for the Google OAuth redirect. */
export function AuthCallback() {
  const { loading, isAuthed } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate(isAuthed ? '/app' : '/login', { replace: true });
  }, [loading, isAuthed, navigate]);

  return <Spinner label="Signing you in…" />;
}
