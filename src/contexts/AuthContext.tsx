/**
 * Authentication Context
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ============================================================
// TYPES
// ============================================================

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================
// PROVIDER
// ============================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[Auth] Session error:', error);
        setError(error);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth]', event);
        setSession(session);
        setUser(session?.user ?? null);
        setError(null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      const err = { message: 'Supabase not configured', name: 'ConfigError' } as AuthError;
      setError(err);
      return { error: err };
    }

    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) setError(error);
    return { error };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      const err = { message: 'Supabase not configured', name: 'ConfigError' } as AuthError;
      setError(err);
      return { error: err };
    }

    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) setError(error);
    return { error };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      const err = { message: 'Supabase not configured', name: 'ConfigError' } as AuthError;
      setError(err);
      return { error: err };
    }

    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error);
      return { error };
    }

    // Check if email confirmation is required
    const needsConfirmation = !data.session && !!data.user;
    return { error: null, needsConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        error,
        isConfigured: isSupabaseConfigured,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// HOOKS
// ============================================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function useIsAuthenticated() {
  const { user } = useAuth();
  return !!user;
}
