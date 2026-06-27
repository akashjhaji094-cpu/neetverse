import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null; userId?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setGuestMode: () => void;
  clearGuestMode: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(() => {
    try {
      return localStorage.getItem('guestMode') === 'true';
    } catch {
      return false;
    }
  });

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    } catch (err) {
      console.error('Session refresh error:', err);
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    refreshSession().then(() => {
      if (!mounted) return;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshSession]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { name },
        },
      });

      if (error) {
        toast.error(error.message);
        return { error };
      }

      clearGuestMode();
      toast.success('Account created successfully! Check your email.');
      return { error: null, userId: data?.user?.id };
    } catch (err: any) {
      toast.error(err?.message || 'Sign up failed');
      return { error: err };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return { error };
      }
      clearGuestMode();
      toast.success('Welcome back!');
      return { error: null };
    } catch (err: any) {
      toast.error(err?.message || 'Sign in failed');
      return { error: err };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      clearGuestMode();
      toast.success('Signed out successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Sign out failed');
    }
  }, []);

  const setGuestMode = useCallback(() => {
    try {
      localStorage.setItem('guestMode', 'true');
    } catch {
      // Storage blocked
    }
    setIsGuest(true);
  }, []);

  const clearGuestMode = useCallback(() => {
    try {
      localStorage.removeItem('guestMode');
    } catch {
      // Storage blocked
    }
    setIsGuest(false);
  }, []);

  const value: AuthContextType = {
    user,
    session,
    loading,
    isGuest,
    signUp,
    signIn,
    signOut,
    setGuestMode,
    clearGuestMode,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
