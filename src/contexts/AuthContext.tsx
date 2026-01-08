/**
 * Authentication Context
 * 
 * Single source of truth for user authentication state.
 * All other hooks should consume user from here instead of calling getUser().
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ============================================================
// TYPES
// ============================================================

interface AuthContextValue {
  /** Current authenticated user (null if not logged in) */
  user: User | null;
  /** Current session (null if not logged in) */
  session: Session | null;
  /** True while initial auth state is being determined */
  loading: boolean;
  /** Most recent auth error */
  error: AuthError | null;
  /** Whether Supabase is configured */
  isConfigured: boolean;
  /** User ID shortcut (null if not logged in) */
  userId: string | null;
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
  
  // Prevent duplicate initialization
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Prevent double-initialization in StrictMode
    if (initializedRef.current) return;
    initializedRef.current = true;


    // console.log("outside of initalizeAuth(), isMounted: ", isMounted);

    async function initializeAuth() {
      console.log("Initializing auth...")
      try {
        // Get current session
        console.log("getting session...")
        const { data: { session: currentSession }, error: sessionError } = await supabase!.auth.getSession();

        if (sessionError) {
          console.error('[Auth] Session error:', sessionError);
          if (initializedRef.current) {
            setError(sessionError);
            setLoading(false);
          }
          return;
        }

        if (!currentSession) {
          console.log("No session found");
          // No session = not logged in
          if (initializedRef.current) {
            setUser(null);
            setSession(null);
            setLoading(false);
          }
          return;
        }

        console.log("verifying user...")
        // Verify the user with getUser() - this validates the JWT server-side
        const { data: { user: verifiedUser }, error: userError } = await supabase!.auth.getUser();

        if (userError) {
          console.error('[Auth] User verification failed:', userError);
          // Invalid session - sign out
          await supabase!.auth.signOut();
          if (initializedRef.current) {
            setUser(null);
            setSession(null);
            setError(userError);
            setLoading(false);
          }
          return;
        }

        // Valid session and user
        // console.log(initializedRef.current);
        if (initializedRef.current) {
          setSession(currentSession);
          setUser(verifiedUser);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('[Auth] Initialization error:', err);
        if (initializedRef.current) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('[Auth] State change:', event);
        
        if (!initializedRef.current) return;

        if (event === 'SIGNED_OUT' || !newSession) {
          setSession(null);
          setUser(null);
          setError(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          setUser(newSession.user);
          setError(null);
        } else if (event === 'USER_UPDATED') {
          setUser(newSession.user);
        }
        
        // Ensure loading is false after any auth event
        setLoading(false);
      }
    );

    return () => {
      // console.log("unmounting: isMounted", isMounted)
      // isMounted = false;
      subscription.unsubscribe();
    };
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
        emailRedirectTo: `${window.location.origin}/`,
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
        userId: user?.id ?? null,
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