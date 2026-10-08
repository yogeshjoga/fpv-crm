import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, APP_URL } from '../lib/supabase';
import type { Tables } from '../lib/database.types';

export type Profile = Tables<'profiles'>;

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isAuthed: boolean;
  isActive: boolean;
  isStaff: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
  /** Two-step verification: `needsChallenge` is true for a signed-in person who has it on but has not entered a code this session. */
  mfa: { checked: boolean; enrolled: boolean; needsChallenge: boolean };
  refreshMfa: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Hands the access token to the server, which keeps it in an HttpOnly cookie so same-origin <iframe>, <img> and
 * download requests for protected course material (/api/private) can be authenticated — those cannot send an
 * Authorization header. Page scripts cannot read an HttpOnly cookie, so this copy of the token is out of reach of
 * injected code. The Supabase client's own session storage is separate.
 */
let lastSynced = '';
function syncAccessCookie(session: Session | null) {
  const token = session?.access_token ?? '';
  if (token === lastSynced) return;
  lastSynced = token;
  // a stale readable cookie from earlier versions of the app
  document.cookie = 'egr_at=; Path=/; Max-Age=0; SameSite=Lax';
  void fetch('/api/session', {
    method: token ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: token ? JSON.stringify({ access_token: token }) : undefined,
  }).catch(() => {
    /* protected files simply ask for a sign-in again */
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mfa, setMfa] = useState({ checked: false, enrolled: false, needsChallenge: false });

  const refreshMfa = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // if this cannot be read we do not lock the person out here; the database still enforces it on every request
    if (error || !data) return setMfa({ checked: true, enrolled: false, needsChallenge: false });
    setMfa({ checked: true, enrolled: data.nextLevel === 'aal2', needsChallenge: data.nextLevel === 'aal2' && data.currentLevel !== 'aal2' });
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data ?? null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      syncAccessCookie(data.session);
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
        await refreshMfa();
      } else setMfa({ checked: true, enrolled: false, needsChallenge: false });
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      syncAccessCookie(next);
      setSession(next);
      if (next?.user) {
        await loadProfile(next.user.id);
        // not awaited here: calling auth methods inside this callback can deadlock the client
        setTimeout(() => void refreshMfa(), 0);
      } else {
        setProfile(null);
        setMfa({ checked: true, enrolled: false, needsChallenge: false });
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, refreshMfa]);

  // Staff accounts are signed out after a stretch of inactivity (a walk-away on a shared computer must not leave an admin open).
  const staffRole = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'instructor' || profile?.role === 'coordinator';
  useEffect(() => {
    if (!session || !staffRole) return;
    const LIMIT_MS = 30 * 60 * 1000;
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = window.setInterval(() => {
      if (Date.now() - last > LIMIT_MS) {
        window.clearInterval(timer);
        void supabase.auth.signOut().then(() => window.location.assign('/login?reason=idle'));
      }
    }, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(timer);
    };
  }, [session, staffRole]);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signInWithGoogle: AuthContextValue['signInWithGoogle'] = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${APP_URL}/auth/callback` },
    });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const sendReset: AuthContextValue['sendReset'] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${APP_URL}/reset-password` });
    return error ? { error: error.message } : {};
  };

  const updatePassword: AuthContextValue['updatePassword'] = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { error: error.message } : {};
  };

  const value: AuthContextValue = {
    loading,
    session,
    profile,
    isAuthed: !!session,
    isActive: profile?.status === 'active',
    isStaff:
      profile?.role === 'instructor' ||
      profile?.role === 'coordinator' ||
      profile?.role === 'admin' ||
      profile?.role === 'super_admin',
    isSuperAdmin: profile?.role === 'super_admin',
    signIn,
    signInWithGoogle,
    signOut,
    sendReset,
    updatePassword,
    refreshProfile,
    mfa,
    refreshMfa,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
