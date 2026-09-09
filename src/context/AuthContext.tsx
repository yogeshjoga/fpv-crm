import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  avatar: string;
  designation: string;
  role: string;
  company: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: UserProfile | null;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (updated: Partial<UserProfile>) => void;
}

const DEFAULT_USER: UserProfile = {
  name: 'Roop Raman',
  email: 'roopramandesign@gmail.com',
  phone: '+91 98765 43210',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
  designation: 'Senior Sales Manager',
  role: 'Administrator',
  company: 'SP Water Systems Pvt Ltd',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('sp_crm_is_logged_in') === 'true';
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('sp_crm_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_USER;
      }
    }
    return DEFAULT_USER;
  });

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('sp_crm_is_logged_in', isLoggedIn ? 'true' : 'false');
  }, [isLoggedIn]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('sp_crm_user_profile', JSON.stringify(user));
    } else {
      localStorage.removeItem('sp_crm_user_profile');
    }
  }, [user]);

  const login = async (email: string, password?: string): Promise<boolean> => {
    // Standard simulation of authenticating - instant login for the user
    const updatedUser = {
      ...DEFAULT_USER,
      email: email || DEFAULT_USER.email,
    };
    setUser(updatedUser);
    setIsLoggedIn(true);
    
    // Dispatch a store update or login event
    window.dispatchEvent(new CustomEvent('crm-auth-login'));
    return true;
  };

  const logout = () => {
    setIsLoggedIn(false);
    // Keep the user profile cached so they see their custom settings next time they type it, but mark logged out
    window.dispatchEvent(new CustomEvent('crm-auth-logout'));
  };

  const updateProfile = (updated: Partial<UserProfile>) => {
    setUser(prev => {
      if (!prev) return DEFAULT_USER;
      const newUser = { ...prev, ...updated };
      return newUser;
    });
    // Dispatch event to force other panels to re-fetch if needed
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('crm-store-update'));
    }, 50);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
