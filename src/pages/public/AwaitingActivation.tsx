import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Clock, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { AuthCard } from '../../layout/PublicShell';
import { Button } from '../../components/ui/kit';

export function AwaitingActivation() {
  const { isAuthed, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const id = setInterval(refreshProfile, 5000);
    return () => clearInterval(id);
  }, [refreshProfile]);

  if (!isAuthed) return <Navigate to="/login" replace />;
  if (profile?.status === 'active') return <Navigate to="/app" replace />;

  const suspended = profile?.status === 'suspended';

  return (
    <AuthCard title={suspended ? 'Account suspended' : 'Almost there'}>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${suspended ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
          {suspended ? <ShieldAlert size={30} /> : <Clock size={30} />}
        </div>
        <p className="text-sm text-neutral-600">
          {suspended
            ? 'Your account has been suspended. Please contact an administrator if you believe this is a mistake.'
            : 'Your account is pending administrator approval. You’ll be able to browse and enroll in courses as soon as it’s activated.'}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => refreshProfile()}>
            <RefreshCw size={15} /> Check again
          </Button>
          <Button variant="ghost" onClick={async () => { await signOut(); navigate('/login'); }}>
            <LogOut size={15} /> Sign out
          </Button>
        </div>
      </div>
    </AuthCard>
  );
}
